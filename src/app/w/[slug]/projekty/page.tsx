import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Projekty" };

export default function Page() {
  return (
    <ComingSoon
      title="Projekty"
      description="Kampanie i zlecenia w ramach klientów."
      stage="4"
      points={["Projekty przypisane do klientów", "Zadania i materiały w projekcie", "Status i daty projektu"]}
    />
  );
}
