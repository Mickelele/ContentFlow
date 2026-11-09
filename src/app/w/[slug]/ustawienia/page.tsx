import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Ustawienia" };

export default function Page() {
  return (
    <ComingSoon
      title="Ustawienia"
      description="Konto, workspace i integracje."
      stage="5"
      points={["Nazwa i kolor workspace'u", "Zapraszanie osób do workspace'u", "Podłączenie konta Google: Kalendarz i Dysk", "Powiadomienia i strefa czasowa"]}
    />
  );
}
