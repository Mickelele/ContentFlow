import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Pomysły" };

export default function Page() {
  return (
    <ComingSoon
      title="Pomysły"
      description="Bank pomysłów i inspiracji."
      stage="6"
      points={["Pomysły na filmy i posty z linkami do inspiracji", "Tagi, kategorie i wyszukiwarka", "Zamiana pomysłu w materiał jednym kliknięciem"]}
    />
  );
}
