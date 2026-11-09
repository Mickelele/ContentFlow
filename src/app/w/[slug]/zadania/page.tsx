import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Zadania" };

export default function Page() {
  return (
    <ComingSoon
      title="Zadania"
      description="Co trzeba zrobić i do kiedy."
      stage="3"
      points={["Priorytety, terminy i statusy", "Podzadania i checklisty", "Powiązanie z klientem, projektem lub materiałem", "Terminy widoczne w kalendarzu jako znaczniki, nie jako zajęty czas"]}
    />
  );
}
