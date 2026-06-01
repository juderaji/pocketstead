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

  SELECT balance
  INTO v_from_balance
  FROM public.accounts
  WHERE id = p_from_account_id;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient funds in the source account';
  END IF;

  UPDATE public.accounts
  SET balance = balance - p_amount,
      updated_at = now()
  WHERE id = p_from_account_id;

  UPDATE public.accounts
  SET balance = balance + p_amount,
      updated_at = now()
  WHERE id = p_to_account_id;

  INSERT INTO public.transactions (user_id, account_id, amount, type, description, occurred_on)
  VALUES
    (v_user_id, p_from_account_id, p_amount, 'transfer_out', COALESCE(NULLIF(trim(p_description), ''), 'Account transfer'), p_occurred_on),
    (v_user_id, p_to_account_id, p_amount, 'transfer_in', COALESCE(NULLIF(trim(p_description), ''), 'Account transfer'), p_occurred_on);
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_funds(UUID, UUID, NUMERIC, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_funds(UUID, UUID, NUMERIC, TEXT, DATE) TO authenticated;
