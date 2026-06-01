// Public browser configuration. Never add a database password or service-role key here.
export const PUBLIC_SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
export const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

export function getPublicSiteUrl() {
  const configuredUrl = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (configuredUrl) return configuredUrl.replace(/\/$/, "");
  return typeof window !== "undefined" ? window.location.origin : "";
}
