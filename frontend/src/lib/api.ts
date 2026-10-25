/** Base URL of the FastAPI backend (Phase 3). Set NEXT_PUBLIC_API_URL in frontend/.env.local for other hosts. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');
