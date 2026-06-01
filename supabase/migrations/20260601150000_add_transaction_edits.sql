CREATE OR REPLACE FUNCTION public.update_transaction(
  p_transaction_id UUID,
  p_account_id UUID,
  p_category_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_description TEXT,
  p_occurred_on DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_transaction public.transactions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Transaction amount must be greater than zero';
  END IF;

  IF p_type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'Only income and expense transactions can be edited';
  END IF;

  SELECT *
  INTO v_transaction
  FROM public.transactions
  WHERE id = p_transaction_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_transaction.type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'Transfers cannot be edited';
  END IF;

  PERFORM id
  FROM public.accounts
  WHERE id IN (v_transaction.account_id, p_account_id)
    AND user_id = v_user_id
    AND archived = false
  ORDER BY id
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = p_account_id
      AND user_id = v_user_id
      AND archived = false
  ) THEN
    RAISE EXCEPTION 'Account is unavailable';
  END IF;

  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.categories
    WHERE id = p_category_id
      AND user_id = v_user_id
      AND kind = p_type
  ) THEN
    RAISE EXCEPTION 'Category is unavailable for this transaction type';
  END IF;

  IF v_transaction.account_id IS NOT NULL THEN
    UPDATE public.accounts
    SET balance = balance + CASE WHEN v_transaction.type = 'income' THEN -v_transaction.amount ELSE v_transaction.amount END,
        updated_at = now()
    WHERE id = v_transaction.account_id;
  END IF;

  UPDATE public.accounts
  SET balance = balance + CASE WHEN p_type = 'income' THEN p_amount ELSE -p_amount END,
      updated_at = now()
  WHERE id = p_account_id;

  UPDATE public.transactions
  SET account_id = p_account_id,
      category_id = p_category_id,
      amount = p_amount,
      type = p_type,
      description = NULLIF(trim(p_description), ''),
      occurred_on = p_occurred_on
  WHERE id = p_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_transaction(p_transaction_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_transaction public.transactions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_transaction
  FROM public.transactions
  WHERE id = p_transaction_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_transaction.type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'Transfers cannot be deleted';
  END IF;

  IF v_transaction.account_id IS NOT NULL THEN
    PERFORM id
    FROM public.accounts
    WHERE id = v_transaction.account_id
      AND user_id = v_user_id
    FOR UPDATE;

    UPDATE public.accounts
    SET balance = balance + CASE WHEN v_transaction.type = 'income' THEN -v_transaction.amount ELSE v_transaction.amount END,
        updated_at = now()
    WHERE id = v_transaction.account_id;
  END IF;

  DELETE FROM public.transactions
  WHERE id = p_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_transaction(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_transaction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_transaction(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_transaction(UUID) TO authenticated;
