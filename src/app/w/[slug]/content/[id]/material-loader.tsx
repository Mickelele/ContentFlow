"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/page-skeleton";

// Edytor scenariusza (Tiptap) i daty w strefie przeglądarki — renderujemy po stronie klienta.
export const MaterialLoader = dynamic(() => import("./material-editor").then((m) => m.MaterialEditor), {
  ssr: false,
  loading: () => <PageSkeleton />,
});
