# Security Policy

## Supported versions

Brofessor is under active development. Only the latest commit on the `main` branch receives security fixes.

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report it privately by either:

- using **Report a vulnerability** under this repository's **Security** tab, or
- emailing **vsuryansh080405@gmail.com** with the subject `[Brofessor] Security report`.

Include:

- what the issue is and where it lives (endpoint, file, component)
- steps or a minimal request that reproduces it
- the impact you expect

## What to expect

- An acknowledgement within 7 days.
- A fix or a clear decision within 30 days for confirmed issues, depending on severity.
- Credit in the fix commit if you would like it.

## Scope

In scope:

- the FastAPI backend (`backend/`): lesson generation, the lesson store, rate limiting and CORS
- prompt injection that makes the backend leak API keys, write outside the lesson store, or produce board scripts that run code in the browser
- XSS through generated lessons, narration text or board rendering in the frontend (`frontend/`)
- path traversal or file access through lesson ids
- vulnerable dependencies

Out of scope: the quality or accuracy of generated lessons, abuse of a third-party LLM provider's own service, and reports from automated scanners without a working proof of concept.

## Notes for self-hosting

- Keep `OPENAI_API_KEY` and `GEMINI_API_KEY` in `backend/.env` only. Never commit them.
- Set `BROFESSOR_CORS` to your real frontend origin and keep `BROFESSOR_RATE_LIMIT` on when the API is public.
