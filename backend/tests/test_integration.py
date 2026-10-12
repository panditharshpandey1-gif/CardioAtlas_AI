"""
CardioVision AI - Integration Test Suite
Verified with pytest test discovery.
"""

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

ENDPOINTS = [
    ("GET", "/api/health", None),
    ("GET", "/api/model-metrics", None),
    ("GET", "/api/sample-patients", None),
    ("GET", "/api/sample-patients?include_outcome=true", None),
    ("POST", "/api/predict", {
        "age": 62.0, "sex": 1.0, "cp": 0.0, "trestbps": 164.0, "chol": 288.0,
        "fbs": 1.0, "restecg": 1.0, "thalach": 122.0, "exang": 1.0,
        "oldpeak": 2.6, "slope": 2.0, "ca": 2.0, "thal": 3.0
    }),
    ("POST", "/api/explain", {
        "age": 62.0, "sex": 1.0, "cp": 0.0, "trestbps": 164.0, "chol": 288.0,
        "fbs": 1.0, "restecg": 1.0, "thalach": 122.0, "exang": 1.0,
        "oldpeak": 2.6, "slope": 2.0, "ca": 2.0, "thal": 3.0
    }),
    ("POST", "/api/what-if", {
        "baseline": {
            "age": 62.0, "sex": 1.0, "cp": 0.0, "trestbps": 164.0, "chol": 288.0,
            "fbs": 1.0, "restecg": 1.0, "thalach": 122.0, "exang": 1.0,
            "oldpeak": 2.6, "slope": 2.0, "ca": 2.0, "thal": 3.0
        },
        "modified": {
            "age": 62.0, "sex": 1.0, "cp": 0.0, "trestbps": 130.0, "chol": 210.0,
            "fbs": 1.0, "restecg": 1.0, "thalach": 122.0, "exang": 1.0,
            "oldpeak": 2.6, "slope": 2.0, "ca": 2.0, "thal": 3.0
        }
    }),
    ("GET", "/api/coronary-anatomy", None),
]


def test_integration_all_endpoints():
    """Verify that every API endpoint responds with success."""
    for method, path, payload in ENDPOINTS:
        if method == "GET":
            r = client.get(path)
        else:
            r = client.post(path, json=payload)
        assert r.is_success, f"Endpoint {path} failed: {r.text}"


def test_integration_cors_headers():
    """Verify CORS preflight and access control headers on all origins."""
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:3000",
    ]
    for origin in origins:
        r = client.options("/api/predict", headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        })
        assert r.status_code == 200
        assert r.headers.get("access-control-allow-origin") == origin
        assert r.headers.get("access-control-allow-credentials") == "true"


def test_integration_validation_error_schema():
    """Verify 422 validation response schema with detail list."""
    err_res = client.post("/api/predict", json={"age": 5.0, "chol": 50.0})
    assert err_res.status_code == 422
    err_data = err_res.json()
    assert isinstance(err_data.get("detail"), list)
    assert len(err_data["detail"]) > 0
    for item in err_data["detail"]:
        assert "loc" in item
        assert "msg" in item
