/**
 * Konfiguracja Google po stronie przeglądarki (Picker, Drive API).
 * Wszystkie trzy wartości są publiczne z natury — zabezpiecza je lista dozwolonych źródeł w Google Cloud.
 */
export const google = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? "",
  appId: process.env.NEXT_PUBLIC_GOOGLE_APP_ID ?? "",
};

export const googleConfigured = Boolean(google.clientId && google.apiKey && google.appId);

/** Jedyny zakres: dostęp tylko do plików wybranych w oknie Google lub utworzonych przez ContentFlow. */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
