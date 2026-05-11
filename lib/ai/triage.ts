import { GoogleGenerativeAI } from "@google/generative-ai";

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

let genai: GoogleGenerativeAI | null = null;

function getClient() {
  if (!genai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not set");
    genai = new GoogleGenerativeAI(apiKey);
  }
  return genai;
}

export async function triageThread(input: TriageInput): Promise<TriageOutput> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const body = (input.bodyText ?? input.snippet).slice(0, 800);
  const prompt = `Subject: ${input.subject}\nFrom: ${input.from}\n\n${body}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown code fences if present
  const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(json) as TriageOutput;

  const validCategories: TriageCategory[] = ["action_required", "fyi", "newsletter", "calendar", "personal"];
  if (!validCategories.includes(parsed.category)) parsed.category = "fyi";
  if (typeof parsed.urgency !== "number") parsed.urgency = 0;
  parsed.urgency = Math.max(0, Math.min(3, Math.round(parsed.urgency)));

  return parsed;
}

export async function triageThreadsBatch(inputs: TriageInput[]): Promise<Map<string, TriageOutput>> {
  const results = new Map<string, TriageOutput>();
  const BATCH = 5;

  for (let i = 0; i < inputs.length; i += BATCH) {
    const chunk = inputs.slice(i, i + BATCH);
    const settled = await Promise.allSettled(chunk.map((t) => triageThread(t)));
    settled.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        results.set(chunk[idx].threadId, r.value);
      }
    });
  }

  return results;
}
