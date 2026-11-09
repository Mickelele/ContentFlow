import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Content" };

export default function Page() {
  return (
    <ComingSoon
      title="Content"
      description="Materiały od pomysłu do publikacji."
      stage="3"
      points={["Rolki, posty, grafiki, filmy i karuzele przypisane do klienta", "Ścieżka: pomysł, scenariusz, nagranie, montaż, akceptacja, publikacja", "Edytor scenariusza i lista ujęć", "Terminy publikacji na każdej platformie osobno"]}
    />
  );
}
