import Anthropic from "@anthropic-ai/sdk";

export type TriageCategory = "action_required" | "fyi" | "newsletter" | "calendar" | "personal";

export interface TriageOutput {
  category: TriageCategory;
  summary: string;
  urgency: number; // 0-3
}

export interface TriageInput {
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  bodyText?: string;
}

const SYSTEM_PROMPT = `You are an email triage assistant. For each email thread, return a JSON object with exactly these fields:
- category: one of "action_required" | "fyi" | "newsletter" | "calendar" | "personal"
- summary: one sentence (max 15 words) describing what this thread is about
- urgency: integer 0-3 (0=no urgency, 1=low, 2=medium, 3=high/time-sensitive)

Guidelines:
- action_required: needs a reply or decision from the user
- fyi: informational, no reply needed
- newsletter: bulk/marketing/newsletter email
- calendar: meeting invite, schedule change, event notification
- personal: from a friend/family member with no action needed

Respond ONLY with valid JSON, no markdown, no explanation.`;

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

export async function triageThread(input: TriageInput): Promise<TriageOutput> {
  const client = getClient();

  const userContent = `Subject: ${input.subject}
From: ${input.from}
Body: ${(input.bodyText ?? input.snippet).slice(0, 2000)}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  try {
    const parsed = JSON.parse(text) as TriageOutput;
    return {
      category: parsed.category ?? "fyi",
      summary: parsed.summary ?? "",
      urgency: typeof parsed.urgency === "number" ? Math.min(3, Math.max(0, parsed.urgency)) : 0,
    };
  } catch {
    return { category: "fyi", summary: text.slice(0, 80), urgency: 0 };
  }
}

export async function triageThreadsBatch(inputs: TriageInput[]): Promise<Map<string, TriageOutput>> {
  const results = new Map<string, TriageOutput>();
  const CONCURRENCY = 5;

  for (let i = 0; i < inputs.length; i += CONCURRENCY) {
    const chunk = inputs.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map((inp) => triageThread(inp)));
    for (let j = 0; j < chunk.length; j++) {
      const result = settled[j];
      if (result.status === "fulfilled") {
        results.set(chunk[j].threadId, result.value);
      } else {
        console.error(`[triage] failed for ${chunk[j].threadId}:`, result.reason);
        results.set(chunk[j].threadId, { category: "fyi", summary: "", urgency: 0 });
      }
    }
  }

  return results;
}
