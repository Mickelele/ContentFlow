"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/page-skeleton";

// „Dziś” liczymy w strefie czasowej przeglądarki, więc plan dnia renderuje się tylko po stronie klienta.
export const DayLoader = dynamic(() => import("./day-app").then((m) => m.DayApp), {
  ssr: false,
  loading: () => <PageSkeleton />,
});
