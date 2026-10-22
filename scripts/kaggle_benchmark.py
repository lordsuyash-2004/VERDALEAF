#!/usr/bin/env python3
"""Benchmark Verdaleaf's /api/detect against a labelled Kaggle leaf dataset.

Works with any ImageFolder-style directory (one folder per class), which is how
PlantVillage / New Plant Diseases / PlantDoc are all laid out:

    data/PlantVillage/
      Tomato___Late_blight/*.jpg
      Tomato___healthy/*.jpg

Usage
-----
# A) let the script pull PlantVillage from Kaggle (needs ~/.kaggle/kaggle.json)
python scripts/kaggle_benchmark.py --kaggle abdallahalidev/plantvillage-dataset \
    --per-class 3 --max-classes 8

# B) point at a folder you already downloaded/unzipped
python scripts/kaggle_benchmark.py --data-dir ./data/PlantVillage --per-class 5

Outputs a per-class accuracy table plus benchmark_report.json.
"""
import argparse
import base64
import json
import os
import random
import re
import sys
import time
from pathlib import Path

import requests

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG"}
STOP = {"leaf", "leaves", "spot", "spots", "disease", "virus", "blight", "mold",
        "rot", "rust", "mildew", "scorch", "measles", "greening", "and", "of", "the"}


def parse_label(folder_name: str):
    """'Tomato___Late_blight' -> ('tomato', 'late blight'). Handles ' - ' and '_' variants."""
    raw = folder_name.replace("___", "|").replace("__", "|")
    if "|" not in raw:
        raw = raw.replace(" - ", "|", 1)
    parts = [p for p in raw.split("|") if p]
    plant = parts[0]
    disease = parts[1] if len(parts) > 1 else "healthy"
    clean = lambda s: re.sub(r"[^a-z ]", " ", s.replace("_", " ").lower()).strip()
    return clean(plant), re.sub(r"\s+", " ", clean(disease))


def tokens(text: str):
    return {t for t in re.sub(r"[^a-z ]", " ", (text or "").lower()).split() if len(t) > 2}


def is_match(true_disease: str, pred_disease: str, pred_healthy: bool):
    """Lenient token match — the model writes prose names, the dataset uses slugs."""
    true_healthy = "healthy" in true_disease
    if true_healthy or pred_healthy:
        return true_healthy == pred_healthy
    t, p = tokens(true_disease), tokens(pred_disease)
    if not t or not p:
        return False
    if t & p:
        return True
    # fall back to distinctive (non-generic) words only
    return bool((t - STOP) & (p - STOP))


def collect(data_dir: Path, per_class: int, max_classes: int, seed: int):
    classes = sorted([d for d in data_dir.rglob("*") if d.is_dir()
                      and any(f.suffix in IMG_EXT for f in d.iterdir() if f.is_file())])
    if not classes:
        sys.exit(f"No class folders with images found under {data_dir}")
    rng = random.Random(seed)
    rng.shuffle(classes)
    if max_classes:
        classes = classes[:max_classes]
    samples = []
    for c in sorted(classes):
        files = [f for f in c.iterdir() if f.suffix in IMG_EXT]
        rng.shuffle(files)
        samples += [(c.name, f) for f in files[:per_class]]
    return samples


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", help="local ImageFolder-style dataset root")
    ap.add_argument("--kaggle", help="kaggle dataset slug to download, e.g. emmarex/plantdisease")
    ap.add_argument("--api", default=os.environ.get("BENCH_API_URL", "http://localhost:8001"),
                    help="Verdaleaf backend base URL")
    ap.add_argument("--per-class", type=int, default=3)
    ap.add_argument("--max-classes", type=int, default=10, help="0 = all classes")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="benchmark_report.json")
    args = ap.parse_args()

    if args.kaggle:
        try:
            import kagglehub
        except ImportError:
            sys.exit("pip install kagglehub  (and put kaggle.json in ~/.kaggle/)")
        print(f"Downloading {args.kaggle} from Kaggle (first run can take a while)...")
        data_dir = Path(kagglehub.dataset_download(args.kaggle))
        print(f"  -> {data_dir}")
    elif args.data_dir:
        data_dir = Path(args.data_dir).expanduser()
    else:
        sys.exit("Pass either --data-dir or --kaggle")

    samples = collect(data_dir, args.per_class, args.max_classes, args.seed)
    print(f"Benchmarking {len(samples)} images against {args.api}/api/detect\n")

    per_class, rows = {}, []
    for i, (folder, path) in enumerate(samples, 1):
        plant, disease = parse_label(folder)
        b64 = base64.b64encode(path.read_bytes()).decode()
        t0 = time.time()
        try:
            r = requests.post(f"{args.api}/api/detect",
                              json={"image_base64": b64, "plant_hint": plant},
                              timeout=120)
            r.raise_for_status()
            d = r.json()
        except Exception as e:
            print(f"[{i}/{len(samples)}] {folder}: REQUEST FAILED {e}")
            rows.append({"folder": folder, "file": path.name, "error": str(e)})
            per_class.setdefault(folder, [0, 0])[1] += 1
            continue

        ok = is_match(disease, d.get("disease_name", ""), d.get("is_healthy", False))
        st = per_class.setdefault(folder, [0, 0])
        st[0] += int(ok)
        st[1] += 1
        rows.append({
            "folder": folder, "file": path.name,
            "expected_plant": plant, "expected_disease": disease,
            "predicted_plant": d.get("plant"), "predicted_disease": d.get("disease_name"),
            "predicted_healthy": d.get("is_healthy"), "confidence": d.get("confidence"),
            "severity": d.get("severity"), "match": ok,
            "latency_s": round(time.time() - t0, 2),
        })
        print(f"[{i}/{len(samples)}] {'HIT ' if ok else 'MISS'} {folder}"
              f"  ->  {d.get('disease_name')} ({d.get('confidence')}%)  {rows[-1]['latency_s']}s")

    hits = sum(r.get("match") is True for r in rows)
    total = len(rows)
    print("\n--- per-class accuracy ---")
    for folder, (h, n) in sorted(per_class.items()):
        print(f"  {h}/{n}  {100*h/n:5.1f}%  {folder}")
    print(f"\nTop-1 disease accuracy: {hits}/{total} = {100*hits/max(total,1):.1f}%")

    Path(args.out).write_text(json.dumps({
        "dataset": args.kaggle or str(data_dir),
        "api": args.api,
        "images": total,
        "hits": hits,
        "accuracy_pct": round(100 * hits / max(total, 1), 2),
        "per_class": {k: {"hits": v[0], "total": v[1]} for k, v in per_class.items()},
        "results": rows,
    }, indent=2))
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
