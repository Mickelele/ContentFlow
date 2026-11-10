"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CLIENT_COLORS } from "@/lib/palette";
import { getSession, getWorkspace } from "@/lib/workspace";

export type ClientFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

const optional = z
  .string()
  .trim()
  .transform((v) => v || null);

const url = optional.refine((v) => !v || /^https?:\/\/\S+$/i.test(v) || /^[\w.-]+\.\w{2,}\S*$/.test(v), {
  message: "Wpisz adres strony, np. firma.pl",
});

const schema = z.object({
  name: z.string().trim().min(1, "Wpisz nazwę klienta.").max(120, "Nazwa może mieć najwyżej 120 znaków."),
  color: z.enum(CLIENT_COLORS.map((c) => c.key) as [string, ...string[]]),
  contact_person: optional,
  email: optional.refine((v) => !v || z.email().safeParse(v).success, { message: "Wpisz poprawny adres e-mail." }),
  phone: optional,
  website: url,
  notes: optional,
  instagram: optional,
  tiktok: optional,
  facebook: optional,
  linkedin: optional,
  youtube: optional,
});

const SOCIALS = ["instagram", "tiktok", "facebook", "linkedin", "youtube"] as const;

function parse(formData: FormData) {
  const raw = Object.fromEntries([...schema.keyof().options].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Popraw zaznaczone pola.", fieldErrors } as const;
  }
  const d = parsed.data;
  const socials = Object.fromEntries(SOCIALS.filter((s) => d[s]).map((s) => [s, d[s]]));
  return {
    row: {
      name: d.name,
      color: d.color,
      contact_person: d.contact_person,
      email: d.email,
      phone: d.phone,
      website: d.website,
      notes: d.notes,
      socials,
    },
  } as const;
}

export async function createClientAction(slug: string, _: ClientFormState, formData: FormData): Promise<ClientFormState> {
  const ws = await getWorkspace(slug);
  const result = parse(formData);
  if ("error" in result) return result;

  const { supabase } = await getSession();
  const { error } = await supabase.from("clients").insert({ ...result.row, workspace_id: ws.id });
  if (error) return { error: "Nie udało się zapisać klienta. Spróbuj ponownie." };

  revalidatePath(`/w/${slug}`, "layout");
  redirect(`/w/${slug}/klienci`);
}

export async function updateClientAction(
  slug: string,
  id: string,
  _: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const ws = await getWorkspace(slug);
  const result = parse(formData);
  if ("error" in result) return result;

  const { supabase } = await getSession();
  const { error } = await supabase.from("clients").update(result.row).eq("id", id).eq("workspace_id", ws.id);
  if (error) return { error: "Nie udało się zapisać zmian. Spróbuj ponownie." };

  revalidatePath(`/w/${slug}`, "layout");
  redirect(`/w/${slug}/klienci`);
}

export async function setArchivedAction(slug: string, id: string, archived: boolean) {
  const [ws, { supabase }] = await Promise.all([getWorkspace(slug), getSession()]);
  await supabase
    .from("clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("workspace_id", ws.id);
  revalidatePath(`/w/${slug}`, "layout");
  redirect(`/w/${slug}/klienci${archived ? "" : "?archiwum=1"}`);
}
