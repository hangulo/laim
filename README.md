# laim

A fast, AI-native Gmail client inspired by Superhuman. Multi-account, keyboard-first, with a triage-style dashboard and schedule at a glance.

See [`PLAN.md`](./PLAN.md) for the full phased roadmap.

## Phase 1 (this branch)

- Multi-account Google sign-in (Gmail + Calendar)
- Dashboard with schedule-at-a-glance + heuristic "Action Required"
- Inbox with `j/k` navigation, `e` archive, `r/a` reply, `f` forward, `c` compose
- Command palette (`⌘K`)
- Account switcher (`[` / `]`)
- Compose / reply / forward via Gmail send

Phases 2–4 (MX4 mouse, AI triage, voice) are scoped in `PLAN.md`.

## Setup

```bash
cp .env.example .env.local
# fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET (any random string)
pnpm install            # or npm/yarn
pnpm prisma db push     # creates SQLite db at prisma/dev.db
pnpm dev
```

### Google Cloud setup

1. Create an OAuth client (Web) in Google Cloud Console.
2. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (NextAuth primary sign-in)
   - `http://localhost:3000/api/accounts/callback` (additional-account flow)
3. Enable APIs: **Gmail API** and **Google Calendar API**.
4. OAuth scopes used: `gmail.modify`, `gmail.send`, `calendar.readonly`, `openid email profile`.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `j` / `k` | next / prev thread |
| `Enter` / `o` | open thread |
| `u` | back to list |
| `e` | archive |
| `s` | star |
| `Shift+U` | mark unread |
| `r` / `a` / `f` | reply / reply-all / forward |
| `c` | compose |
| `g i` / `g d` | go to inbox / dashboard |
| `[` / `]` | switch account |
| `⌘K` | command palette |

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · NextAuth · Prisma + SQLite · googleapis · Zustand · react-hotkeys-hook
