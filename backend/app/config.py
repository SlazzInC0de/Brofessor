"""Settings from environment variables (or backend/.env). See .env.example."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

DEFAULT_MODELS = {
    # Check each provider's docs for current model names; override with BROFESSOR_MODEL.
    "openai": "gpt-4.1-mini",
    "gemini": "gemini-2.5-flash",
    "replay": "replay",
}

PROVIDER = os.getenv("BROFESSOR_PROVIDER", "replay").lower()
MODEL = os.getenv("BROFESSOR_MODEL") or DEFAULT_MODELS.get(PROVIDER, "")
JUDGE_MODEL = os.getenv("BROFESSOR_JUDGE_MODEL") or MODEL
REPLAY_FILE = os.getenv("BROFESSOR_REPLAY", str(ROOT / "tests" / "fixtures" / "bst-replay.json"))
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
CORS_ORIGINS = [o.strip() for o in os.getenv("BROFESSOR_CORS", "http://localhost:3000").split(",") if o.strip()]
DATA_DIR = Path(os.getenv("BROFESSOR_DATA", str(ROOT / "data")))
MAX_REPAIRS = int(os.getenv("BROFESSOR_MAX_REPAIRS", "2"))
RATE_LIMIT_PER_HOUR = int(os.getenv("BROFESSOR_RATE_LIMIT", "20"))

# USD per 1M tokens, for cost estimates in the eval report (set to your model's prices)
PRICE_IN = float(os.getenv("BROFESSOR_PRICE_IN", "0"))
PRICE_OUT = float(os.getenv("BROFESSOR_PRICE_OUT", "0"))
