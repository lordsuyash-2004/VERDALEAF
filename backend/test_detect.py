import base64, sys, requests

path = sys.argv[1]
b64 = base64.b64encode(open(path, "rb").read()).decode()
r = requests.post(
    "http://localhost:8001/api/detect",
    json={"image_base64": f"data:image/jpeg;base64,{b64}"},
    timeout=120,
)
print(r.status_code)
print(r.text[:1500])
