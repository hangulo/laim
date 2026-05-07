# laim — Gmail client (Superhuman-inspired)

## Context

Build a fast, AI-native Gmail client called **laim** with Superhuman-style keyboard navigation, an MX4-friendly input model, voice commands, and Claude-powered triage. The dashboard mirrors the provided screenshot: a "Triage" home page with sync results, items needing attention, schedule-at-a-glance, and per-source action lists.

The repository is empty — we're starting greenfield on branch `claude/gmail-client-shortcuts-8r4Ar`.

**Decisions locked in:**
- Web app, Next.js 14 (App Router), TypeScript, Tailwind.
- Multi-account Gmail from day one.
- No local email cache initially — fetch on demand. Add IndexedDB cache only if navigation feels sluggish.
- Dashboard is the home page; full inbox is a separate route.
- AI triage is "categorize + summarize" only (no auto-drafts, no auto-archive).

---

## Phasing

The plan is split into 5 phases. Each phase ends with something usable end-to-end.

### Phase 1 — MVP: Gmail + shortcuts + schedule at a glance
Ship a working multi-account Gmail client with Superhuman keyboard shortcuts and a schedule strip on the dashboard. **No AI yet.**

### Phase 2 — MX4 mouse shortcuts
Map MX4 side buttons (browser `mouseup` event with `button === 3` / `4`) to the same action system used by keyboard shortcuts.

### Phase 3 — AI triage (categorize + summarize)
Add the full Triage dashboard from the screenshot. Claude labels each thread (Action Required / FYI / Newsletter / Calendar / Personal) and writes a one-line summary. Triage state persisted to a server-side store.

### Phase 4 — Voice commands
Web Speech API for "archive", "reply", "next", "compose to <name>", routed through the same action system.

### Phase 5 (deferred) — Local cache + auto-drafts + Slack
Only if MVP feels slow or the user explicitly opts in.

---

## Phase 1 — MVP detail

### Tech stack
- Next.js 14 (App Router), TypeScript strict
- Tailwind CSS
- NextAuth.js — Google OAuth provider (scopes: `gmail.modify`, `calendar.readonly`, `userinfo.email`, `userinfo.profile`)
- `googleapis` npm package (Gmail v1, Calendar v3)
- `react-hotkeys-hook` for keyboard shortcuts
- Zustand for client state (selected thread, queue position, account switcher)
- SQLite via Prisma for token storage + multi-account linking (single-user for now)

### Directory structure
```
laim/
├── app/
│   ├── layout.tsx                  # Root shell, hotkey provider, account switcher
│   ├── page.tsx                    # Dashboard (home)
│   ├── inbox/page.tsx              # Full inbox view (j/k navigation)
│   ├── thread/[id]/page.tsx        # Thread reader
│   ├── compose/page.tsx            # Compose view (modal-style)
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── accounts/route.ts       # list/add/remove linked Google accounts
│       ├── gmail/
│       │   ├── threads/route.ts    # GET list, query by label/account
│       │   ├── threads/[id]/route.ts # GET thread, POST archive/label/send
│       │   └── send/route.ts
│       └── calendar/
│           └── events/route.ts     # GET today + tomorrow + day-after
├── components/
│   ├── dashboard/
│   │   ├── ScheduleAtAGlance.tsx   # screenshot's calendar strip
│   │   ├── ActionRequired.tsx      # Gmail action items list
│   │   └── DashboardShell.tsx
│   ├── inbox/
│   │   ├── ThreadList.tsx          # virtualized list, j/k cursor
│   │   ├── ThreadRow.tsx
│   │   └── ThreadReader.tsx
│   ├── compose/Composer.tsx
│   ├── shortcuts/
│   │   ├── HotkeyProvider.tsx      # registers all keyboard bindings
│   │   ├── CommandPalette.tsx      # CMD+K
│   │   └── actions.ts              # central action registry (see below)
│   └── account/AccountSwitcher.tsx
├── lib/
│   ├── google/
│   │   ├── client.ts               # OAuth2Client factory per-account
│   │   ├── gmail.ts                # listThreads, getThread, modifyThread, sendMessage
│   │   └── calendar.ts             # listEvents
│   ├── auth.ts                     # NextAuth config
│   ├── db.ts                       # Prisma client
│   └── store.ts                    # Zustand stores (cursor, selected account, queue)
├── prisma/schema.prisma            # User, Account (multi-Google), Token
├── .env.local                      # GOOGLE_CLIENT_ID/SECRET, NEXTAUTH_SECRET, ANTHROPIC_API_KEY
└── package.json
```

### Central action system
Every input source (keyboard, future mouse, future voice) dispatches into one registry. This is the most important architectural decision — get it right in Phase 1 so phases 2 and 4 are trivial.

**`components/shortcuts/actions.ts`** exports:
```ts
type ActionId = 'next' | 'prev' | 'open' | 'archive' | 'reply' | 'replyAll'
              | 'forward' | 'compose' | 'goInbox' | 'goDashboard' | 'palette'
              | 'switchAccount' | 'markRead' | 'markUnread' | 'star';

interface Action { id: ActionId; label: string; run: (ctx: Ctx) => Promise<void>; }
export const actions: Record<ActionId, Action>;
```

`HotkeyProvider.tsx` binds keys → action IDs. Phase 2 mouse handler and Phase 4 voice handler dispatch to the same registry.

### Keyboard bindings (Superhuman-aligned)
| Key | Action |
|---|---|
| `j` / `k` | next / previous thread |
| `Enter` / `o` | open thread |
| `e` | archive |
| `r` / `a` | reply / reply-all |
| `f` | forward |
| `c` | compose |
| `g i` | go to inbox |
| `g d` | go to dashboard |
| `s` | star |
| `u` | back to list |
| `⌘K` | command palette |
| `[` / `]` | switch account |

### Multi-account model
- `prisma/schema.prisma` has `User` (1) → `LinkedGoogleAccount` (N), each storing `accessToken`, `refreshToken`, `email`, `expiresAt`.
- NextAuth handles the **first** account (sign-in). Additional accounts added via `/api/accounts` route that runs an OAuth flow with `prompt=select_account` and stores tokens against the existing user.
- Active account is in Zustand; all Gmail API routes accept an `accountId` query param.
- Dashboard's "Action Required" and Schedule sections aggregate across all linked accounts (parallel fetches in the route handler).

### Schedule at a glance
- `lib/google/calendar.ts#listEvents(accountId, range)` → events for today, tomorrow, day-after.
- `ScheduleAtAGlance.tsx` renders three rows (Today / Tomorrow / <weekday>) with time + title + RSVP status badge, mirroring the screenshot.
- RSVP buttons deferred to Phase 3 (read-only in Phase 1).

### Dashboard "Action Required" (Phase 1 baseline)
Without AI yet, this section shows threads where:
- you're in the To: line (not just Cc/Bcc),
- the most recent message is from someone else,
- not archived.

This gives a useful dashboard immediately. Phase 3 replaces this heuristic with Claude-scored triage.

### Critical files to create first
1. `lib/auth.ts` + `app/api/auth/[...nextauth]/route.ts` — OAuth working end-to-end.
2. `prisma/schema.prisma` + `lib/db.ts` — token persistence.
3. `lib/google/gmail.ts` — thin wrapper around `googleapis`.
4. `components/shortcuts/actions.ts` + `HotkeyProvider.tsx` — the action registry.
5. `app/inbox/page.tsx` + `ThreadList.tsx` + `ThreadReader.tsx` — the read loop.
6. `app/page.tsx` + `ScheduleAtAGlance.tsx` + `ActionRequired.tsx` — dashboard.

### Environment variables
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
DATABASE_URL=file:./dev.db
ANTHROPIC_API_KEY=        # not used until Phase 3
```

### Phase 1 verification
- Sign in with Google → tokens persisted, redirected to dashboard.
- Add a second Google account → both appear in account switcher.
- Dashboard renders today/tomorrow calendar events from the active account.
- Press `g i` → inbox view loads threads.
- `j`/`k` move cursor; `Enter` opens; `e` archives and advances; `r` replies (composer prefilled); `c` opens blank composer.
- `⌘K` opens command palette listing all actions.
- `[` / `]` switches active account, dashboard re-fetches.

---

## Phase 2 — MX4 mouse shortcuts

- New file `components/shortcuts/MouseHandler.tsx` registered alongside `HotkeyProvider`.
- Listens for `mouseup` on `window`, checks `event.button`:
  - `3` (back) → `prev` action
  - `4` (forward) → `next` action
  - chord with shift held → `archive`
- Settings page `/settings/shortcuts` lets the user remap mouse buttons to action IDs.
- No new permissions — browsers expose MX4 side buttons natively.

**Verification**: with MX4 side buttons, navigate the inbox without touching keyboard.

---

## Phase 3 — AI triage

- New module `lib/ai/triage.ts` using `@anthropic-ai/sdk`, model `claude-sonnet-4-6`, with prompt caching enabled (system prompt + per-account context cached).
- Triage prompt (per thread): subject, snippet, sender, last message body (truncated). Returns JSON: `{ category: 'action_required'|'fyi'|'newsletter'|'calendar'|'personal', summary: string, urgency: 0-3, dueHint?: string }`.
- New API route `app/api/triage/run/route.ts` runs triage for all unhandled threads across linked accounts in parallel batches.
- Persisted to a `TriageResult` Prisma table keyed by `(accountId, threadId, threadHistoryId)` so re-triage only runs when a thread changes.
- Dashboard rebuilt to match screenshot:
  - Top: "SYNC RESULTS" green box (last run summary)
  - "STILL NEEDS ATTENTION" red box (urgency ≥ 2 + overdue)
  - "Schedule at a glance" (already in Phase 1)
  - "Gmail" / "Slack" columns with action-required cards, each with a "Done" button that adds a `laim/handled` Gmail label.
- Dismissed items persist to a server-side `Dismissals` table — equivalent to the `.triage/handled.json` referenced in the screenshot.

**Verification**: run triage → screenshot's exact layout populates with real data; dismiss item → re-run triage → it stays hidden until a new reply lands (detected via Gmail `historyId`).

---

## Phase 4 — Voice commands

- `components/shortcuts/VoiceHandler.tsx` — toggled with `v`, uses `webkitSpeechRecognition`.
- Grammar is a small whitelist: archive / reply / next / previous / open / compose to <name> / go to inbox / go to dashboard.
- Parsed intent dispatches to the action registry. "Compose to <name>" resolves against Gmail contacts.
- Visual indicator (mic icon) shows listening state.

**Verification**: speak "archive" → current thread archives and cursor advances.

---

## Phase 5 (deferred)
- IndexedDB thread cache (`lib/cache/threads.ts`) if `j/k` feels laggy.
- AI auto-draft replies for action-required threads, saved to Gmail Drafts.
- Slack column on dashboard.
- Electron wrapper for OS-global shortcuts.

---

## Reusable references
Nothing exists in-repo yet. External libraries to lean on:
- `googleapis` — Gmail/Calendar SDK (don't hand-roll REST).
- `next-auth` — handles refresh-token rotation for us.
- `react-hotkeys-hook` — sequence support (`g i`) out of the box.
- `@anthropic-ai/sdk` — Claude client; enable prompt caching on the triage system prompt.

## End-to-end verification (whole app, post-Phase 1)
1. `pnpm install && pnpm prisma migrate dev && pnpm dev`
2. Visit `http://localhost:3000` → Google OAuth → land on dashboard.
3. Add second account via account switcher.
4. Confirm calendar events show for today/tomorrow.
5. `g i` → inbox; navigate with `j/k`; archive with `e`; compose with `c`; send a real test email.
6. `⌘K` palette lists every action with its keybinding.
