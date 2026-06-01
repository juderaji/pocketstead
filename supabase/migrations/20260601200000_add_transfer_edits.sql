ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS transfer_id UUID;

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_id
ON public.transactions(transfer_id)
WHERE transfer_id IS NOT NULL;

-- Pair transfers created before transfer IDs existed. Repeated transfers with the
-- same details are matched deterministically by creation order.
WITH ranked AS (
  SELECT
    id,
    user_id,
    amount,
    description,
    occurred_on,
    type,
    row_number() OVER (
      PARTITION BY user_id, amount, description, occurred_on, type
      ORDER BY created_at, id
    ) AS pair_number
  FROM public.transactions
  WHERE type IN ('transfer_out', 'transfer_in')
    AND transfer_id IS NULL
),
pairs AS (
  SELECT outgoing.id AS outgoing_id, incoming.id AS incoming_id, gen_random_uuid() AS transfer_id
  FROM ranked outgoing
  JOIN ranked incoming
    ON incoming.user_id = outgoing.user_id
   AND incoming.amount = outgoing.amount
   AND incoming.description IS NOT DISTINCT FROM outgoing.description
   AND incoming.occurred_on = outgoing.occurred_on
   AND incoming.pair_number = outgoing.pair_number
   AND incoming.type = 'transfer_in'
  WHERE outgoing.type = 'transfer_out'
),
updates AS (
  SELECT outgoing_id AS id, transfer_id FROM pairs
  UNION ALL
  SELECT incoming_id AS id, transfer_id FROM pairs
)
UPDATE public.transactions transaction
SET transfer_id = updates.transfer_id
FROM updates
WHERE transaction.id = updates.id;

CREATE OR REPLACE FUNCTION public.transfer_funds(
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_occurred_on DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_from_balance NUMERIC(14, 2);
  v_transfer_id UUID := gen_random_uuid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Choose two different accounts';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero';
  END IF;

  PERFORM id
  FROM public.accounts
  WHERE id IN (p_from_account_id, p_to_account_id)
    AND user_id = v_user_id
    AND archived = false
  ORDER BY id
  FOR UPDATE;

  IF (
    SELECT count(*)
    FROM public.accounts
    WHERE id IN (p_from_account_id, p_to_account_id)
      AND user_id = v_user_id
      AND archived = false
  ) <> 2 THEN
    RAISE EXCEPTION 'One or both accounts are unavailable';
  END IF;

  SELECT balance INTO v_from_balance
  FROM public.accounts
  WHERE id = p_from_account_id;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds in the source account';
  END IF;

  UPDATE public.accounts SET balance = balance - p_amount, updated_at = now()
  WHERE id = p_from_account_id;

  UPDATE public.accounts SET balance = balance + p_amount, updated_at = now()
  WHERE id = p_to_account_id;

  INSERT INTO public.transactions (user_id, account_id, amount, type, description, occurred_on, transfer_id)
  VALUES
    (v_user_id, p_from_account_id, p_amount, 'transfer_out', COALESCE(NULLIF(trim(p_description), ''), 'Account transfer'), p_occurred_on, v_transfer_id),
    (v_user_id, p_to_account_id, p_amount, 'transfer_in', COALESCE(NULLIF(trim(p_description), ''), 'Account transfer'), p_occurred_on, v_transfer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_transfer(p_transaction_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_transfer_id UUID;
  v_out public.transactions%ROWTYPE;
  v_in public.transactions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT transfer_id INTO v_transfer_id
  FROM public.transactions
  WHERE id = p_transaction_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_transfer_id IS NULL THEN
    RAISE EXCEPTION 'Transfer pair not found';
  END IF;

  SELECT * INTO v_out FROM public.transactions
  WHERE transfer_id = v_transfer_id AND user_id = v_user_id AND type = 'transfer_out'
  FOR UPDATE;
  SELECT * INTO v_in FROM public.transactions
  WHERE transfer_id = v_transfer_id AND user_id = v_user_id AND type = 'transfer_in'
  FOR UPDATE;

  IF v_out.id IS NULL OR v_in.id IS NULL THEN
    RAISE EXCEPTION 'Transfer pair is incomplete';
  END IF;

  PERFORM id FROM public.accounts
  WHERE id IN (v_out.account_id, v_in.account_id) AND user_id = v_user_id
  ORDER BY id FOR UPDATE;

  UPDATE public.accounts SET balance = balance + v_out.amount, updated_at = now()
  WHERE id = v_out.account_id AND user_id = v_user_id;
  UPDATE public.accounts SET balance = balance - v_in.amount, updated_at = now()
  WHERE id = v_in.account_id AND user_id = v_user_id;

  DELETE FROM public.transactions
  WHERE transfer_id = v_transfer_id AND user_id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_transfer(
  p_transaction_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL,
  p_occurred_on DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_transfer_id UUID;
  v_out public.transactions%ROWTYPE;
  v_in public.transactions%ROWTYPE;
  v_from_balance NUMERIC(14, 2);
  v_description TEXT := COALESCE(NULLIF(trim(p_description), ''), 'Account transfer');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Choose two different accounts';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero';
  END IF;

  SELECT transfer_id INTO v_transfer_id
  FROM public.transactions
  WHERE id = p_transaction_id AND user_id = v_user_id
  FOR UPDATE;

  IF v_transfer_id IS NULL THEN
    RAISE EXCEPTION 'Transfer pair not found';
  END IF;

  SELECT * INTO v_out FROM public.transactions
  WHERE transfer_id = v_transfer_id AND user_id = v_user_id AND type = 'transfer_out'
  FOR UPDATE;
  SELECT * INTO v_in FROM public.transactions
  WHERE transfer_id = v_transfer_id AND user_id = v_user_id AND type = 'transfer_in'
  FOR UPDATE;

  IF v_out.id IS NULL OR v_in.id IS NULL THEN
    RAISE EXCEPTION 'Transfer pair is incomplete';
  END IF;

  PERFORM id FROM public.accounts
  WHERE id IN (v_out.account_id, v_in.account_id, p_from_account_id, p_to_account_id)
    AND user_id = v_user_id
  ORDER BY id FOR UPDATE;

  IF (
    SELECT count(*)
    FROM public.accounts
    WHERE id IN (p_from_account_id, p_to_account_id)
      AND user_id = v_user_id AND archived = false
  ) <> 2 THEN
    RAISE EXCEPTION 'One or both accounts are unavailable';
  END IF;

  UPDATE public.accounts SET balance = balance + v_out.amount, updated_at = now()
  WHERE id = v_out.account_id AND user_id = v_user_id;
  UPDATE public.accounts SET balance = balance - v_in.amount, updated_at = now()
  WHERE id = v_in.account_id AND user_id = v_user_id;

  SELECT balance INTO v_from_balance
  FROM public.accounts WHERE id = p_from_account_id;
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds in the source account';
  END IF;

  UPDATE public.accounts SET balance = balance - p_amount, updated_at = now()
  WHERE id = p_from_account_id;
  UPDATE public.accounts SET balance = balance + p_amount, updated_at = now()
  WHERE id = p_to_account_id;

  UPDATE public.transactions
  SET account_id = p_from_account_id, amount = p_amount, description = v_description, occurred_on = p_occurred_on
  WHERE id = v_out.id;
  UPDATE public.transactions
  SET account_id = p_to_account_id, amount = p_amount, description = v_description, occurred_on = p_occurred_on
  WHERE id = v_in.id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_transfer(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_transfer(UUID, UUID, UUID, NUMERIC, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_transfer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_transfer(UUID, UUID, UUID, NUMERIC, TEXT, DATE) TO authenticated;
