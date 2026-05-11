// import { GoogleGenerativeAI } from "@google/generative-ai";

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

// const SYSTEM_PROMPT = `You are an email triage assistant. For each email thread, return a JSON object with exactly these fields:
// - category: one of "action_required" | "fyi" | "newsletter" | "calendar" | "personal"
// - summary: one sentence (max 15 words) describing what this thread is about
// - urgency: integer 0-3 (0=no urgency, 1=low, 2=medium, 3=high/time-sensitive)
//
// Guidelines:
// - action_required: needs a reply or decision from the user
// - fyi: informational, no reply needed
// - newsletter: bulk/marketing/newsletter email
// - calendar: meeting invite, schedule change, event notification
// - personal: from a friend/family member with no action needed
//
// Respond ONLY with valid JSON, no markdown, no explanation.`;

// let genai: GoogleGenerativeAI | null = null;
//
// function getClient() {
//   if (!genai) {
//     const apiKey = process.env.GEMINI_API_KEY;
//     if (!apiKey) throw new Error("GEMINI_API_KEY not set");
//     genai = new GoogleGenerativeAI(apiKey);
//   }
//   return genai;
// }

export async function triageThread(_input: TriageInput): Promise<TriageOutput> {
  throw new Error("Gemini triage not enabled — add GEMINI_API_KEY and install @google/generative-ai");
}

export async function triageThreadsBatch(_inputs: TriageInput[]): Promise<Map<string, TriageOutput>> {
  throw new Error("Gemini triage not enabled — add GEMINI_API_KEY and install @google/generative-ai");
}
