"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string; email?: string } | undefined;

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const safeNext = (v: FormDataEntryValue | null) =>
  typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/";

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/logowanie?blad=google");
  redirect(data.url);
}

const credentials = z.object({
  email: z.email("Wpisz poprawny adres e-mail."),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków."),
});

export async function signInWithEmail(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return {
      email,
      error:
        error.code === "email_not_confirmed"
          ? "Najpierw potwierdź adres — link wysłaliśmy na Twoją skrzynkę."
          : "Nieprawidłowy e-mail lub hasło.",
    };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signUpWithEmail(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await origin()}/auth/callback` },
  });
  if (error) {
    return {
      email,
      error:
        error.code === "user_already_exists"
          ? "To konto już istnieje. Zaloguj się."
          : "Nie udało się założyć konta. Spróbuj ponownie.",
    };
  }
  if (!data.session) {
    return { email, info: "Sprawdź skrzynkę — wysłaliśmy link potwierdzający." };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/logowanie");
}
