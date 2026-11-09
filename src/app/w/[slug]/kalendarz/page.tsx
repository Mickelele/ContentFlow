import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Kalendarz" };

export default function Page() {
  return (
    <ComingSoon
      title="Kalendarz"
      description="Wszystkie workspace'y w jednym widoku, z warstwami do włączania i wyłączania."
      stage="2"
      points={["Widok dnia, tygodnia i miesiąca", "Warstwy klientów i zadań z checkboxami, jak w Google Calendar", "Przeciąganie wydarzeń myszą i palcem", "Terminy nagrań, montaży i publikacji pobierane z materiałów"]}
    />
  );
}
