CREATE OR REPLACE FUNCTION public.delete_category(p_category_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_category public.categories%ROWTYPE;
  v_other_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
  INTO v_category
  FROM public.categories
  WHERE id = p_category_id
    AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF lower(v_category.name) = 'other' THEN
    RAISE EXCEPTION 'The Other category cannot be deleted';
  END IF;

  SELECT id
  INTO v_other_id
  FROM public.categories
  WHERE user_id = v_user_id
    AND lower(name) = 'other'
    AND kind = v_category.kind
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_other_id IS NULL THEN
    INSERT INTO public.categories (user_id, name, kind, color, icon)
    VALUES (v_user_id, 'Other', v_category.kind, '#64748b', 'wallet')
    RETURNING id INTO v_other_id;
  END IF;

  UPDATE public.transactions
  SET category_id = v_other_id
  WHERE user_id = v_user_id
    AND category_id = p_category_id;

  DELETE FROM public.categories
  WHERE id = p_category_id
    AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_category(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_category(UUID) TO authenticated;
