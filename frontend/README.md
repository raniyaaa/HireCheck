# HireCheck — Next.js frontend

The recruiter UI for HireCheck, built with Next.js (App Router), Tailwind CSS and shadcn/ui.
It replaces `streamlit_app.py` and talks to the same FastAPI backend (`backend/main.py`).

The browser calls FastAPI directly, so there are no Next.js API routes. Long `/process`
requests therefore never hit a hosting platform's serverless timeout.

## Run locally

Requires Node.js 22+ and the FastAPI backend running (`uvicorn backend.main:app --reload --port 8000`).

```bash
cd frontend
cp .env.example .env.local   # set NEXT_PUBLIC_BACKEND_URL if the backend isn't on localhost:8000
npm install
npm run dev                  # http://localhost:3000
```

## Deploy to Vercel

1. Import the repository in Vercel and set **Root Directory** to `frontend`.
2. Add the environment variable `NEXT_PUBLIC_BACKEND_URL` with your backend's URL
   (e.g. `https://<your-backend>.onrender.com`, no trailing slash).
3. Deploy.

`NEXT_PUBLIC_BACKEND_URL` is baked in at build time, so redeploy after changing it.

## Where things are

| Path | What it does |
|---|---|
| `src/app/page.tsx` | Dashboard route (`/`) |
| `src/app/login/page.tsx` | Login / sign-up route (`/login`) |
| `src/components/dashboard.tsx` | Main screen: upload, processing, results, admin panel |
| `src/components/app-sidebar.tsx` | Job description, ideal profile, thresholds, session |
| `src/components/results-section.tsx` | Metrics, search/filter, candidate rows, CSV export |
| `src/components/admin-panel.tsx` | Admin stats, sessions, user management |
| `src/lib/api.ts` | Typed client for every backend endpoint |
| `src/lib/auth.tsx` | Login state (JWT in `localStorage`) |
| `src/components/ui/` | shadcn/ui components |

## Notes

- **Login:** the JWT from `/auth/login` is stored in `localStorage` and sent as
  `Authorization: Bearer …`. Any 401 sends the user back to `/login`. Logout does a full
  page load so no previous user's data stays in memory.
- **CORS:** the backend currently allows all origins. Once the Vercel URL is known,
  consider restricting `allow_origins` in `backend/main.py` to that domain.
