# playground

Standalone experiments. Each HTML file opens directly in a browser.

| File | Day | What it tests |
|---|---|---|
| 00-digestive-demo.html | 1-3 | Full proof of concept: traced figure + labels + numbered notes + narration (English/Hinglish) + doubt chat |
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

Player: pen cursor, single-line handwriting, camera follow (target icon), board pages (tabs bottom-right), click any organ to ask about it, timeline with doubt pins, karaoke captions (CC), transcript, start screen with level, end screen with quiz and notes PDF.

Doubts: press `D`, click an organ, or Ask a doubt. The class pauses, you type in the chat, Brofessor answers in text and on a doubt sheet, and the class resumes only after you confirm. The demo has pre-scripted doubts for each step; free-text questions are matched by keywords.

Voice: the player plays `audio/<lang>/<step>.mp3` when present. Generate them with Sarvam:
```bash
cd playground/tts
$env:SARVAM_API_KEY = "your-key"        # PowerShell
python generate_sarvam.py --lang hinglish
python generate_sarvam.py --lang english
python generate_sarvam.py --compare     # every Hinglish persona for step s1, to pick a voice
```
Free option without an API key (Microsoft Edge neural voices, unofficial, good for prototyping):
```bash
pip install edge-tts
python generate_edge.py --lang hinglish     # or --voice hi-IN-MadhurNeural for a male voice
python generate_edge.py --compare
```
Without audio files it falls back to the best browser voice it can find (open the demo in Microsoft Edge for its natural voices) (robotic; on Windows a Hindi voice can be added under Settings > Time & language > Speech).

Known limits: segmentation seeds and label positions are hand-picked. Automating them is the Phase 5 research item (D-010).

## Running the tracer on your own figure
```bash
pip install opencv-python scikit-image numpy
cd playground/trace
python segment.py your_figure.png   # edit SEEDS in the file first
python strokes.py your_figure.png
```
