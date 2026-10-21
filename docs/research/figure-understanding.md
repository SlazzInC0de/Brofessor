# Figure understanding (Phase 5 research)

Goal: any figure from uploaded material (anatomy, circuits, apparatus, maps) becomes named parts with outlines, automatically. In the digestive demo, segmentation seeds and label positions were picked by hand. This file plans how to remove that manual step.

---

## Key insight: textbook figures already label themselves
Most textbook figures have text labels with leader lines pointing at each part. That gives us, for free:
- **part names** (OCR the label text)
- **a seed point inside each part** (follow the leader line from the label to its tip)

Those seeds are exactly what the demo's watershed needed.

## Approach ladder (try in order, stop when good enough)

### Level 1: zero-shot pipeline (no training)
1. **OCR** labels with positions: PaddleOCR or Tesseract
2. **Leader lines:** detect thin dark lines (Hough transform / line segment detector), match each to the nearest label, take the far endpoint as the seed
3. **Segment** each part from its seed: SAM 2 (Segment Anything) with point prompts. Fallback: seeded watershed (already working in `playground/trace/segment.py`)
4. **Inpaint** labels/lines away, **trace** outlines (`strokes.py`)
5. **Vision LLM check:** send the figure + detected parts, ask it to confirm names, fix wrong matches, and add missing parts as point estimates
6. Figures **without labels:** vision LLM proposes part names + approximate points, then SAM segments

### Level 2: evaluate before training
- Dataset: **AI2D** (Allen AI, ~5,000 grade-school science diagrams with annotated blobs, text labels, arrows and their relationships). Ideal for measuring label-to-part matching and segmentation quality
- Build a small eval set of 30 to 50 figures from your own course PDFs (biology, physics, circuits, DBMS diagrams)
- Metrics: % parts correctly named, mask IoU vs hand-annotated, % figures needing no manual fix

### Level 3: fine-tune only where Level 1 fails
- Fine-tune a label/arrow detector (e.g. YOLO) on AI2D if leader-line detection is the weak link
- Fine-tune SAM's decoder on diagram-style images if masks bleed across flat-colour line art
- Don't train from scratch: pretrained models + diagram fine-tuning is far cheaper and better

## Sketch rules still apply (D-008)
Even with perfect masks, the board shows outlines only. Detail strokes are kept only when the Board Script marks a part `detail: key` (e.g. intestine coils).

## Research checklist
- [ ] Run SAM 2 on the digestive figure with the demo seeds; compare masks with the watershed output
- [ ] Run PaddleOCR on the original figure; check label text + boxes
- [ ] Prototype leader-line following on the same figure (goal: reproduce the demo seeds automatically)
- [ ] Download AI2D, read its annotation format, run the pipeline on 20 diagrams
- [ ] Write results and failure cases here
