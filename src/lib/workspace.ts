import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ClientColor } from "@/lib/palette";

export type Workspace = { id: string; name: string; slug: string; color: ClientColor; role: "owner" | "member" };
export type Profile = { id: string; email: string; full_name: string | null; avatar_url: string | null; last_workspace_id: string | null };

/** Zalogowany użytkownik + jego profil. Cache na czas jednego żądania. */
export const getSession = cache(async () => {
  // Wszystko poniżej zależy od żądania (ciasteczka, zegar w supabase-js),
  // więc jawnie wychodzimy z prerenderingu, zanim cokolwiek odczyta czas.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/logowanie");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, last_workspace_id")
    .eq("id", data.user.id)
    .single<Profile>();

  return { supabase, user: data.user, profile };
});

export const getWorkspaces = cache(async (): Promise<Workspace[]> => {
  const { supabase, user } = await getSession();
  const { data } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug, color)")
    .eq("user_id", user.id)
    .order("created_at");

  type Row = { role: Workspace["role"]; workspaces: Omit<Workspace, "role"> | null };
  return ((data ?? []) as unknown as Row[])
    .filter((r) => r.workspaces)
    .map((r) => ({ ...r.workspaces!, role: r.role }));
});

export const getWorkspace = cache(async (slug: string) => {
  const workspaces = await getWorkspaces();
  const ws = workspaces.find((w) => w.slug === slug);
  if (!ws) notFound();
  return ws;
});
