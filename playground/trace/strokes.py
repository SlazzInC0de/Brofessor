"""
Step 2 of figure tracing: turn segmented parts into drawable strokes.

For each part:
- outline: contours of the part mask, simplified (Douglas-Peucker)
- detail: Canny edges inside the part, skeletonised to single-pixel lines, walked into polylines
  (the player only draws detail where it carries meaning, see D-008)
Also traces the body silhouette.

Run after segment.py. Output: strokes.json (coordinates in original image pixels)
Usage: python strokes.py figure.png
"""
import sys, json
import cv2
import numpy as np
from skimage.morphology import skeletonize

NB = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def trace_skeleton(sk):
    """Walk a skeleton image into polylines, starting from endpoints, then junctions, then loops."""
    sk = sk.astype(bool).copy()
    h, w = sk.shape

    def neigh(y, x):
        return [(y + dy, x + dx) for dy, dx in NB if 0 <= y + dy < h and 0 <= x + dx < w and sk[y + dy, x + dx]]

    pts = list(zip(*np.nonzero(sk)))
    deg = {p: len(neigh(*p)) for p in pts}
    order = [p for p in pts if deg[p] == 1] + [p for p in pts if deg[p] > 2] + pts
    lines = []
    for s in order:
        if not sk[s]:
            continue
        cur, run = s, [s]
        sk[s] = False
        while True:
            n = neigh(*cur)
            if not n:
                break
            cur = n[0]
            sk[cur] = False
            run.append(cur)
        if len(run) > 1:
            lines.append(run)
    return lines


def simplify_open(run, eps=1.3):
    a = np.array([[x, y] for y, x in run], np.float32).reshape(-1, 1, 2)
    return cv2.approxPolyDP(a, eps, False).reshape(-1, 2).astype(int).tolist()


def outlines(mask, min_len=40, eps=1.5):
    cs, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    out = []
    for c in cs:
        if cv2.arcLength(c, True) < min_len:
            continue
        p = cv2.approxPolyDP(c, eps, True).reshape(-1, 2).astype(int).tolist()
        out.append(p + [p[0]])
    return out


def main(path):
    clean = cv2.imread("clean.png")
    lab = np.load("lab.npy")
    names = json.load(open("names.json"))
    gray = cv2.cvtColor(clean, cv2.COLOR_BGR2GRAY)
    data = {"organs": {}}

    # body silhouette: light grey, unsaturated region (+ the organs inside it)
    hsv = cv2.cvtColor(clean, cv2.COLOR_BGR2HSV)
    S, V = hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    body = ((V < 251) & (V > 190) & (S < 15)).astype(np.uint8)
    body = cv2.morphologyEx(body, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    body[lab > 0] = 1
    body = cv2.morphologyEx(body, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    body = cv2.morphologyEx(body, cv2.MORPH_OPEN, np.ones((13, 13), np.uint8))  # cut thin line remnants
    cs, _ = cv2.findContours(body, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    bp = cv2.approxPolyDP(c, 2.0, True).reshape(-1, 2).astype(int).tolist()
    data["body"] = [bp + [bp[0]]]

    edges = cv2.Canny(cv2.GaussianBlur(gray, (3, 3), 0), 25, 70)
    for i, n in enumerate(names):
        m = (lab == i + 2).astype(np.uint8)
        if m.sum() < 30:
            continue
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        out = outlines(m, min_len=25 if n in ("gallbladder", "appendix") else 60)
        inner = cv2.erode(m, np.ones((7, 7), np.uint8))
        e = cv2.dilate(((edges > 0) & (inner > 0)).astype(np.uint8), np.ones((2, 2), np.uint8))
        detail = [simplify_open(r) for r in trace_skeleton(skeletonize(e > 0)) if len(r) >= 14]
        ys, xs = np.nonzero(m)
        data["organs"][n] = {
            "outline": out,
            "detail": [d for d in detail if len(d) >= 2],
            "centroid": [int(xs.mean()), int(ys.mean())],
        }
        print(f"{n}: {len(out)} outline, {len(detail)} detail strokes")

    json.dump(data, open("strokes.json", "w"), separators=(",", ":"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "figure.png")
