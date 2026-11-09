import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { getWorkspaces } from "@/lib/workspace";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = { title: "Nowy workspace" };

export default async function NewWorkspacePage() {
  const workspaces = await getWorkspaces();

  return (
    <main className="flex min-h-dvh flex-col px-6 py-8 sm:px-12">
      <div className="flex items-center justify-between">
        <Logo />
        {workspaces.length > 0 ? (
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Wróć
          </Link>
        ) : null}
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Nowy workspace</h1>
        <p className="mt-2 mb-8 text-ink-2">
          Jeden workspace to jedna firma: ma własnych klientów, materiały i zadania. W kalendarzu zobaczysz wszystkie naraz.
        </p>
        <WorkspaceForm />
      </div>
    </main>
  );
}

// Cała aplikacja zależy od sesji użytkownika, więc renderujemy ją na żądanie.
export const instant = false;
