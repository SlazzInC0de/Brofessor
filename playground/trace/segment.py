"""
Step 1 of figure tracing: clean the figure and segment it into named parts.

- Removes labels and leader lines (dark, thin, low-saturation pixels) with inpainting
- Builds a mask of the coloured figure
- Runs a seeded watershed: each part gets a few seed points (x, y) in original image pixels

Outputs (next to the script): clean.png, lab.npy (label map), names.json, segments_preview.png

Usage: python segment.py figure.png
Seeds are hand-picked for the digestive system demo. In production a vision LLM proposes
part names + seed points and SAM does the segmentation (see docs/decisions.md D-010).
"""
import sys, json
import cv2
import numpy as np


def line(a, b, n=8):
    return [(int(a[0] + (b[0] - a[0]) * t / n), int(a[1] + (b[1] - a[1]) * t / n)) for t in range(n + 1)]


SEEDS = {
    "glands": [(650, 275), (605, 362), (660, 300), (640, 265)],
    "mouth": [(560, 318), (580, 330), (540, 312), (600, 320)],
    "esophagus": line((668, 400), (705, 740), 10),
    "liver": [(600, 820), (560, 900), (720, 790), (650, 800), (540, 860), (580, 940), (700, 850)],
    "stomach": [(820, 820), (790, 905), (845, 880), (770, 800), (800, 930), (720, 920), (860, 840)],
    "gallbladder": [(617, 912), (612, 905)],
    "pancreas": [(680, 968), (760, 962), (820, 945)],
    "small": [(x, y) for x in range(590, 821, 30) for y in range(1070, 1250, 30)] + [(625, 960), (640, 990), (720, 990)],
    "large": line((527, 1030), (530, 1260)) + line((545, 1000), (880, 995)) + line((900, 960), (905, 1250))
             + line((890, 1265), (740, 1290)) + [(560, 1270), (580, 1290), (880, 925), (888, 960), (875, 1000), (880, 1050), (870, 1100)],
    "appendix": [(605, 1312), (600, 1300)],
    "rectum": [(705, 1335), (708, 1400), (700, 1310)],
}


def main(path):
    img = cv2.imread(path)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    S, V = hsv[..., 1].astype(int), hsv[..., 2].astype(int)

    # 1. remove labels + leader lines
    dark = cv2.dilate(((V < 80) & (S < 200)).astype(np.uint8), np.ones((3, 3), np.uint8))
    clean = cv2.inpaint(img, dark, 3, cv2.INPAINT_TELEA)
    cv2.imwrite("clean.png", clean)

    # 2. mask of the coloured figure
    hsv = cv2.cvtColor(clean, cv2.COLOR_BGR2HSV)
    H, S, V = (hsv[..., i].astype(int) for i in range(3))
    mask = ((S > 14) & (V > 50)).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))

    # 3. seeded watershed (label 1 = background, 2.. = parts)
    names = list(SEEDS)
    markers = np.zeros(mask.shape, np.int32)
    markers[cv2.dilate(mask, np.ones((15, 15), np.uint8)) == 0] = 1
    for i, n in enumerate(names):
        for x, y in SEEDS[n]:
            if mask[y, x]:
                cv2.circle(markers, (x, y), 3, i + 2, -1)
    cv2.watershed(cv2.cvtColor(clean, cv2.COLOR_BGR2Lab), markers)
    lab = markers.copy()
    lab[mask == 0] = 0

    # colour rule: the liver is the only dark red part below the neck
    yy = np.arange(mask.shape[0])[:, None]
    lab[(yy > 740) & (H < 12) & (S > 110) & (V < 200) & (mask > 0)] = names.index("liver") + 2

    np.save("lab.npy", lab)
    json.dump(names, open("names.json", "w"))

    rng = np.random.RandomState(1)
    preview = np.full(img.shape, 255, np.uint8)
    for i in range(len(names)):
        preview[lab == i + 2] = rng.randint(40, 230, 3)
    cv2.imwrite("segments_preview.png", preview)
    print("parts:", names)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "figure.png")
