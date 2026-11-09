"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Input, Textarea, buttonClass, cx } from "@/components/ui";
import { CLIENT_COLORS, colorVars, type ClientColor } from "@/lib/palette";
import type { ClientFormState } from "./actions";

export type ClientValues = {
  name: string;
  color: ClientColor;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  socials: Partial<Record<"instagram" | "tiktok" | "facebook" | "linkedin" | "youtube", string>>;
};

const SOCIAL_FIELDS = [
  { key: "instagram", label: "Instagram", placeholder: "@nazwa" },
  { key: "tiktok", label: "TikTok", placeholder: "@nazwa" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/nazwa" },
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/company/nazwa" },
  { key: "youtube", label: "YouTube", placeholder: "@kanal" },
] as const;

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Zapisuję…" : label}
    </Button>
  );
}

export function ClientForm({
  action,
  initial,
  cancelHref,
  submitLabel,
  usedColors = [],
}: {
  action: (state: ClientFormState, formData: FormData) => Promise<ClientFormState>;
  initial?: ClientValues;
  cancelHref: string;
  submitLabel: string;
  usedColors?: ClientColor[];
}) {
  const [state, formAction] = useActionState(action, undefined);
  const fe = state?.fieldErrors ?? {};
  // Domyślnie pierwszy kolor, którego nie ma jeszcze żaden klient.
  const defaultColor = initial?.color ?? CLIENT_COLORS.find((c) => !usedColors.includes(c.key))?.key ?? "blue";

  return (
    <form action={formAction} className="flex flex-col gap-10" noValidate>
      <section className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Nazwa klienta" htmlFor="name" error={fe.name}>
            <Input
              id="name"
              name="name"
              required
              autoFocus={!initial}
              defaultValue={initial?.name}
              placeholder="HELINAT"
              aria-invalid={Boolean(fe.name)}
              aria-describedby={fe.name ? "name-error" : undefined}
            />
          </Field>
        </div>

        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Kolor w kalendarzu</legend>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {CLIENT_COLORS.map((c) => {
              const v = colorVars(c.key);
              return (
                <label key={c.key} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="color"
                    value={c.key}
                    defaultChecked={c.key === defaultColor}
                    className="peer sr-only"
                    aria-label={c.label}
                  />
                  <span
                    className={cx(
                      "pressable flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-bg",
                      "peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-focus",
                    )}
                    style={{ background: v.solid }}
                    title={c.label}
                  />
                  {usedColors.includes(c.key) && c.key !== initial?.color ? (
                    <span className="pointer-events-none absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-bg bg-ink-3" title="Używany przez innego klienta" />
                  ) : null}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-sm text-ink-3">Szara kropka oznacza kolor, który ma już inny klient.</p>
        </fieldset>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">Kontakt</h2>
        <Field label="Osoba kontaktowa" htmlFor="contact_person">
          <Input id="contact_person" name="contact_person" autoComplete="off" defaultValue={initial?.contact_person ?? ""} placeholder="Anna Kowalska" />
        </Field>
        <Field label="E-mail" htmlFor="email" error={fe.email}>
          <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ""} placeholder="anna@firma.pl" aria-invalid={Boolean(fe.email)} />
        </Field>
        <Field label="Telefon" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} placeholder="+48 600 000 000" />
        </Field>
        <Field label="Strona www" htmlFor="website" error={fe.website}>
          <Input id="website" name="website" inputMode="url" defaultValue={initial?.website ?? ""} placeholder="firma.pl" aria-invalid={Boolean(fe.website)} />
        </Field>
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <h2 className="text-base font-semibold sm:col-span-2">Profile społecznościowe</h2>
        {SOCIAL_FIELDS.map((s) => (
          <Field key={s.key} label={s.label} htmlFor={s.key}>
            <Input id={s.key} name={s.key} defaultValue={initial?.socials?.[s.key] ?? ""} placeholder={s.placeholder} />
          </Field>
        ))}
      </section>

      <section>
        <Field label="Notatki" htmlFor="notes">
          <Textarea id="notes" name="notes" rows={4} defaultValue={initial?.notes ?? ""} placeholder="Pakiet, preferencje, ustalenia ze spotkań…" />
        </Field>
      </section>

      {state?.error ? (
        <p role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="sticky bottom-20 flex justify-end gap-2 border-t border-line bg-bg/95 py-4 lg:bottom-0">
        <Link href={cancelHref} className={buttonClass("ghost")}>
          Anuluj
        </Link>
        <Submit label={submitLabel} />
      </div>
    </form>
  );
}
