# Verdaleaf — Plant Leaf Diagnosis App

## Problem Statement
Build a leaf diagnosis application that allows users to photograph plant leaves and receive AI-powered disease detection with multi-language support (English, Hindi, Kannada) and local weather-based disease risk alerts.

## Architecture
- **Frontend**: React + Tailwind CSS + Vite (port 3000)
- **Backend**: FastAPI + Motor (Async MongoDB) (port 8001)
- **AI**: Google Gemini SDK (vision model) for leaf disease detection
- **Weather**: Open-Meteo API (free, no key) for 3-day forecasts + disease risk scoring
- **PDF**: ReportLab + uharfbuzz for Indic script rendering

## Key Features Implemented
1. Leaf photo upload (drag-drop, file select, live camera)
2. AI-powered disease detection via Gemini (plant name, disease, severity, symptoms, treatments, prevention)
3. Multi-language support: English, Hindi, Kannada for diagnosis results
4. Weather-based disease risk (fungal, bacterial, heat stress) via Open-Meteo
5. Location picker: device GPS + city search (geocoding)
6. PDF report generation with correct Indic font shaping (uharfbuzz)
7. Disease encyclopedia (Library page)
8. Care tips page
9. Google OAuth sign-in
10. Graceful 429 quota error handling for Gemini API

## Key Files
- `/app/backend/server.py` — FastAPI routes (auth, detect, history, weather, PDF)
- `/app/backend/pdf_report.py` — ReportLab PDF with custom uharfbuzz shaping
- `/app/backend/weather.py` — Open-Meteo logic and risk scoring
- `/app/frontend/src/pages/Dashboard.jsx` — Main diagnose page
- `/app/frontend/src/components/WeatherRisk.jsx` — Weather risk widget

## API Endpoints
- `POST /api/detect` — Analyze leaf image (requires Gemini key)
- `GET /api/weather/risk?lat=&lon=` — Weather risk scores
- `GET /api/weather/geocode?q=` — City search
- `POST /api/report/pdf` — Generate localized PDF
- `GET /api/history` — Scan history
- `GET /api/diseases` — Disease encyclopedia
- `GET /api/tips` — Care tips

## DB Schema (scans collection)
`id`, `user_id`, `plant`, `plant_en`, `disease_name`, `disease_name_en`, `is_healthy`, `confidence`, `severity`, `severity_score`, `symptoms`, `treatments`, `prevention`, `language`, `image_data_url`, `created_at`

## Current Status (Oct 2026)
- All features functional
- Gemini API key updated and working
- Weather widget working (requires location selection)

## Backlog
- Scan history page
- Auto-request GPS on first visit for weather
- Share diagnosis as link/image
- Seasonal crop alerts
