"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, Check, Download, Share } from "lucide-react";
import { Button } from "@/components/ui";
import { isIos, isStandalone, registerServiceWorker, urlBase64ToUint8Array } from "@/lib/pwa";
import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction, type Result } from "./actions";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/** To urządzenie: instalacja aplikacji (PWA) i powiadomienia push. */
export function DeviceCard() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [installEvt, setInstallEvt] = useState<InstallPrompt | null>(null);
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    registerServiceWorker().then(async (reg) => {
      const current = reg ? await reg.pushManager.getSubscription() : null;
      setSub(current);
      setSupported(ok);
      setStandalone(isStandalone());
      setIos(isIos());
      setPermission(ok ? Notification.permission : "unsupported");
    });
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const enable = () =>
    start(async () => {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return setResult({ ok: false, error: "Powiadomienia są zablokowane w ustawieniach przeglądarki." });
      const reg = await navigator.serviceWorker.ready;
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) });
      const r = await savePushSubscriptionAction(JSON.parse(JSON.stringify(s)), navigator.userAgent);
      setResult(r);
      if (r.ok) setSub(s);
    });

  const disable = () =>
    start(async () => {
      if (!sub) return;
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      setSub(null);
      setResult(await removePushSubscriptionAction(endpoint));
    });

  const feedback = result ? (
    result.ok ? (
      <p role="status" className="inline-flex items-center gap-1.5 text-sm text-ink-2">
        <Check className="size-4" aria-hidden="true" />
        {result.message}
      </p>
    ) : (
      <p role="alert" className="text-sm text-danger">
        {result.error}
      </p>
    )
  ) : null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-label="To urządzenie">
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2" aria-hidden="true">
          <BellRing className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">To urządzenie</h2>
          <p className="mt-0.5 text-sm text-ink-2">Aplikacja na ekranie głównym i przypomnienia o wydarzeniach, także gdy ContentFlow jest zamknięty.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Instalacja */}
        {standalone ? (
          <p className="text-sm text-ink-2">ContentFlow jest zainstalowany jako aplikacja.</p>
        ) : installEvt ? (
          <Button
            variant="secondary"
            className="self-start"
            onClick={async () => {
              await installEvt.prompt();
              setInstallEvt(null);
            }}
          >
            <Download className="size-4" aria-hidden="true" />
            Zainstaluj aplikację
          </Button>
        ) : ios ? (
          <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
            <Share className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Na iPhonie: w Safari stuknij „Udostępnij”, potem „Do ekranu początkowego”. Powiadomienia działają tylko w tak dodanej aplikacji.
          </p>
        ) : (
          <p className="text-sm text-ink-3">Instalacja: w menu przeglądarki wybierz „Zainstaluj ContentFlow” lub „Dodaj do ekranu głównego”.</p>
        )}

        {/* Powiadomienia */}
        {supported === null ? null : !supported || !VAPID ? (
          <p className="text-sm text-ink-3">
            {!VAPID ? "Powiadomienia push nie są jeszcze skonfigurowane na serwerze." : ios && !standalone ? "Najpierw dodaj aplikację do ekranu początkowego, potem włącz tu powiadomienia." : "Ta przeglądarka nie obsługuje powiadomień push."}
          </p>
        ) : sub ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-2 text-sm">Powiadomienia włączone.</p>
            <Button variant="secondary" disabled={pending} onClick={() => start(async () => setResult(await sendTestPushAction()))}>
              Wyślij próbne
            </Button>
            <Button variant="ghost" disabled={pending} onClick={disable}>
              Wyłącz
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={pending || permission === "denied"} onClick={enable}>
              <BellRing className="size-4" aria-hidden="true" />
              Włącz powiadomienia
            </Button>
            {permission === "denied" ? <p className="text-sm text-danger">Zablokowane w przeglądarce — odblokuj w ustawieniach strony.</p> : null}
          </div>
        )}
        {feedback}
      </div>
    </section>
  );
}
