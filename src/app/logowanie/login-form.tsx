"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { GoogleIcon } from "@/components/google-icon";
import { Button, Field, Input, buttonClass } from "@/components/ui";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "./actions";

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("secondary", "h-11 w-full")}>
      <GoogleIcon className="size-[18px]" />
      {pending ? "Przekierowuję…" : "Kontynuuj z Google"}
    </button>
  );
}

function SubmitButton({ mode }: { mode: "in" | "up" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending} className="h-11 w-full">
      {pending ? "Chwileczkę…" : mode === "in" ? "Zaloguj się" : "Załóż konto"}
    </Button>
  );
}

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction] = useActionState(signInWithEmail, undefined);
  const [upState, upAction] = useActionState(signUpWithEmail, undefined);
  const state = mode === "in" ? inState : upState;
  const error = state?.error ?? (state ? undefined : initialError);

  return (
    <div className="flex flex-col gap-6">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <GoogleButton />
      </form>

      <div className="flex items-center gap-3 text-sm text-ink-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        lub e-mailem
        <span className="h-px flex-1 bg-line" />
      </div>

      <form action={mode === "in" ? inAction : upAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field label="E-mail" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state?.email}
            placeholder="ty@firma.pl"
            aria-describedby={error ? "form-error" : undefined}
          />
        </Field>
        <Field label="Hasło" htmlFor="password" hint={mode === "up" ? "Co najmniej 8 znaków." : undefined}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            required
            minLength={8}
            aria-describedby={mode === "up" ? "password-hint" : undefined}
          />
        </Field>

        {error ? (
          <p id="form-error" role="alert" className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {state?.info ? (
          <p role="status" className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink">
            {state.info}
          </p>
        ) : null}

        <SubmitButton mode={mode} />
      </form>

      <p className="text-center text-sm text-ink-2">
        {mode === "in" ? "Nie masz konta? " : "Masz już konto? "}
        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          {mode === "in" ? "Załóż je" : "Zaloguj się"}
        </button>
      </p>
    </div>
  );
}
