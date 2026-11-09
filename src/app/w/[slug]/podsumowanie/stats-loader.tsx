"use client";

import dynamic from "next/dynamic";
import { PageSkeleton } from "@/components/page-skeleton";

// Tydzień liczymy w strefie czasowej przeglądarki (poniedziałek–niedziela).
export const StatsLoader = dynamic(() => import("./stats-app").then((m) => m.StatsApp), {
  ssr: false,
  loading: () => <PageSkeleton />,
});
