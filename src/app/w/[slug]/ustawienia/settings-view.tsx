"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Bot, Check, HardDrive, Hash, LogOut, SquareKanban } from "lucide-react";
import { signOut } from "@/app/logowanie/actions";
import { Button, Field, Input, cx } from "@/components/ui";
import { CLIENT_COLORS, colorVars, type ClientColor } from "@/lib/palette";
import { removeSlackAction, saveSlackAction, setSlackRemindersAction, testSlackAction, updateWorkspaceAction, type Result } from "./actions";
import { AppearanceCard } from "./appearance-card";
import { DeviceCard } from "./device-card";
import { TrelloSection, type TrelloState } from "./trello-card";

function Card({ title, description, icon, children }: { title: string; description?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-label={title}>
      <div className="mb-4 flex items-start gap-3">
        {icon}
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-ink-2">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Feedback({ result }: { result: Result | null }) {
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="inline-flex items-center gap-1.5 text-sm text-ink-2">
      <Check className="size-4" aria-hidden="true" />
      {result.message}
    </p>
  ) : (
    <p role="alert" className="text-sm text-danger">
      {result.error}
    </p>
  );
}

const IconBox = ({ children, color }: { children: ReactNode; color: string }) => (
  <span
    className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl"
    style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}
    aria-hidden="true"
  >
    {children}
  </span>
);

export function SettingsView({
  workspace,
  slack,
  trello,
  googleReady,
  account,
}: {
  workspace: { name: string; slug: string; color: ClientColor; isOwner: boolean };
  slack: { connected: boolean; channel: string | null; reminders: boolean };
  trello: TrelloState;
  googleReady: boolean;
  account: { email: string; name: string | null };
}) {
  return (
    <div className="flex flex-col gap-6">
      <WorkspaceCard workspace={workspace} />
      <AppearanceCard />
      <DeviceCard />

      <h2 className="mt-4 text-lg font-semibold">Integracje</h2>
      <SlackCard slug={workspace.slug} initial={slack} isOwner={workspace.isOwner} />
      <Card
        title="Trello"
        icon={
          <IconBox color="#0079BF">
            <SquareKanban className="size-5" />
          </IconBox>
        }
        description="Zadania z ContentFlow automatycznie na wybranej tablicy Trello."
      >
        <TrelloSection slug={workspace.slug} initial={trello} isOwner={workspace.isOwner} />
      </Card>
      <Card
        title="Dysk Google i Google Docs"
        icon={
          <IconBox color="#1FA463">
            <HardDrive className="size-5" />
          </IconBox>
        }
        description="Wybieranie plików z Dysku przy materiale i eksport scenariusza do Google Docs."
      >
        {googleReady ? (
          <p className="text-sm text-ink-2">
            Gotowe. Przy pierwszym użyciu Google zapyta o dostęp — tylko do plików, które wskażesz albo które utworzy ContentFlow. Nie
            zapisujemy żadnych tokenów.
          </p>
        ) : (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
            Wymaga jednorazowej konfiguracji w Google Cloud (klucz API i identyfikator aplikacji). Instrukcja jest w pliku{" "}
            <code>docs/KONFIGURACJA.md</code>.
          </p>
        )}
      </Card>
      <Card
        title="ChatGPT"
        icon={
          <IconBox color="#10A37F">
            <Bot className="size-5" />
          </IconBox>
        }
        description="Gotowe polecenia przy materiałach i pomysłach: hooki, scenariusz, opis z hashtagami, lista ujęć."
      >
        <p className="text-sm text-ink-2">Działa bez konfiguracji — otwiera ChatGPT w nowej karcie z wpisanym poleceniem.</p>
      </Card>

      <h2 className="mt-4 text-lg font-semibold">Konto</h2>
      <Card title={account.name ?? account.email} description={account.email}>
        <div className="flex flex-wrap items-center gap-2">
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              <LogOut className="size-4" aria-hidden="true" />
              Wyloguj
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}

function WorkspaceCard({ workspace }: { workspace: { name: string; slug: string; color: ClientColor; isOwner: boolean } }) {
  const [name, setName] = useState(workspace.name);
  const [color, setColor] = useState(workspace.color);
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();
  const disabled = !workspace.isOwner;

  return (
    <Card title="Workspace" description={disabled ? "Zmieniać nazwę i kolor może tylko właściciel." : "Nazwa i kolor widoczne w przełączniku i w kalendarzu."}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => setResult(await updateWorkspaceAction(workspace.slug, { name, color })));
        }}
      >
        <Field label="Nazwa" htmlFor="ws-name">
          <Input id="ws-name" value={name} disabled={disabled} onChange={(e) => (setName(e.target.value), setResult(null))} />
        </Field>
        <fieldset disabled={disabled}>
          <legend className="text-sm font-medium">Kolor</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CLIENT_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={c.label}
                aria-pressed={color === c.key}
                onClick={() => (setColor(c.key), setResult(null))}
                className={cx("pressable size-8 rounded-lg ring-offset-2 ring-offset-surface disabled:opacity-50", color === c.key && "ring-2 ring-ink")}
                style={{ background: colorVars(c.key).solid }}
              />
            ))}
          </div>
        </fieldset>
        <p className="text-sm text-ink-3">
          Adres: <span className="tabular">/w/{workspace.slug}</span>
        </p>
        {!disabled ? (
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Zapisuję…" : "Zapisz"}
            </Button>
            <Feedback result={result} />
          </div>
        ) : null}
      </form>
    </Card>
  );
}

function SlackCard({
  slug,
  initial,
  isOwner,
}: {
  slug: string;
  initial: { connected: boolean; channel: string | null; reminders: boolean };
  isOwner: boolean;
}) {
  const [connected, setConnected] = useState(initial.connected);
  const [reminders, setReminders] = useState(initial.reminders);
  const [channel, setChannel] = useState(initial.channel ?? "");
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <Card
      title="Slack"
      icon={
        <IconBox color="#611F69">
          <Hash className="size-5" />
        </IconBox>
      }
      description="Plan dnia i przypomnienia na wybrany kanał Slacka."
    >
      {connected ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Połączono{initial.channel || channel ? <> z kanałem <strong>#{channel || initial.channel}</strong></> : null}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" disabled={pending} onClick={() => start(async () => setResult(await testSlackAction(slug)))}>
              Wyślij test
            </Button>
            {isOwner ? (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await removeSlackAction(slug);
                    setResult(r);
                    if (r.ok) setConnected(false);
                  })
                }
              >
                Odłącz
              </Button>
            ) : null}
            <Feedback result={result} />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--ink)]"
              checked={reminders}
              disabled={!isOwner || pending}
              onChange={(e) => {
                const on = e.target.checked;
                setReminders(on);
                start(async () => {
                  const r = await setSlackRemindersAction(slug, on);
                  setResult(r);
                  if (!r.ok) setReminders(!on);
                });
              }}
            />
            Wysyłaj na kanał przypomnienia o wydarzeniach
          </label>
          <p className="text-sm text-ink-3">Plan dnia wyślesz przyciskiem „Na Slacka” na ekranie „Dziś”.</p>
        </div>
      ) : isOwner ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveSlackAction(slug, { url, channel });
              setResult(r);
              if (r.ok) {
                setConnected(true);
                setUrl("");
              }
            });
          }}
        >
          <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
            <li>
              Na{" "}
              <a href="https://api.slack.com/apps?new_app=1" target="_blank" rel="noreferrer" className="underline underline-offset-4">
                api.slack.com/apps
              </a>{" "}
              utwórz aplikację „From scratch” w swoim Slacku.
            </li>
            <li>Włącz <strong>Incoming Webhooks</strong> i kliknij „Add New Webhook to Workspace”.</li>
            <li>Wybierz kanał i skopiuj adres webhooka.</li>
          </ol>
          <Field label="Adres webhooka" htmlFor="slack-url">
            <Input
              id="slack-url"
              value={url}
              onChange={(e) => (setUrl(e.target.value), setResult(null))}
              placeholder="https://hooks.slack.com/services/…"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Kanał (do podpisu)" htmlFor="slack-channel" hint="Na przykład planowanie. Służy tylko do wyświetlenia tutaj.">
            <Input id="slack-channel" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="#planowanie" />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending || !url.trim()}>
              {pending ? "Łączę…" : "Połącz i wyślij test"}
            </Button>
            <Feedback result={result} />
          </div>
        </form>
      ) : (
        <p className="text-sm text-ink-2">Slacka może podłączyć właściciel workspace&apos;u.</p>
      )}
    </Card>
  );
}
