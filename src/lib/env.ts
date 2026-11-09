// NEXT_PUBLIC_* muszą być odczytane dosłownie, żeby Next wstawił je do bundla klienta.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isConfigured = Boolean(supabaseUrl && supabaseKey);

export const env = {
  supabaseUrl: supabaseUrl ?? "http://localhost:54321",
  supabaseKey: supabaseKey ?? "missing-key",
};
