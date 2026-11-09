import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ASSISTANT_MODEL, assistantSystem, describePath } from "@/lib/assistant";
import { createClient } from "@/lib/supabase/server";

/**
 * Pomocnik: czat z Claude Haiku, który podpowiada, jak coś zrobić w ContentFlow.
 * Wiedza pochodzi z docs/PRZEWODNIK.md i CHANGELOG.md. Odpowiedź wraca strumieniem czystego tekstu.
 */
export const maxDuration = 60;

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(8000) }))
    .min(1)
    .max(20),
  path: z.string().max(300).optional(),
});

// Prosty limit na instancję serwera: chroni przed przypadkowym zapętleniem, nie zastępuje limitu w konsoli Anthropic.
const LIMIT = 40;
const WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();
function allowed(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  hits.set(userId, recent);
  return true;
}

const text = (msg: string, status = 200) => new Response(msg, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return text("Zaloguj się, żeby korzystać z Pomocnika.", 401);

  if (!process.env.ANTHROPIC_API_KEY) return text("Pomocnik nie jest skonfigurowany: brakuje klucza ANTHROPIC_API_KEY.", 503);

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return text("Nieprawidłowe zapytanie.", 400);
  const { messages, path } = parsed.data;
  if (messages[0].role !== "user" || messages.at(-1)!.role !== "user") return text("Nieprawidłowe zapytanie.", 400);

  if (!allowed(userId)) return text("Za dużo pytań w krótkim czasie. Spróbuj ponownie za chwilę.", 429);

  // Kontekst strony doklejamy do ostatniego pytania, a nie do promptu systemowego, żeby nie psuć cache'u.
  const where = path ? describePath(path) : null;
  const history: Anthropic.MessageParam[] = messages.map((m, i) =>
    i === messages.length - 1 && where
      ? { role: "user", content: `<strona_uzytkownika>${where}</strona_uzytkownika>\n\n${m.content}` }
      : { role: m.role, content: m.content },
  );

  const client = new Anthropic();
  const system = await assistantSystem();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const response = client.messages.stream({
          model: ASSISTANT_MODEL,
          max_tokens: 2000,
          output_config: { effort: "low" },
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: history,
        });
        for await (const event of response) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await response.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\nNie mogę odpowiedzieć na to pytanie. Zapytaj o coś w ContentFlow."));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("…"));
        }
      } catch (error) {
        let msg = "Pomocnik jest chwilowo niedostępny. Spróbuj ponownie za chwilę.";
        if (error instanceof Anthropic.AuthenticationError) msg = "Pomocnik nie działa: klucz API Anthropic jest nieprawidłowy.";
        else if (error instanceof Anthropic.RateLimitError) msg = "Pomocnik ma teraz za dużo zapytań. Spróbuj za minutę.";
        else if (error instanceof Anthropic.APIError) console.error("Pomocnik: błąd API", error.status, error.message);
        else console.error("Pomocnik:", error);
        controller.enqueue(encoder.encode(msg));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
