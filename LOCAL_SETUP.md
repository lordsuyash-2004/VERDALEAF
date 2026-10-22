# Verdaleaf — Run Locally

## 1. Prerequisites
- Python 3.11+
- Node.js 20+ and Yarn 1.22 (`npm i -g yarn`)
- MongoDB running locally (Community Server) or a free MongoDB Atlas cluster

Check:
```bash
python3 --version && node -v && yarn -v && mongod --version
```

## 2. Get the code
Use the "Save to GitHub" button in the Emergent chat, then:
```bash
git clone <your-repo-url> verdaleaf
cd verdaleaf
```
(Or use "Download code" and unzip.)

## 3. Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=verdaleaf
CORS_ORIGINS=http://localhost:3000
EMERGENT_LLM_KEY=<copy the value from the Emergent backend/.env>
```
Notes:
- `EMERGENT_LLM_KEY` powers the Gemini 3 Flash vision call. Copy it from this project's
  `backend/.env`. It draws on your Emergent Universal Key balance (Profile → Manage plan →
  Universal Key). Alternatively, swap in your own provider key and adjust the LlmChat call.
- With Atlas, use the full `mongodb+srv://...` string as `MONGO_URL`.

Run it:
```bash
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Verify: http://localhost:8001/docs

## 4. Frontend
```bash
cd ../frontend
yarn install
```

Create `frontend/.env`:
```
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=3000
```
Run it:
```bash
yarn start
```
Open http://localhost:3000

## 5. Google login on localhost
Login redirects to `https://auth.emergentagent.com/?redirect=http://localhost:3000/dashboard`,
which works locally. But the session cookie is issued as `Secure; SameSite=None`, which some
browsers reject over plain `http`. If login loops back to the landing page, edit
`backend/server.py` (~line 138) for local dev only:
```python
response.set_cookie(
    key="session_token",
    value=session_token,
    httponly=True,
    secure=False,        # local http
    samesite="lax",      # local http
    max_age=7 * 24 * 60 * 60,
    path="/",
)
```
Revert these two lines before deploying (production needs `secure=True`, `samesite="none"`).

## 6. Common issues
| Symptom | Fix |
|---|---|
| `KeyError: 'MONGO_URL'` | `backend/.env` missing or not next to `server.py` |
| CORS error in console | add `http://localhost:3000` to `CORS_ORIGINS`, restart backend |
| `pip install reportlab` fails | upgrade pip: `pip install -U pip setuptools wheel` |
| Diagnosis returns 500 | invalid/empty `EMERGENT_LLM_KEY` or zero key balance — check backend terminal logs |
| Port 8001 in use | run on another port and update `REACT_APP_BACKEND_URL` to match |

## 7. Production build (optional)
```bash
cd frontend && yarn build      # static files in frontend/build
cd ../backend && uvicorn server:app --host 0.0.0.0 --port 8001
```
Serve `frontend/build` with any static host (Nginx, Vercel, Netlify) and point
`REACT_APP_BACKEND_URL` at your deployed backend URL.
