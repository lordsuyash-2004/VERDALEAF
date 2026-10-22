"""Seed a demo account + scan history so authenticated flows can be tested without Google OAuth."""
import asyncio
import base64
import os
import struct
import uuid
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parents[1] / "backend" / ".env")

USER_ID = "user_demo_qa"
EMAIL = "demo@verdaleaf.test"
SESSION_TOKEN = "qa-demo-session-token"

SCANS = [
    ("Tomato", "Early Blight", False, "severe", 78, 91),
    ("Tomato", "Healthy leaf", True, "low", 6, 97),
    ("Rose", "Black Spot", False, "moderate", 54, 88),
    ("Apple", "Apple Scab", False, "moderate", 47, 84),
    ("Basil", "Downy Mildew", False, "severe", 71, 90),
    ("Monstera", "Healthy leaf", True, "low", 4, 95),
    ("Grape", "Powdery Mildew", False, "low", 28, 82),
    ("Potato", "Late Blight", False, "severe", 83, 93),
]

COLORS = [(74, 103, 65), (120, 150, 90), (60, 90, 55), (100, 130, 80)]


def png_data_url(rgb, size=64):
    """Minimal solid-colour PNG so history cards have a real image to render."""
    raw = b"".join(b"\x00" + bytes(rgb) * size for _ in range(size))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )
    return "data:image/png;base64," + base64.b64encode(png).decode()


async def main():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    now = datetime.now(timezone.utc)

    await db.users.update_one(
        {"user_id": USER_ID},
        {"$set": {
            "user_id": USER_ID,
            "email": EMAIL,
            "name": "Demo Grower",
            "picture": None,
            "created_at": now.isoformat(),
        }},
        upsert=True,
    )

    await db.user_sessions.update_one(
        {"session_token": SESSION_TOKEN},
        {"$set": {
            "user_id": USER_ID,
            "session_token": SESSION_TOKEN,
            "expires_at": (now + timedelta(days=30)).isoformat(),
            "created_at": now.isoformat(),
        }},
        upsert=True,
    )

    await db.detections.delete_many({"user_id": USER_ID})
    docs = []
    for i, (plant, disease, healthy, severity, score, confidence) in enumerate(SCANS):
        docs.append({
            "id": str(uuid.uuid4()),
            "user_id": USER_ID,
            "plant": plant,
            "disease_name": disease,
            "is_healthy": healthy,
            "confidence": confidence,
            "severity": severity,
            "severity_score": score,
            "symptoms": ["Dark concentric lesions on lower leaves", "Yellow halo around spots"],
            "treatments": [
                "Remove and bin affected leaves — do not compost",
                "Apply a copper-based fungicide every 7 days",
                "Water at the base to keep foliage dry",
            ],
            "prevention": [
                "Rotate crops each season",
                "Mulch to stop soil splash",
                "Space plants for airflow",
            ],
            "image_data_url": png_data_url(COLORS[i % len(COLORS)]),
            "created_at": (now - timedelta(days=i * 3, hours=i)).isoformat(),
        })
    await db.detections.insert_many(docs)

    print(f"Seeded {len(docs)} scans for {EMAIL}")
    print(f"session_token cookie value: {SESSION_TOKEN}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
