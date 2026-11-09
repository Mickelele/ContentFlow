"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/page-skeleton";

// Edytor notatek (Tiptap) działa tylko w przeglądarce.
export const NotesLoader = dynamic(() => import("./notes-app").then((m) => m.NotesApp), {
  ssr: false,
  loading: () => <PageSkeleton />,
});
