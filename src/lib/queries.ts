import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";

export const accountsQuery = queryOptions({
  queryKey: ["accounts"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async () => {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const transactionsQuery = queryOptions({
  queryKey: ["transactions"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select("*, accounts(name, color), categories(name, color, icon)")
      .order("occurred_on", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data;
  },
});

export const budgetsQuery = queryOptions({
  queryKey: ["budgets"],
  queryFn: async () => {
    const { data, error } = await supabase.from("budgets").select("*, categories(name, color)");
    if (error) throw error;
    return data;
  },
});

export const plannedQuery = queryOptions({
  queryKey: ["planned"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("planned_expenses")
      .select("*, categories(name, color)")
      .order("due_date", { ascending: true });
    if (error) throw error;
    return data;
  },
});

export const shoppingQuery = queryOptions({
  queryKey: ["shopping"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("shopping_items")
      .select("*, categories(name, color)")
      .order("priority", { ascending: true });
    if (error) throw error;
    return data;
  },
});

export const recurringQuery = queryOptions({
  queryKey: ["recurring"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("recurring_bills")
      .select("*, categories(name, color)")
      .eq("active", true)
      .order("day_of_month");
    if (error) throw error;
    return data;
  },
});

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("*").single();
    if (error) throw error;
    return data;
  },
});
