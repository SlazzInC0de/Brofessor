# backend

Set up in Phase 3 (Week 5).

```bash
python -m venv .venv
.venv\Scripts\activate
pip install fastapi uvicorn pydantic pymupdf opencv-python scikit-image
```

Planned structure:
```
app/main.py      FastAPI entry point
extract/         pdf, pptx, docx, image
analyze/         material analyzer -> teaching profile, concept map
figures/         figure tracing (see playground/trace)
llm/
  planner.py       material/topic -> lesson outline
  board_script.py  outline -> Board DSL
  prompts/
  provider.py      model-agnostic wrapper
tts/             web speech fallback, sarvam, english
dsl/schema.py    Pydantic schema
```
