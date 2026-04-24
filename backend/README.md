# docot backend

FastAPI + SQLAlchemy + SQLite backend for the docot messenger.

## Endpoints

- `POST /auth/signup` { handle, name, password } → { token, user }
- `POST /auth/login` { handle, password } → { token, user }
- `GET /auth/me` → user
- `GET /users/search?q=...` — search by handle/name
- `GET /users/{id}` — fetch a user
- `POST /users/{id}/contact` · `DELETE /users/{id}/contact`
- `POST /users/{id}/block` · `POST /users/{id}/unblock`
- `GET /chats` · `POST /chats` · `GET /chats/{id}`
- `POST /chats/{id}/messages`
- `POST /chats/{id}/pin?pinned=true` · `POST /chats/{id}/mute?muted=true`
- `GET /notes` · `POST /notes` · `PATCH /notes/{id}` · `DELETE /notes/{id}`
- `GET /events` · `POST /events` · `PATCH /events/{id}` · `DELETE /events/{id}`
- `GET /posts` · `POST /posts` · `POST /posts/{id}/like` · `POST /posts/{id}/repost`
- `WS /chats/ws?token=...&chatId=...` — broadcast new messages

All JSON; auth via `Authorization: Bearer <jwt>` header. JWT TTL: 30 days.

## Run locally

```
uv venv
uv pip install -e .
JWT_SECRET=dev DATABASE_URL=sqlite:///./docot.db uvicorn app.main:app --reload --port 8000
```

## Deploy (Fly.io)

Any Python-friendly host works; the production instance runs on Fly with a
persistent volume mounted at `/data` (SQLite DB path `/data/docot.db`).

```
fly launch --no-deploy
fly volumes create docot_data --region fra --size 1
fly secrets set JWT_SECRET=$(openssl rand -hex 32)
fly deploy
```

Default production URL: https://docot-backend-wvkjcktl.fly.dev
