# HireCheck — frontend

The recruiter UI for HireCheck, built with Next.js (App Router), Tailwind CSS and shadcn/ui.
It talks to the FastAPI backend in `backend/main.py`.

## Run locally

Requires Node.js 22+ and the FastAPI backend running (`uvicorn backend.main:app --reload --port 8000`).

```bash
cd frontend
cp .env.example .env.local   # set NEXT_PUBLIC_BACKEND_URL if the backend isn't on localhost:8000
npm install
npm run dev                  # http://localhost:3000
```

## Deployment

The repository's root `vercel.json` deploys this folder as the frontend service and the FastAPI
backend as a second service under `/api`, on the same domain.

In production the app calls `/api` by default, so `NEXT_PUBLIC_BACKEND_URL` is only needed to point
at a backend somewhere else. It's baked in at build time, so redeploy after changing it.

## Where things are

| Path | What it does |
|---|---|
| `src/app/login/page.tsx` | Sign in / create account (`/login`) |
| `src/app/(app)/layout.tsx` | Shared shell for signed-in pages: auth check + header |
| `src/app/(app)/page.tsx` | Resume screening (`/`) |
| `src/app/(app)/admin/page.tsx` | Admin dashboard (`/admin`, admins only) |
| `src/components/app-shell.tsx` | Waits for auth, redirects signed-out users, validates the token |
| `src/components/site-header.tsx` | Logo, navigation, backend status, account menu |
| `src/components/screening/` | Criteria card, upload card, results table, candidate details panel |
| `src/components/admin/admin-page.tsx` | Stats, decision breakdown, sessions and users tables |
| `src/components/decision.tsx` | How Accept / Review / Reject look everywhere (icon + label + colour) |
| `src/components/shared.tsx` | Logo, notices, page header, stat card, form field, loaders |
| `src/lib/api.ts` | Typed client for every backend endpoint |
| `src/lib/auth.tsx` | Sign-in state (JWT in `localStorage`) |
| `src/components/ui/` | shadcn/ui components |

## UI conventions

- **Responsive from 320px up.** Mobile-first. The screening page becomes two columns at `lg`
  (1024px). Tables hide secondary columns on small screens and fold key values into the first
  column, so the page never scrolls sideways.
- **Decisions are never colour-only.** Use `DecisionBadge` / `StatusIcon` from
  `components/decision.tsx`. Each status has its own glyph and a text label, and the colours come
  from the `--status-*` tokens in `globals.css`.
- **Theme:** the standard shadcn/ui neutral theme with the Geist font.

## Notes

- **Sign-in:** the JWT from `/auth/login` is stored in `localStorage` and sent as
  `Authorization: Bearer …`. Any 401 sends the user back to `/login`. Logging out does a full
  page load, so no previous user's data stays in memory (Next.js keeps visited pages alive in the
  background).
- **CORS:** the backend allows all origins. Since the frontend and backend now share a domain in
  production, `allow_origins` in `backend/main.py` could be tightened.
