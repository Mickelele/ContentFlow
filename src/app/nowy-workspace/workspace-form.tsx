"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Field, Input, cx } from "@/components/ui";
import { CLIENT_COLORS, colorVars } from "@/lib/palette";
import { createWorkspaceAction } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} className="h-11">
      {pending ? "Tworzę…" : "Utwórz workspace"}
    </Button>
  );
}

export function WorkspaceForm() {
  const [state, action] = useActionState(createWorkspaceAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <Field label="Nazwa" htmlFor="name" error={state?.error}>
        <Input id="name" name="name" required autoFocus defaultValue={state?.name} placeholder="Poligon 4x4" aria-invalid={Boolean(state?.error)} />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium">Kolor</legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {CLIENT_COLORS.map((c, i) => (
            <label key={c.key} className="cursor-pointer">
              <input type="radio" name="color" value={c.key} defaultChecked={i === 7} className="peer sr-only" aria-label={c.label} />
              <span
                className={cx(
                  "pressable block size-8 rounded-lg ring-offset-2 ring-offset-bg",
                  "peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:outline-2 peer-focus-visible:outline-focus",
                )}
                style={{ background: colorVars(c.key).solid }}
                title={c.label}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <Submit />
    </form>
  );
}
