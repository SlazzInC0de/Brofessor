"""
One interface over several LLM APIs. Every call returns text plus token usage and latency,
which the eval harness aggregates. All providers are asked for JSON.
"""
from __future__ import annotations
import asyncio, json, os, re, time
from dataclasses import dataclass
import httpx
from app import config


@dataclass
class Completion:
    text: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_s: float = 0.0


class ProviderError(RuntimeError):
    pass


Message = dict  # {"role": "user" | "assistant", "content": str}


class Provider:
    name = "base"

    def __init__(self, model: str):
        self.model = model

    async def complete(self, system: str, messages: list[Message], max_tokens: int = 4000) -> Completion:
        raise NotImplementedError

    async def _post(self, url: str, headers: dict, body: dict) -> dict:
        last = None
        async with httpx.AsyncClient(timeout=120) as client:
            for attempt in range(3):
                r = await client.post(url, headers=headers, json=body)
                if r.status_code == 200:
                    return r.json()
                last = f"{r.status_code}: {r.text[:400]}"
                if r.status_code in (429, 500, 502, 503, 504):
                    await asyncio.sleep(2 * (attempt + 1)); continue
                break
        raise ProviderError(f"{self.name} API error {last}")


class OpenAICompatProvider(Provider):
    name = "openai"

    async def complete(self, system, messages, max_tokens=4000):
        key = os.getenv("OPENAI_API_KEY", "")
        base = config.OPENAI_BASE_URL.rstrip("/")
        if not key and "localhost" not in base: raise ProviderError("OPENAI_API_KEY is not set")
        t = time.perf_counter()
        j = await self._post(f"{base}/chat/completions", {"Authorization": f"Bearer {key}", "content-type": "application/json"},
                             {"model": self.model, "max_tokens": max_tokens, "response_format": {"type": "json_object"},
                              "messages": [{"role": "system", "content": system}] + messages})
        u = j.get("usage", {})
        return Completion(j["choices"][0]["message"]["content"] or "", u.get("prompt_tokens", 0), u.get("completion_tokens", 0), time.perf_counter() - t)


class GeminiProvider(Provider):
    name = "gemini"

    async def complete(self, system, messages, max_tokens=4000):
        key = os.getenv("GEMINI_API_KEY")
        if not key: raise ProviderError("GEMINI_API_KEY is not set")
        t = time.perf_counter()
        contents = [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]} for m in messages]
        j = await self._post(f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
                             {"x-goog-api-key": key, "content-type": "application/json"},
                             {"systemInstruction": {"parts": [{"text": system}]}, "contents": contents,
                              "generationConfig": {"responseMimeType": "application/json", "maxOutputTokens": max_tokens}})
        try:
            text = "".join(p.get("text", "") for p in j["candidates"][0]["content"]["parts"])
        except (KeyError, IndexError):
            raise ProviderError(f"gemini returned no text: {json.dumps(j)[:300]}")
        u = j.get("usageMetadata", {})
        return Completion(text, u.get("promptTokenCount", 0), u.get("candidatesTokenCount", 0), time.perf_counter() - t)


class ReplayProvider(Provider):
    """Plays back recorded responses in order. Used by tests and for offline demos (no key)."""
    name = "replay"

    def __init__(self, model: str = "replay", responses: list[str] | None = None, file: str | None = None):
        super().__init__(model)
        if responses is None:
            data = json.loads(open(file or config.REPLAY_FILE, encoding="utf-8").read())
            responses = [r if isinstance(r, str) else json.dumps(r) for r in data["responses"]]
        self.responses = responses
        self.calls: list[tuple[str, list[Message]]] = []

    async def complete(self, system, messages, max_tokens=4000):
        if len(self.calls) >= len(self.responses):
            raise ProviderError("replay: ran out of recorded responses")
        self.calls.append((system, messages))
        text = self.responses[len(self.calls) - 1]
        delay = float(os.getenv("BROFESSOR_REPLAY_DELAY", "0.05"))   # simulate model latency in demos
        await asyncio.sleep(delay)
        return Completion(text, len(system) // 4 + sum(len(m["content"]) for m in messages) // 4, len(text) // 4, delay)


def make_provider(name: str | None = None, model: str | None = None) -> Provider:
    name = (name or config.PROVIDER).lower()
    model = model or (config.MODEL if name == config.PROVIDER else config.DEFAULT_MODELS.get(name, ""))
    return {"openai": OpenAICompatProvider, "gemini": GeminiProvider, "replay": ReplayProvider}[name](model)


def parse_json(text: str):
    """Models sometimes wrap JSON in prose or code fences; take the outermost object."""
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", t)
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        a, b = t.find("{"), t.rfind("}")
        if a >= 0 and b > a:
            return json.loads(t[a:b + 1])
        raise
