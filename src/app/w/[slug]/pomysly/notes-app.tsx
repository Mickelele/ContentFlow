"use client";

import { useState } from "react";
import { PageHeader, cx } from "@/components/ui";
import type { ClientRef, WorkspaceRef } from "@/lib/tasks";
import { IdeasView } from "./ideas-view";
import { NotesView } from "./notes-view";

type Tab = "notes" | "ideas";

export function NotesApp({ workspace, clients }: { workspace: WorkspaceRef; clients: ClientRef[] }) {
  const params = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
  const [initialNote] = useState(() => params.get("notatka"));
  const [tab, setTab] = useState<Tab>(() => (params.get("widok") === "pomysly" ? "ideas" : "notes"));

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Notatki i pomysły" description="Notatki ze spotkań, ustalenia i bank pomysłów na materiały." />
      <div className="mb-6 flex rounded-lg bg-surface-2 p-0.5 sm:w-max" role="tablist" aria-label="Widok">
        {(
          [
            ["notes", "Notatki"],
            ["ideas", "Pomysły"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx(
              "h-9 flex-1 rounded-md px-5 text-sm sm:flex-none",
              tab === k ? "bg-surface font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-ink-2 hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "notes" ? (
        <NotesView workspace={workspace} clients={clients} initialNoteId={initialNote} />
      ) : (
        <IdeasView workspace={workspace} clients={clients} />
      )}
    </div>
  );
}
