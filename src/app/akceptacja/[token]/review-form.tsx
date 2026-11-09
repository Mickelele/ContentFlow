"use client";

import { useState, useTransition } from "react";
import { Check, PencilLine } from "lucide-react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { respondAction } from "./actions";

export function ReviewForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "approved" | "changes_requested">(null);
  const [pending, start] = useTransition();

  const send = (decision: "approved" | "changes_requested") =>
    start(async () => {
      setError(null);
      if (decision === "changes_requested" && !comment.trim()) return setError("Napisz, co poprawić.");
      const r = await respondAction({ token, decision, name, comment });
      if (r.ok) setDone(decision);
      else setError(r.error);
    });

  if (done) {
    return (
      <p role="status" className="mt-3 flex items-start gap-2 text-ink-2">
        <Check className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
        {done === "approved" ? "Dziękujemy! Materiał został zaakceptowany." : "Dziękujemy! Uwagi zostały przekazane — wrócimy z poprawioną wersją."}
      </p>
    );
  }

  return (
    <form className="mt-4 flex flex-col gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
      <Field label="Imię i nazwisko (opcjonalnie)" htmlFor="rv-name">
        <Input id="rv-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      <Field label="Uwagi" htmlFor="rv-comment" hint="Wymagane, jeśli prosisz o poprawki." error={error ?? undefined}>
        <Textarea id="rv-comment" rows={4} value={comment} onChange={(e) => (setComment(e.target.value), setError(null))} placeholder="Co zmienić, co zostawić…" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" disabled={pending} onClick={() => send("approved")} className="h-11">
          <Check className="size-4" aria-hidden="true" />
          Akceptuję
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => send("changes_requested")} className="h-11">
          <PencilLine className="size-4" aria-hidden="true" />
          Proszę o poprawki
        </Button>
      </div>
    </form>
  );
}
