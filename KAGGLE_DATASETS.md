# Using Kaggle Datasets (Plant Disease)

## 1. Get your Kaggle API token
1. Sign in at https://www.kaggle.com
2. Click your avatar → **Settings** → scroll to **API** → **Create New Token**
3. A `kaggle.json` file downloads. It looks like:
   `{"username":"yourname","key":"xxxxxxxxxxxxxxxx"}`

Place it where the CLI expects it:
```bash
mkdir -p ~/.kaggle
mv ~/Downloads/kaggle.json ~/.kaggle/kaggle.json
chmod 600 ~/.kaggle/kaggle.json     # required, else the CLI warns/refuses
```
Windows path: `C:\Users\<you>\.kaggle\kaggle.json`

Alternative (no file, good for servers/CI) — set env vars:
```bash
export KAGGLE_USERNAME=yourname
export KAGGLE_KEY=xxxxxxxxxxxxxxxx
```

## 2. Install the CLI
```bash
pip install kaggle
kaggle --version
```

## 3. Find and download datasets
```bash
kaggle datasets list -s "plant disease"          # search
kaggle datasets files vipoooool/new-plant-diseases-dataset   # inspect before downloading
kaggle datasets download -d vipoooool/new-plant-diseases-dataset -p ./data --unzip
```
Flags worth knowing:
- `-p ./data` → destination folder
- `--unzip` → auto-extract
- `-f filename.csv` → download a single file instead of the whole archive
- Competitions use a different command: `kaggle competitions download -c plant-pathology-2021-fgvc8`
  (you must click "Join Competition" / accept the rules on the website first, or you get a 403)

## 4. Python instead of CLI (recommended for notebooks)
```bash
pip install kagglehub
```
```python
import kagglehub
path = kagglehub.dataset_download("abdallahalidev/plantvillage-dataset")
print(path)   # local cache dir containing the extracted images
```

## 5. Good plant-disease datasets
| Dataset | Slug | Notes |
|---|---|---|
| PlantVillage (full, color/grayscale/segmented) | `abdallahalidev/plantvillage-dataset` | ~54k leaf images, 38 classes — the classic benchmark |
| PlantVillage (simple split) | `emmarex/plantdisease` | Smaller, easy folder-per-class layout |
| New Plant Diseases (augmented) | `vipoooool/new-plant-diseases-dataset` | Pre-split train/valid, ~87k images |
| PlantDoc | `nirmalsankalana/plantdoc-dataset` | Real-world in-field photos (harder, more realistic) |
| Cassava Leaf Disease | competition `cassava-leaf-disease-classification` | 21k field images, noisy labels |
| Rice Leaf Diseases | `vbookshelf/rice-leaf-diseases` | Small, crop-specific |

Typical layout after unzip:
```
data/
└── PlantVillage/
    ├── Tomato___Late_blight/      *.jpg
    ├── Tomato___healthy/          *.jpg
    └── Apple___Apple_scab/        *.jpg
```
That folder-per-class structure plugs straight into
`torchvision.datasets.ImageFolder` or `tf.keras.utils.image_dataset_from_directory`.

## 6. Licensing
Check the **License** box on each dataset page before shipping anything derived from it.
PlantVillage is generally CC-BY / open for research; competition data is usually
**competition-use only** and must not be redistributed in your repo.

## 7. Ready-made benchmark script

`scripts/kaggle_benchmark.py` measures how accurate Verdaleaf actually is on real labelled data.
It reads any folder-per-class dataset, samples N images per class, POSTs each to `/api/detect`,
and prints per-class + overall top-1 accuracy.

```bash
pip install requests kagglehub

# A) let it pull from Kaggle (needs ~/.kaggle/kaggle.json)
python scripts/kaggle_benchmark.py --kaggle abdallahalidev/plantvillage-dataset \
    --per-class 3 --max-classes 8 --api http://localhost:8001

# B) use a folder you already unzipped
python scripts/kaggle_benchmark.py --data-dir ./data/PlantVillage --per-class 5 --max-classes 0
```
Sample output:
```
[1/24] HIT  Tomato___Late_blight  ->  Tomato Late Blight (91%)  6.2s
[2/24] MISS Apple___Apple_scab    ->  Cedar Apple Rust (74%)    5.8s
--- per-class accuracy ---
  3/3  100.0%  Tomato___Late_blight
  1/3   33.3%  Apple___Apple_scab
Top-1 disease accuracy: 19/24 = 79.2%
```
It also writes `benchmark_report.json` with every prediction, confidence and latency — drop that
straight into a project report. Options: `--per-class`, `--max-classes 0` (all classes),
`--seed`, `--out`, `--api`.

Cost warning: each image is one Gemini vision call against your Universal Key balance. Start with
`--per-class 2 --max-classes 5` (10 calls) before running a few hundred.

Label matching is deliberately lenient: PlantVillage uses slugs (`Tomato___Late_blight`) while the
model replies in prose ("Tomato Late Blight (Phytophthora infestans)"), so a hit is scored on
distinctive token overlap, and healthy-vs-diseased is compared directly.

## 8. How this relates to Verdaleaf
Verdaleaf currently diagnoses via the **Gemini 3 Flash vision model** (no local training, no
dataset needed). Kaggle data is useful for three different things:
- **Benchmarking**: run a few hundred labelled PlantVillage images through `/api/detect` and
  measure how often the predicted disease matches the folder label.
- **Seeding the Disease Library**: use the class list (38 crop/disease pairs) and sample images
  as real content for the encyclopedia instead of invented entries.
- **Training your own CNN**: fine-tune ResNet/EfficientNet and serve it alongside (or instead of)
  Gemini. This needs a GPU and a real training run — not something to do inside this preview
  container.
