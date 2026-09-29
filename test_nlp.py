import requests

tests = [
    "Show temperature at 100m",
    "Where does the model differ most from Argo?",
    "Show anomalous regions",
    "hi there",
]

for q in tests:
    try:
        r = requests.post("http://localhost:8000/api/nlp/ask", json={"query": q}, timeout=15)
        if r.ok:
            d = r.json()
            intent = d.get("intent", "?")
            source = d.get("source", "?")
            ans_preview = (d.get("answer", "") or "")[:60].replace("\n", " ")
            print(f"[{r.status_code}] {q[:38]:40s} intent={intent:25s} source={source}")
            print(f"       answer: {ans_preview}")
        else:
            print(f"[{r.status_code}] {q[:38]:40s} ERROR: {r.text[:100]}")
    except Exception as e:
        print(f"[EXC] {q[:38]:40s} {e}")
