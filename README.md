# docot — all in one

A black-and-white, mobile-first "all in one" messenger combining chats,
calendar, Obsidian-style notes and a Twitter-like news feed.

- Live: https://dist-thdbbhmb.devinapps.com
- Backend: https://docot-backend-wvkjcktl.fly.dev

## Tech

- **Frontend**: React 19, Vite, TypeScript, Tailwind, React Router
- **Backend**: FastAPI, SQLAlchemy, SQLite, JWT, WebSockets ([backend/](./backend))
- Real-time chat via WebSocket per chat
- JWT auth (handle + password) stored in `localStorage`

## Run locally

Backend:

```
cd backend
uv venv && uv pip install -e .
JWT_SECRET=dev DATABASE_URL=sqlite:///./docot.db uvicorn app.main:app --reload --port 8000
```

Frontend:

```
npm install
VITE_API_URL=http://127.0.0.1:8000 npm run dev
```

Production build:

```
VITE_API_URL=https://docot-backend-wvkjcktl.fly.dev npm run build
```

## Layout

- **Chats** — DMs, search users, create chat, WS live delivery
- **Calendar** — month grid, agenda, add/edit/delete events
- **Notes** — markdown editor with `[[wiki-links]]`, force-directed graph
- **News** — Twitter-style feed, like/repost/reply
- **Menu / Settings** — themes (light/dark/paper/inverse), wallpapers, i18n (EN/RU),
  profile, notifications, privacy, folders, advanced, speakers, battery
- **Profile** — user/group/channel profile screens with contact/block actions

## Deployment

- Frontend built to `dist/` and served as a static bundle (devinapps).
- Backend on Fly.io with a persistent volume at `/data/docot.db`.

See [`backend/README.md`](./backend/README.md) for backend details.
