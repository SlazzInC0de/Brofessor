# playground

Standalone experiments. Each HTML file opens directly in a browser.

| File | Day | What it tests |
|---|---|---|
| 00-digestive-demo.html | 1-2 | Full proof of concept: traced figure + labels + numbered notes + narration (English/Hinglish) + doubt chat |
| 01-stroke.html | 3 | SVG stroke-dashoffset animation |
| 02-rough.html | 4 | rough.js sketchy shapes |
| 03-freehand.html | 4 | perfect-freehand strokes |
| 04-handwriting.html | 5 | opentype.js text -> path -> animate |
| 05-math-layout.html | 6 | KaTeX/MathJax + dagre layout |

## 00-digestive-demo.html
A reference anatomy figure was turned into a whiteboard lesson without pasting any image:
1. `trace/segment.py`: removes labels/leader lines (inpaint), segments organs with seeded watershed -> `lab.npy`
2. `trace/strokes.py`: traces each organ's outline + skeletonised inner edges -> `strokes.json`
3. The HTML player draws outlines stroke by stroke (D-008: outline first, detail only for the small intestine coils), writes labels and numbered notes, and narrates each step with the browser's speech API.

Doubts: press `D` or Ask a doubt. The class pauses, you type in the chat, Brofessor answers in text and on a doubt sheet, and the class resumes only after you confirm. The demo has pre-scripted doubts for each step; free-text questions are matched by keywords.

Voice: the player plays `audio/<lang>/<step>.mp3` when present. Generate them with Sarvam:
```bash
cd playground/tts
$env:SARVAM_API_KEY = "your-key"        # PowerShell
python generate_sarvam.py --lang hinglish
python generate_sarvam.py --lang english
python generate_sarvam.py --compare     # every Hinglish persona for step s1, to pick a voice
```
Without audio files it falls back to the browser voice (robotic; on Windows a Hindi voice can be added under Settings > Time & language > Speech).

Known limits: segmentation seeds and label positions are hand-picked. Automating them is the Phase 5 research item (D-010).

## Running the tracer on your own figure
```bash
pip install opencv-python scikit-image numpy
cd playground/trace
python segment.py your_figure.png   # edit SEEDS in the file first
python strokes.py your_figure.png
```
