CREATE TABLE public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  target_amount NUMERIC(14,2) CHECK (target_amount IS NULL OR target_amount >= 0),
  saved_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  due_date DATE,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_savings_goals_user_account
ON public.savings_goals(user_id, account_id);

GRANT SELECT, DELETE ON public.savings_goals TO authenticated;
GRANT INSERT (user_id, account_id, name, target_amount, due_date, color)
  ON public.savings_goals TO authenticated;
GRANT UPDATE (name, account_id, target_amount, due_date, color)
  ON public.savings_goals TO authenticated;
GRANT ALL ON public.savings_goals TO service_role;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own savings goals" ON public.savings_goals
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.validate_savings_goal_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.account_id IS DISTINCT FROM OLD.account_id
    AND OLD.saved_amount > 0 THEN
    RAISE EXCEPTION 'Withdraw the allocated amount before changing the savings account';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = NEW.account_id
      AND user_id = NEW.user_id
      AND type = 'savings'
      AND archived = false
  ) THEN
    RAISE EXCEPTION 'Savings account is unavailable';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_savings_goal_account
  BEFORE INSERT OR UPDATE ON public.savings_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_savings_goal_account();

CREATE OR REPLACE FUNCTION public.protect_savings_goal_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.savings_goals
    WHERE account_id = OLD.id
  ) AND (NEW.type <> 'savings' OR NEW.archived = true) THEN
    RAISE EXCEPTION 'Remove this account from its savings goals before changing its type or archiving it';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_savings_goal_account
  BEFORE UPDATE OF type, archived ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_savings_goal_account();

CREATE OR REPLACE FUNCTION public.adjust_savings_goal(
  p_goal_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_goal public.savings_goals%ROWTYPE;
  v_account_balance NUMERIC(14,2);
  v_allocated NUMERIC(14,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Enter a non-zero amount';
  END IF;

  SELECT * INTO v_goal
  FROM public.savings_goals
  WHERE id = p_goal_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings goal not found';
  END IF;

  SELECT balance INTO v_account_balance
  FROM public.accounts
  WHERE id = v_goal.account_id
    AND user_id = v_user_id
    AND archived = false
    AND type = 'savings'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Savings account is unavailable';
  END IF;

  SELECT COALESCE(sum(saved_amount), 0) INTO v_allocated
  FROM public.savings_goals
  WHERE account_id = v_goal.account_id
    AND user_id = v_user_id;

  IF p_amount > 0 AND v_allocated + p_amount > v_account_balance THEN
    RAISE EXCEPTION 'Not enough unallocated balance in this savings account';
  END IF;
  IF p_amount < 0 AND v_goal.saved_amount + p_amount < 0 THEN
    RAISE EXCEPTION 'Withdrawal exceeds the amount saved in this goal';
  END IF;

  UPDATE public.savings_goals
  SET saved_amount = saved_amount + p_amount,
      updated_at = now()
  WHERE id = p_goal_id;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_savings_goal(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_savings_goal(UUID, NUMERIC) TO authenticated;
