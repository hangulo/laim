# laim

A fast, AI-native Gmail client inspired by Superhuman. Multi-account, keyboard-first, with Claude-powered triage, a grouped inbox, voice commands, and a schedule-at-a-glance dashboard.

## Features

### Inbox
- **Grouped mode** — threads grouped by sender with rich metadata: unread count badge, attachment indicator, total message depth, bulk/mailing-list badge, and a replied indicator showing when you've sent in a thread
- **Date range filter** — `90d / 6mo / 1yr / All` segmented control; defaults to last 90 days
- **Filter toolbar** — Grouped, Unread only, and a Filters dropdown (has attachment, hide bulk, replied only, hide high spam score ≥ 4)
- **Group right-click menu** — mark all as read or archive all threads from a sender in one click
- Flat list view with spam score badges and unsubscribe indicators
- Sender history sidebar when reading a thread
- HTML emails rendered in an isolated always-light container (no dark-mode bleed)

### AI triage (Claude)
- Classifies inbox threads into `action_required`, `fyi`, `newsletter`, `calendar`, `personal`
- Scores urgency 0–3 and writes a one-sentence summary per thread
- Powered by `claude-sonnet-4-6` with prompt caching for fast, low-cost batch runs
- Dashboard with two-column layout: Action/Calendar vs FYI/Newsletter/Personal
- Urgent items surfaced in a dedicated "Still needs attention" strip

### Keyboard shortcuts

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
| `v` | toggle voice commands |
| `g i` / `g d` | go to inbox / dashboard |
| `[` / `]` | switch account |
| `⌘K` | command palette |
| `Escape` | close composer / palette / voice |

### Voice commands
Press `v` to start listening (Web Speech API, Chrome/Edge). A pulsing red pill appears at the bottom — press `Escape` or click × to stop. Recognized phrases:

`archive` · `reply` · `reply all` · `forward` · `next` · `previous` · `compose` · `mark unread` · `star` · `inbox` · `dashboard`

### Multi-account
- Sign in with multiple Google accounts simultaneously
- Switch with `[` / `]` or the account switcher in the top bar
- All inbox views, triage results, and compose drafts are scoped to the active account

## Setup

```bash
cp .env.example .env.local
# fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, ANTHROPIC_API_KEY
npm install
npx prisma db push     # creates SQLite db at prisma/dev.db
npm run dev
```

### Google Cloud setup

1. Create an OAuth client (Web) in Google Cloud Console.
2. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (NextAuth primary sign-in)
   - `http://localhost:3000/api/accounts/callback` (additional-account flow)
3. Enable APIs: **Gmail API** and **Google Calendar API**.
4. OAuth scopes: `gmail.modify`, `gmail.send`, `calendar.readonly`, `openid email profile`.

### Environment variables

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Any random string (session signing) |
| `NEXTAUTH_URL` | App URL, e.g. `http://localhost:3000` |
| `ANTHROPIC_API_KEY` | Claude API key (required for AI triage) |

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · NextAuth · Prisma + SQLite · googleapis · Anthropic SDK · Zustand · react-hotkeys-hook · Web Speech API

## Changelog

| Version | What changed |
|---|---|
| v0.23 | Email open tracking: "Track opens" toggle in composer; pixel injected into outgoing email; open count + timestamps shown in thread view (requires public hosting for pixel to fire) |
| v0.22 | Load-more banner and pagination when results are capped at the fetch limit |
| v0.21 | Date range fix: increase maxResults with wider ranges (50→100→200) so older threads actually appear |
| v0.20 | Date range fix: auto-disable unread-only when switching to 6mo / 1yr / All |
| v0.19 | Date range segmented filter — 90d / 6mo / 1yr / All, defaults to last 90 days |
| v0.18 | Hide high spam score filter (≥ 4), on by default |
| v0.17 | Filters dropdown (has attachment, hide bulk, replied only, hide high spam); group right-click menu (mark all read, archive all); bulk badge dark mode fix; default grouped + unread-only ON |
| v0.16 | Grouped toggle persisted in Zustand + localStorage across navigation |
| v0.15 | Group metadata: attachment icon, message count badge, bulk badge, replied indicator; filter toggles for attachments and bulk |
| v0.14 | Unread count badge moved inline next to sender name in grouped mode |
| v0.13 | Voice commands via Web Speech API — press `v`, 11 recognized phrases, pulsing red pill UI |
| v0.12 | Dark mode HTML email fix — always-white container with `colorScheme: light` isolation |
| v0.11 | Claude AI triage — Anthropic SDK, prompt caching, batch processing, urgency + category + summary |
| v0.10 | Initial release: grouped inbox, multi-account, keyboard shortcuts, command palette |
