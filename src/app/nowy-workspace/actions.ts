"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { CLIENT_COLORS } from "@/lib/palette";
import { getSession } from "@/lib/workspace";

export type WorkspaceFormState = { error?: string; name?: string } | undefined;

const schema = z.object({
  name: z.string().trim().min(1, "Wpisz nazwę firmy lub workspace'u.").max(80, "Nazwa może mieć najwyżej 80 znaków."),
  color: z.enum(CLIENT_COLORS.map((c) => c.key) as [string, ...string[]]),
});

export async function createWorkspaceAction(_: WorkspaceFormState, formData: FormData): Promise<WorkspaceFormState> {
  const name = String(formData.get("name") ?? "");
  const parsed = schema.safeParse({ name, color: formData.get("color") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, name };

  const { supabase, user } = await getSession();
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ ...parsed.data, created_by: user.id })
    .select("slug")
    .single();
  if (error || !data) return { error: "Nie udało się utworzyć workspace'u. Spróbuj ponownie.", name };

  redirect(`/w/${data.slug}`);
}
