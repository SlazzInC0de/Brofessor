"""
Brofessor eval harness: generate a lesson for every topic and measure how well the model writes Board DSL.

  python eval/run_eval.py --provider gemini --limit 10
  python eval/run_eval.py --provider openai --model gpt-4.1-mini --judge --hinglish
  python eval/run_eval.py --provider replay --limit 1           # offline smoke test

Writes eval/results/<run>/{results.json, report.md, lessons/*.json}.
Metrics: plan valid first try, steps valid first try / after repair / salvaged, actions dropped,
remaining semantic errors, time to first step, total time, tokens, cost, template coverage,
and (with --judge) an LLM-as-judge score for accuracy, pedagogy and visual fit.
"""
from __future__ import annotations
import argparse, asyncio, json, shutil, statistics as st, sys, time
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
import yaml  # noqa: E402
from app import config  # noqa: E402
from app.dsl.schema import dump  # noqa: E402
from app.llm import prompts  # noqa: E402
from app.llm.provider import make_provider, parse_json  # noqa: E402
from app.pipeline.generate import generate_lesson  # noqa: E402


async def judge(provider, lesson: dict, level: str) -> dict:
    compact = {"title": lesson["title"], "level": level,
               "steps": [{"title": s["title"], "narration": s["narration"]["en"], "board": s["actions"]} for s in lesson["steps"]]}
    c = await provider.complete(prompts.JUDGE, [{"role": "user", "content": json.dumps(compact, ensure_ascii=False)}], max_tokens=800)
    try:
        j = parse_json(c.text)
        return {k: j.get(k) for k in ("accuracy", "pedagogy", "visual_fit", "issues")}
    except Exception:
        return {"error": "judge returned invalid JSON"}


async def one(item, args, provider, judge_provider, out_dir, sem):
    async with sem:
        t = time.perf_counter()
        row = {"topic": item["topic"], "subject": item.get("subject"), "expect": item.get("expect", [])}
        try:
            lesson, m = await generate_lesson(provider, item["topic"], args.level, ["hinglish", "english"] if args.hinglish else ["english"])
            d = dump(lesson)
            (out_dir / "lessons" / f"{lesson.id}.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
            used = Counter(a["type"] for s in d["steps"] for a in s["actions"])
            row.update(ok=True, id=lesson.id, title=lesson.title, metrics=m.to_dict(), templates=dict(used),
                       expected_hit=bool(set(row["expect"]) & set(used)))
            if judge_provider:
                row["judge"] = await judge(judge_provider, d, args.level)
        except Exception as e:
            row.update(ok=False, error=f"{type(e).__name__}: {e}"[:300])
        row["wall_s"] = round(time.perf_counter() - t, 2)
        print(f'{"ok " if row.get("ok") else "ERR"} {row["topic"][:48]:48s} {row["wall_s"]:6.1f}s', flush=True)
        return row


def pct(n, d): return f"{100 * n / d:.0f}%" if d else "n/a"
def avg(xs): xs = [x for x in xs if isinstance(x, (int, float))]; return round(st.mean(xs), 2) if xs else None


def report(rows, args, model) -> str:
    ok = [r for r in rows if r.get("ok")]
    ms = [r["metrics"] for r in ok]
    steps = sum(m["steps_total"] for m in ms)
    first = sum(m["steps_first_try"] for m in ms); rep = sum(m["steps_repaired"] for m in ms); sal = sum(m["steps_salvaged"] for m in ms)
    clean = sum(1 for m in ms if not m["final_errors"])
    tpl = Counter(); [tpl.update(r["templates"]) for r in ok]
    lines = [f"# Brofessor eval: {model}", "",
             f"Run {datetime.now():%Y-%m-%d %H:%M}, provider `{args.provider}`, level {args.level}, Hinglish {'on' if args.hinglish else 'off'}, {len(rows)} topics.", "",
             "| Metric | Value |", "|---|---|",
             f"| Lessons generated | {len(ok)}/{len(rows)} |",
             f"| Plan valid on first try | {pct(sum(m['plan_first_try'] for m in ms), len(ms))} |",
             f"| Steps valid on first try | {pct(first, steps)} ({first}/{steps}) |",
             f"| Steps valid after self-repair | {pct(first + rep, steps)} |",
             f"| Steps salvaged (bad actions dropped) | {pct(sal, steps)}, {sum(m['actions_dropped'] for m in ms)} actions dropped |",
             f"| Lessons with zero remaining errors | {pct(clean, len(ms))} |",
             f"| Expected template used | {pct(sum(r['expected_hit'] for r in ok), len(ok))} |",
             f"| Avg time to first step | {avg([m['seconds_to_first_step'] for m in ms])} s |",
             f"| Avg total generation time | {avg([m['seconds_total'] for m in ms])} s |",
             f"| Avg tokens per lesson (in / out) | {avg([m['input_tokens'] for m in ms])} / {avg([m['output_tokens'] for m in ms])} |",
             f"| Total cost | ${sum(m['cost_usd'] for m in ms):.4f} (set BROFESSOR_PRICE_IN/OUT) |"]
    js = [r["judge"] for r in ok if r.get("judge") and "error" not in r["judge"]]
    if js:
        lines += [f"| Judge accuracy / pedagogy / visual fit (1-5) | {avg([j['accuracy'] for j in js])} / {avg([j['pedagogy'] for j in js])} / {avg([j['visual_fit'] for j in js])} |"]
    lines += ["", "## Templates used", "", ", ".join(f"{k} {v}" for k, v in tpl.most_common()), "",
              "## Per topic", "", "| Topic | Steps | First try | Repaired | Salvaged | Errors left | Time | Judge |", "|---|---|---|---|---|---|---|---|"]
    for r in rows:
        if not r.get("ok"):
            lines.append(f"| {r['topic']} | failed: {r['error']} | | | | | | |"); continue
        m = r["metrics"]; j = r.get("judge") or {}
        jj = f"{j.get('accuracy')}/{j.get('pedagogy')}/{j.get('visual_fit')}" if j and "error" not in j else ""
        lines.append(f"| {r['topic']} | {m['steps_total']} | {m['steps_first_try']} | {m['steps_repaired']} | {m['steps_salvaged']} | {len(m['final_errors'])} | {m['seconds_total']}s | {jj} |")
    issues = [(r["topic"], i) for r in ok for i in (r.get("judge") or {}).get("issues") or []]
    if issues:
        lines += ["", "## Judge issues", ""] + [f"- **{t}**: {i}" for t, i in issues[:60]]
    return "\n".join(lines) + "\n"


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", default=config.PROVIDER)
    ap.add_argument("--model")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--level", default="Standard", choices=["Basics", "Standard", "Quick revision"])
    ap.add_argument("--hinglish", action="store_true")
    ap.add_argument("--judge", action="store_true", help="score lessons with an LLM judge (BROFESSOR_JUDGE_MODEL)")
    ap.add_argument("--concurrency", type=int, default=2)
    ap.add_argument("--publish", action="store_true", help="copy generated lessons into the app's lesson store")
    args = ap.parse_args()

    topics = yaml.safe_load((ROOT / "eval" / "topics.yaml").read_text(encoding="utf-8"))
    if args.limit: topics = topics[:args.limit]
    provider = make_provider(args.provider, args.model)
    judge_provider = make_provider(args.provider, config.JUDGE_MODEL if not args.model else args.model) if args.judge else None
    run = f"{datetime.now():%Y%m%d-%H%M}-{args.provider}-{provider.model}".replace("/", "_")
    out = ROOT / "eval" / "results" / run
    (out / "lessons").mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(1 if args.provider == "replay" else args.concurrency)
    rows = await asyncio.gather(*[one(t, args, provider, judge_provider, out, sem) for t in topics])
    (out / "results.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "report.md").write_text(report(rows, args, provider.model), encoding="utf-8")
    if args.publish:
        dst = config.DATA_DIR / "lessons"; dst.mkdir(parents=True, exist_ok=True)
        for f in (out / "lessons").glob("*.json"): shutil.copy(f, dst / f.name)
    print(f"\nReport: {out / 'report.md'}")


if __name__ == "__main__":
    asyncio.run(main())
