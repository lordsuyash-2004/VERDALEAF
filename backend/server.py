from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Query
from fastapi.responses import JSONResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import base64
import json
import logging
from collections import Counter
import uuid
import re
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, timezone, timedelta
import httpx

from google import genai
from google.genai import types

from pdf_report import build_report_pdf
import weather

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

GEMINI_API_KEY = os.environ['GEMINI_API_KEY']
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-3-flash-preview')
gemini = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


LANGUAGES = {"en": "English", "hi": "Hindi", "kn": "Kannada"}


class DetectRequest(BaseModel):
    image_base64: str
    plant_hint: Optional[str] = None
    language: Literal["en", "hi", "kn"] = "en"


class Detection(BaseModel):
    id: str
    user_id: Optional[str] = None
    disease_name: str
    plant: str
    is_healthy: bool
    confidence: int  # 0-100
    severity: str  # low | moderate | severe
    severity_score: int  # 0-100
    symptoms: List[str]
    treatments: List[str]
    prevention: List[str]
    image_data_url: str
    created_at: datetime


# ---------- Auth helpers ----------
async def get_current_user(request: Request) -> Optional[User]:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    if not session_token:
        return None
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        return None
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        return None
    return User(**user_doc)


# ---------- Auth Routes ----------
@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")

    async with httpx.AsyncClient() as http_client:
        r = await http_client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=15,
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = r.json()

    email = data["email"]
    name = data.get("name", email)
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )
    return {"user_id": user_id, "email": email, "name": name, "picture": picture}


@api_router.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user.model_dump()


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------- Detection ----------
DETECT_SYSTEM_PROMPT = """You are an expert plant pathologist and agronomist. You analyze photos of plant leaves and return a strict JSON diagnosis.

Rules:
- Only respond with a single JSON object. No prose, no markdown fences.
- If the image is not a plant/leaf, set is_healthy=false, disease_name="Not a plant image", plant="Unknown", confidence=0, severity="low", severity_score=0, and put a short explanation in symptoms.
- If the leaf looks healthy, set is_healthy=true, disease_name="Healthy leaf".
- Otherwise identify the most likely disease.

Return JSON with this exact schema:
{
  "plant": "common plant name (e.g. Tomato, Rose, Wheat)",
  "disease_name": "specific disease name (e.g. Early Blight)",
  "is_healthy": boolean,
  "confidence": integer 0-100,
  "severity": "low" | "moderate" | "severe",
  "severity_score": integer 0-100,
  "symptoms": ["short bullet", ...] (2-4 items),
  "treatments": ["actionable treatment step", ...] (3-5 items),
  "prevention": ["prevention tip", ...] (3-5 items),
  "plant_en": "plant name in English",
  "disease_name_en": "disease name in English"
}

Language: the user message states the output language. Write plant, disease_name, symptoms, treatments
and prevention in that language using its native script (Devanagari for Hindi, Kannada script for Kannada),
in simple words a farmer understands. Keep chemical / product names readable (you may add the English
name in brackets). JSON keys, "severity" values and "plant_en" / "disease_name_en" ALWAYS stay in English.
"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        text = match.group(0)
    return json.loads(text)


def _clamp_int(v, lo: int = 0, hi: int = 100) -> int:
    try:
        return max(lo, min(hi, int(round(float(v)))))
    except (TypeError, ValueError):
        return 0


@api_router.post("/detect")
async def detect(request: Request, payload: DetectRequest):
    user = await get_current_user(request)
        # Split off the data-URL header so we keep the real MIME type
    mime = "image/jpeg"
    image_b64 = payload.image_base64.strip()
    if image_b64.startswith("data:") and "," in image_b64:
        header, image_b64 = image_b64.split(",", 1)
        mime = header[5:].split(";")[0] or mime

    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    user_text = "Analyze this leaf photo and return the JSON diagnosis."
    if payload.plant_hint:
        user_text += f" Plant hint provided by user: {payload.plant_hint}."
    user_text += f" Output language: {LANGUAGES[payload.language]}."

    try:
        response = await gemini.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime), user_text],
            config=types.GenerateContentConfig(
                system_instruction=DETECT_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
    except Exception as e:
        logging.exception("Gemini call failed")
        msg = str(e)
        if "RESOURCE_EXHAUSTED" in msg or "429" in msg[:20]:
            # Free-tier Gemini keys allow a limited number of scans per day.
            raise HTTPException(
                status_code=429,
                detail="Daily AI scan limit reached for this Gemini key. Please try again later.",
            )
        # NOTE: avoid 502 here - the ingress replaces 502 bodies with an HTML page.
        raise HTTPException(status_code=500, detail="AI service is temporarily unavailable. Please try again.")

    raw_text = response.text or ""

    try:
        parsed = _extract_json(raw_text)
    except Exception:
        logging.error("Could not parse AI response: %s", raw_text)
        raise HTTPException(status_code=500, detail="Could not parse AI response")

    severity = str(parsed.get("severity", "low")).strip().lower()
    if severity not in ("low", "moderate", "severe"):
        severity = "low"

    det_id = f"det_{uuid.uuid4().hex[:16]}"
    image_data_url = f"data:{mime};base64,{image_b64}"
    detection = {
        "id": det_id,
        "user_id": user.user_id if user else None,
        "plant": parsed.get("plant", "Unknown"),
        "disease_name": parsed.get("disease_name", "Unknown"),
        "is_healthy": bool(parsed.get("is_healthy", False)),
        "confidence": _clamp_int(parsed.get("confidence")),
        "severity": severity,
        "severity_score": _clamp_int(parsed.get("severity_score")),
        "symptoms": parsed.get("symptoms", []),
        "treatments": parsed.get("treatments", []),
        "prevention": parsed.get("prevention", []),
        "plant_en": parsed.get("plant_en") or parsed.get("plant", "Unknown"),
        "disease_name_en": parsed.get("disease_name_en") or parsed.get("disease_name", "Unknown"),
        "language": payload.language,
        "image_data_url": image_data_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    if user:
        await db.detections.insert_one({**detection})

    return detection


@api_router.get("/history")
async def history(request: Request, q: str = "", status: str = "all", limit: int = 24, skip: int = 0):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Sign in to view history")

    query = {"user_id": user.user_id}
    if status == "healthy":
        query["is_healthy"] = True
    elif status == "diseased":
        query["is_healthy"] = False
    if q:
        query["$or"] = [
            {field: {"$regex": re.escape(q[:80]), "$options": "i"}}
            for field in ("disease_name", "plant", "disease_name_en", "plant_en")
        ]

    total = await db.detections.count_documents(query)
    limit = max(1, min(limit, 60))
    items = (
        await db.detections.find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip(max(0, skip))
        .limit(limit)
        .to_list(limit)
    )
    return {"items": items, "total": total}


@api_router.get("/history/stats")
async def history_stats(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Sign in to view history")

    docs = await db.detections.find(
        {"user_id": user.user_id},
        {"_id": 0, "is_healthy": 1, "disease_name": 1, "disease_name_en": 1, "severity": 1, "plant": 1, "plant_en": 1, "created_at": 1},
    ).to_list(1000)

    healthy = sum(1 for d in docs if d.get("is_healthy"))
    severe = sum(1 for d in docs if not d.get("is_healthy") and d.get("severity") == "severe")
    issues = Counter(d.get("disease_name_en") or d.get("disease_name") for d in docs
                     if not d.get("is_healthy") and (d.get("disease_name_en") or d.get("disease_name")))
    plants = Counter(d.get("plant_en") or d.get("plant") for d in docs if d.get("plant_en") or d.get("plant"))
    dates = [
        d["created_at"].isoformat() if isinstance(d.get("created_at"), datetime) else str(d["created_at"])
        for d in docs if d.get("created_at")
    ]
    last = max(dates) if dates else None

    return {
        "total": len(docs),
        "healthy": healthy,
        "diseased": len(docs) - healthy,
        "severe": severe,
        "top_issue": issues.most_common(1)[0][0] if issues else None,
        "top_issue_count": issues.most_common(1)[0][1] if issues else 0,
        "top_plant": plants.most_common(1)[0][0] if plants else None,
        "plants_tracked": len(plants),
        "last_scan_at": last.isoformat() if hasattr(last, "isoformat") else last,
    }


@api_router.delete("/history/{det_id}")
async def delete_detection(det_id: str, request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    result = await db.detections.delete_one({"id": det_id, "user_id": user.user_id})
    return {"deleted": result.deleted_count}


# ---------- PDF Report ----------
class ReportRequest(BaseModel):
    id: Optional[str] = None
    disease_name: str
    plant: str = "Unknown"
    is_healthy: bool = False
    confidence: int = 0
    severity: str = "low"
    severity_score: int = 0
    symptoms: List[str] = []
    treatments: List[str] = []
    prevention: List[str] = []
    image_data_url: Optional[str] = None
    created_at: Optional[str] = None
    language: Optional[str] = "en"
    disease_name_en: Optional[str] = None
    plant_en: Optional[str] = None


@api_router.post("/report/pdf")
async def report_pdf(payload: ReportRequest):
    try:
        pdf_bytes = build_report_pdf(payload.model_dump())
    except Exception:
        logging.exception("PDF generation failed")
        raise HTTPException(status_code=500, detail="Could not generate PDF report")

    safe_name = re.sub(r"[^a-zA-Z0-9]+", "-", payload.disease_name_en or payload.disease_name).strip("-").lower() or "diagnosis"
    filename = f"verdaleaf-{safe_name}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------- Static content: diseases + tips ----------
DISEASE_LIBRARY = [
    {
        "id": "early-blight",
        "name": "Early Blight",
        "plant": "Tomato / Potato",
        "type": "Fungal",
        "severity": "moderate",
        "symptoms": "Concentric dark rings on lower leaves, yellow halos, leaf drop.",
        "treatment": "Prune infected leaves, apply copper fungicide, rotate crops next season.",
        "image": "https://images.pexels.com/photos/34234358/pexels-photo-34234358.jpeg",
    },
    {
        "id": "powdery-mildew",
        "name": "Powdery Mildew",
        "plant": "Cucurbits / Roses",
        "type": "Fungal",
        "severity": "moderate",
        "symptoms": "White powdery coating on leaf surface, distorted new growth.",
        "treatment": "Milk-water spray (1:9), neem oil, improve airflow around plants.",
        "image": "https://images.unsplash.com/photo-1580133318324-f2f76d987dd8",
    },
    {
        "id": "leaf-rust",
        "name": "Leaf Rust",
        "plant": "Wheat / Beans / Roses",
        "type": "Fungal",
        "severity": "severe",
        "symptoms": "Orange-brown pustules on undersides, yellow spots above.",
        "treatment": "Remove infected foliage, apply sulfur-based fungicide, avoid overhead watering.",
        "image": "https://images.pexels.com/photos/2974409/pexels-photo-2974409.jpeg",
    },
    {
        "id": "bacterial-spot",
        "name": "Bacterial Leaf Spot",
        "plant": "Peppers / Tomatoes",
        "type": "Bacterial",
        "severity": "severe",
        "symptoms": "Water-soaked spots turning brown, tattered leaf edges.",
        "treatment": "Copper-based bactericide, remove infected plants, sanitize tools.",
        "image": "https://images.pexels.com/photos/34234358/pexels-photo-34234358.jpeg",
    },
    {
        "id": "mosaic-virus",
        "name": "Mosaic Virus",
        "plant": "Tobacco / Tomato / Cucumber",
        "type": "Viral",
        "severity": "severe",
        "symptoms": "Mottled yellow-green pattern, stunted growth, curled leaves.",
        "treatment": "No cure — remove and destroy infected plants, control aphid vectors.",
        "image": "https://images.pexels.com/photos/2974409/pexels-photo-2974409.jpeg",
    },
    {
        "id": "downy-mildew",
        "name": "Downy Mildew",
        "plant": "Grapes / Lettuce / Basil",
        "type": "Oomycete",
        "severity": "moderate",
        "symptoms": "Yellow patches upper side, fuzzy gray growth beneath.",
        "treatment": "Copper fungicide, prune for airflow, water at soil level only.",
        "image": "https://images.unsplash.com/photo-1580133318324-f2f76d987dd8",
    },
]

CARE_TIPS = [
    {
        "id": "watering",
        "title": "Water at the base",
        "body": "Wet foliage invites fungal spores. Water early morning at soil level so leaves stay dry through the night.",
        "image": "https://images.unsplash.com/photo-1515150144380-bca9f1650ed9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAxODF8MHwxfHNlYXJjaHwxfHxnYXJkZW4lMjBwbGFudCUyMGNhcmUlMjBuYXR1cmV8ZW58MHx8fHwxNzg1NDA0NTMxfDA&ixlib=rb-4.1.0&q=85",
    },
    {
        "id": "airflow",
        "title": "Give plants breathing room",
        "body": "Space plants generously and prune inner branches. Good airflow dries leaves quickly and starves pathogens.",
        "image": "https://images.pexels.com/photos/10894359/pexels-photo-10894359.jpeg",
    },
    {
        "id": "rotate",
        "title": "Rotate crop families",
        "body": "Never plant the same family in the same spot two years running. Rotation breaks the life cycle of soil-borne disease.",
        "image": "https://images.unsplash.com/photo-1580133318324-f2f76d987dd8",
    },
    {
        "id": "sanitize",
        "title": "Sanitize your tools",
        "body": "Wipe pruners with isopropyl alcohol between plants. A single infected cut can carry bacterial spot across the garden.",
        "image": "https://images.pexels.com/photos/34234358/pexels-photo-34234358.jpeg",
    },
    {
        "id": "inspect",
        "title": "Weekly leaf check",
        "body": "Turn leaves over and inspect stems every week. Catching disease early is the single biggest predictor of recovery.",
        "image": "https://images.pexels.com/photos/2974409/pexels-photo-2974409.jpeg",
    },
    {
        "id": "mulch",
        "title": "Mulch bare soil",
        "body": "A 2-inch mulch layer prevents rain from splashing soil-borne spores up onto lower leaves.",
        "image": "https://images.pexels.com/photos/10894359/pexels-photo-10894359.jpeg",
    },
]


@api_router.get("/diseases")
async def get_diseases():
    return DISEASE_LIBRARY


@api_router.get("/tips")
async def get_tips():
    return CARE_TIPS


@api_router.get("/weather/geocode")
async def weather_geocode(q: str = Query(..., min_length=2, max_length=80)):
    return await weather.geocode(q.strip())


@api_router.get("/weather/risk")
async def weather_risk(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180)):
    return await weather.disease_risk(lat, lon)


@api_router.get("/")
async def root():
    return {"message": "Plant Disease Detection API", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["https://verdaleaf-1.onrender.com", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
