"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui";
import type { ClientRef, WorkspaceRef } from "@/lib/tasks";
import type { ProjectRow } from "@/lib/projects";
import { ProjectDialog } from "../projects-list";

export function EditProjectButton({
  project,
  workspace,
  clients,
}: {
  project: Omit<ProjectRow, "content_count" | "task_count">;
  workspace: WorkspaceRef;
  clients: ClientRef[];
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        <Pencil className="size-4" aria-hidden="true" />
        Edytuj
      </Button>
      <ProjectDialog key={key} project={open ? project : null} workspace={workspace} clients={clients} onClose={() => setOpen(false)} />
    </>
  );
}
