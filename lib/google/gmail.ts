import { google, gmail_v1 } from "googleapis";
import { htmlToText } from "html-to-text";
import { authedClient } from "./client";

export interface ThreadSummary {
  id: string;
  historyId?: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  unread: boolean;
  starred: boolean;
  labelIds: string[];
  hasAttachment: boolean;
  participants: string[];
  messageCount: number;
}

export interface ThreadFull {
  id: string;
  historyId?: string;
  subject: string;
  messages: ThreadMessage[];
  labelIds: string[];
}

export interface ThreadMessage {
  id: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  snippet: string;
}

async function gmailFor(accountId: string) {
  const auth = await authedClient(accountId);
  return google.gmail({ version: "v1", auth });
}

function header(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBody(data: string | undefined | null): string {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { text: string; html?: string } {
  if (!payload) return { text: "" };
  let text = "";
  let html: string | undefined;

  function walk(part: gmail_v1.Schema$MessagePart) {
    const mime = part.mimeType ?? "";
    if (mime === "text/plain" && part.body?.data) text += decodeBody(part.body.data);
    else if (mime === "text/html" && part.body?.data) html = (html ?? "") + decodeBody(part.body.data);
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);

  if (!text && html) text = htmlToText(html, { wordwrap: false });
  return { text, html };
}

function senderName(from: string, myEmail: string): string {
  const emailMatch = from.match(/<([^>]+)>/);
  const email = (emailMatch ? emailMatch[1] : from).trim().toLowerCase();
  if (email === myEmail.toLowerCase()) return "me";
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) return nameMatch[1].trim().split(/\s+/)[0];
  return email.split("@")[0];
}

export async function listThreads(
  accountId: string,
  opts: { query?: string; labelIds?: string[]; maxResults?: number; pageToken?: string; myEmail?: string } = {},
): Promise<{ threads: ThreadSummary[]; nextPageToken?: string }> {
  const gmail = await gmailFor(accountId);
  const list = await gmail.users.threads.list({
    userId: "me",
    q: opts.query,
    labelIds: opts.labelIds,
    maxResults: opts.maxResults ?? 25,
    pageToken: opts.pageToken,
  });

  const threadIds = list.data.threads?.map((t) => t.id!).filter(Boolean) ?? [];
  const threads = await Promise.all(
    threadIds.map(async (id): Promise<ThreadSummary> => {
      const t = await gmail.users.threads.get({ userId: "me", id, format: "metadata", metadataHeaders: ["Subject", "From", "To", "Date"] });
      const messages = t.data.messages ?? [];
      const last = messages[messages.length - 1];
      const labels = new Set<string>();
      messages.forEach((m) => m.labelIds?.forEach((l) => labels.add(l)));
      const hasAttachment = !!messages.some((m) =>
        (m.payload?.parts ?? []).some((p) => p.filename && p.filename.length > 0),
      );

      // Collect unique participants in order, replacing own address with "me"
      const myEmail = opts.myEmail ?? "";
      const seen = new Set<string>();
      const participants: string[] = [];
      for (const m of messages) {
        const from = header(m.payload?.headers ?? undefined, "From");
        const emailMatch = from.match(/<([^>]+)>/);
        const email = (emailMatch ? emailMatch[1] : from).trim().toLowerCase();
        if (!seen.has(email)) {
          seen.add(email);
          participants.push(senderName(from, myEmail));
        }
      }

      return {
        id: id,
        historyId: t.data.historyId ?? undefined,
        snippet: messages.map((m) => m.snippet).filter(Boolean).join(" · ") ?? "",
        subject: header(last?.payload?.headers ?? undefined, "Subject"),
        from: header(last?.payload?.headers ?? undefined, "From"),
        to: header(last?.payload?.headers ?? undefined, "To"),
        date: header(last?.payload?.headers ?? undefined, "Date"),
        unread: labels.has("UNREAD"),
        starred: labels.has("STARRED"),
        labelIds: Array.from(labels),
        hasAttachment,
        participants,
        messageCount: messages.length,
      };
    }),
  );

  return { threads, nextPageToken: list.data.nextPageToken ?? undefined };
}

export async function getThread(accountId: string, threadId: string): Promise<ThreadFull> {
  const gmail = await gmailFor(accountId);
  const t = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });

  const labels = new Set<string>();
  t.data.messages?.forEach((m) => m.labelIds?.forEach((l) => labels.add(l)));

  const messages: ThreadMessage[] = (t.data.messages ?? []).map((m) => {
    const headers = m.payload?.headers ?? undefined;
    const body = extractBody(m.payload ?? undefined);
    return {
      id: m.id!,
      from: header(headers, "From"),
      to: header(headers, "To"),
      cc: header(headers, "Cc") || undefined,
      date: header(headers, "Date"),
      subject: header(headers, "Subject"),
      bodyText: body.text,
      bodyHtml: body.html,
      snippet: m.snippet ?? "",
    };
  });

  return {
    id: threadId,
    historyId: t.data.historyId ?? undefined,
    subject: messages[0]?.subject ?? "",
    messages,
    labelIds: Array.from(labels),
  };
}

export async function modifyThread(
  accountId: string,
  threadId: string,
  add: string[] = [],
  remove: string[] = [],
): Promise<void> {
  const gmail = await gmailFor(accountId);
  await gmail.users.threads.modify({
    userId: "me",
    id: threadId,
    requestBody: { addLabelIds: add, removeLabelIds: remove },
  });
}

export async function archiveThread(accountId: string, threadId: string): Promise<void> {
  await modifyThread(accountId, threadId, [], ["INBOX"]);
}

export async function starThread(accountId: string, threadId: string, starred: boolean): Promise<void> {
  await modifyThread(accountId, threadId, starred ? ["STARRED"] : [], starred ? [] : ["STARRED"]);
}

export async function markRead(accountId: string, threadId: string, read: boolean): Promise<void> {
  await modifyThread(accountId, threadId, read ? [] : ["UNREAD"], read ? ["UNREAD"] : []);
}

export interface SendOpts {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  bodyText: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
}

export async function sendMessage(accountId: string, fromEmail: string, opts: SendOpts): Promise<void> {
  const gmail = await gmailFor(accountId);
  const lines = [
    `From: ${fromEmail}`,
    `To: ${opts.to}`,
  ];
  if (opts.cc) lines.push(`Cc: ${opts.cc}`);
  if (opts.bcc) lines.push(`Bcc: ${opts.bcc}`);
  lines.push(`Subject: ${opts.subject}`);
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);
  lines.push(`Content-Type: text/plain; charset="UTF-8"`);
  lines.push("");
  lines.push(opts.bodyText);

  const raw = Buffer.from(lines.join("\r\n"), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: opts.threadId },
  });
}

export async function getMessageHeaders(accountId: string, messageId: string): Promise<Record<string, string>> {
  const gmail = await gmailFor(accountId);
  const m = await gmail.users.messages.get({ userId: "me", id: messageId, format: "metadata" });
  const out: Record<string, string> = {};
  m.data.payload?.headers?.forEach((h) => {
    if (h.name && h.value) out[h.name] = h.value;
  });
  return out;
}
