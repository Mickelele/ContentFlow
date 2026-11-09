export const CLIENT_COLORS = [
  { key: "red", label: "Czerwony" },
  { key: "orange", label: "Pomarańczowy" },
  { key: "amber", label: "Bursztynowy" },
  { key: "lime", label: "Limonkowy" },
  { key: "green", label: "Zielony" },
  { key: "teal", label: "Morski" },
  { key: "cyan", label: "Turkusowy" },
  { key: "blue", label: "Niebieski" },
  { key: "indigo", label: "Indygo" },
  { key: "violet", label: "Fioletowy" },
  { key: "pink", label: "Różowy" },
  { key: "brown", label: "Brązowy" },
] as const;

export type ClientColor = (typeof CLIENT_COLORS)[number]["key"];

export const isClientColor = (v: unknown): v is ClientColor =>
  CLIENT_COLORS.some((c) => c.key === v);

export const colorVars = (c: ClientColor) => ({
  solid: `var(--c-${c}-solid)`,
  fill: `var(--c-${c}-fill)`,
  ink: `var(--c-${c}-ink)`,
});
