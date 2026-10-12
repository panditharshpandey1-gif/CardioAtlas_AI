import os
import json
import pytest
import joblib
from fastapi.testclient import TestClient

from main import app
from train_eval import METRICS_PATH, ARTIFACTS_PATH

client = TestClient(app)

VALID_PATIENT = {
    "age": 62.0,
    "sex": 1.0,
    "cp": 0.0,
    "trestbps": 164.0,
    "chol": 288.0,
    "fbs": 1.0,
    "restecg": 1.0,
    "thalach": 122.0,
    "exang": 1.0,
    "oldpeak": 2.6,
    "slope": 2.0,
    "ca": 2.0,
    "thal": 3.0
}

INVALID_PATIENT = {
    "age": 10.0,  # Below ge=18 bound
    "sex": 5.0,   # Above le=1 bound
    "cp": 9.0,    # Above le=3 bound
    "trestbps": 350.0, # Above le=220 bound
    "chol": 50.0, # Below ge=100 bound
}

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["dataset"] == "UCI Heart Disease (Cleveland)"
    assert data["n_rows"] == 303
    assert data["model_version"].startswith("cardiovision-")

def test_model_metrics_endpoint_and_ranges():
    assert os.path.exists(METRICS_PATH)
    response = client.get("/api/model-metrics")
    assert response.status_code == 200
    data = response.json()
    
    # Dataset metadata
    assert data["dataset"]["n_rows"] == 303
    assert data["dataset"]["n_train"] == 242
    assert data["dataset"]["n_test"] == 61
    assert 0.0 <= data["dataset"]["positive_rate"] <= 1.0
    assert data["threshold"] == 0.5
    
    # CV metrics
    assert len(data["cv"]) == 4
    for cv_m in data["cv"]:
        for metric in ["roc_auc", "pr_auc", "accuracy", "precision", "sensitivity", "specificity", "f1", "brier"]:
            assert 0.0 <= cv_m[metric]["mean"] <= 1.0
            assert 0.0 <= cv_m[metric]["std"] <= 1.0
            
    # Test metrics
    assert len(data["test"]) == 4
    for tm in data["test"]:
        for metric in ["roc_auc", "pr_auc", "accuracy", "precision", "sensitivity", "specificity", "f1", "brier"]:
            assert 0.0 <= tm[metric]["value"] <= 1.0
            assert 0.0 <= tm[metric]["ci_low"] <= 1.0
            assert 0.0 <= tm[metric]["ci_high"] <= 1.0
            assert tm[metric]["ci_low"] <= tm[metric]["ci_high"]
        cm = tm["confusion_matrix"]
        assert cm["tp"] + cm["fp"] + cm["tn"] + cm["fn"] == 61
            
    # Calibration
    assert data["calibration"]["method"] == "sigmoid"
    assert len(data["calibration"]["bins"]) == 5
    for b in data["calibration"]["bins"]:
        assert 0.0 <= b["mean_predicted"] <= 1.0
        assert 0.0 <= b["fraction_positive"] <= 1.0
        assert b["n"] >= 0
        
    # Limitations
    assert len(data["limitations"]) == 4

def test_sample_patients_are_from_test_split():
    artifacts = joblib.load(ARTIFACTS_PATH)
    test_idx = set(artifacts["test_idx"])
    
    # Default without true outcome
    res = client.get("/api/sample-patients")
    assert res.status_code == 200
    cases = res.json()
    assert len(cases) == 4
    
    for i, case in enumerate(cases):
        assert case["name"] == f"Test case {i+1}"
        assert case["dataset_row"] in test_idx, f"Row {case['dataset_row']} not in test split!"
        assert "outcome" not in case
        assert "Test case" in case["name"]
        assert len(case["data"]) == 13

    # With outcome explicitly requested
    res_with_out = client.get("/api/sample-patients?include_outcome=true")
    assert res_with_out.status_code == 200
    cases_with_out = res_with_out.json()
    for case in cases_with_out:
        assert "outcome" in case
        assert case["outcome"] in [0, 1]
        assert "ensemble_score" in case

def test_predict_endpoint_valid_and_invalid():
    # Valid
    res = client.post("/api/predict", json=VALID_PATIENT)
    assert res.status_code == 200
    pred = res.json()
    assert 0.0 <= pred["risk_score"] <= 100.0
    assert pred["risk_tier"] in ["Low", "Moderate", "High", "Very high"]
    assert pred["clinical_recommendation"].startswith(f"Model score band: {pred['risk_tier']}.")
    assert "confidence_interval" in pred
    assert len(pred["confidence_interval"]) == 2
    assert pred["confidence_interval"][0] <= pred["confidence_interval"][1]
    assert "model_breakdown" in pred
    for k in ["ensemble", "gradient_boosting", "random_forest", "logistic_regression"]:
        assert 0.0 <= pred["model_breakdown"][k] <= 100.0
        
    # Invalid input returns 422
    res_inv = client.post("/api/predict", json=INVALID_PATIENT)
    assert res_inv.status_code == 422

    # String "nan", "inf", "-inf"
    for bad_str in ["nan", "inf", "-inf"]:
        nan_patient = dict(VALID_PATIENT)
        nan_patient["chol"] = bad_str
        res_nan = client.post("/api/predict", json=nan_patient)
        assert res_nan.status_code == 422

    # Raw non-standard JSON literals
    raw_payload = json.dumps(VALID_PATIENT).replace('"chol": 288.0', '"chol": NaN')
    res_raw = client.post(
        "/api/predict",
        content=raw_payload,
        headers={"Content-Type": "application/json"}
    )
    assert res_raw.status_code == 422

def test_explain_endpoint_valid_and_invalid():
    res = client.post("/api/explain", json=VALID_PATIENT)
    assert res.status_code == 200
    exp = res.json()
    assert "feature_contributions" in exp
    assert len(exp["feature_contributions"]) == 13
    for c in exp["feature_contributions"]:
        assert "contribution" in c
        assert "shap_value" in c
        assert c["contribution"] == c["shap_value"]
        assert "importance_magnitude" in c
        
    # Invalid input returns 422
    res_inv = client.post("/api/explain", json=INVALID_PATIENT)
    assert res_inv.status_code == 422

def test_root_endpoint():
    res = client.get("/")
    assert res.status_code == 200
    data = res.json()
    assert data["project"] == "CardioVision AI"
    assert data["status"] == "online"
    assert "documentation" in data


def test_coronary_anatomy_endpoint():
    res = client.get("/api/coronary-anatomy")
    assert res.status_code == 200
    data = res.json()
    assert "disclaimer" in data
    assert "arteries" in data
    artery_ids = [a["id"] for a in data["arteries"]]
    assert "LAD" in artery_ids
    assert "RCA" in artery_ids
    assert "LCX" in artery_ids


def test_predict_categorical_validation_and_edges():
    # Fractional categorical values must be rejected
    invalid_categorical_cases = [
        {"cp": 1.5},
        {"sex": 0.5},
        {"thal": 2.5},
        {"fbs": 0.2},
        {"ca": 1.7},
        {"slope": 0.5},
        {"restecg": 1.3},
    ]
    for override in invalid_categorical_cases:
        bad_patient = dict(VALID_PATIENT)
        bad_patient.update(override)
        res = client.post("/api/predict", json=bad_patient)
        assert res.status_code == 422, f"Expected 422 for invalid categorical {override}, got {res.status_code}"

    # Boundary continuous values should succeed
    for age in [18.0, 100.0]:
        boundary_p = dict(VALID_PATIENT, age=age)
        res = client.post("/api/predict", json=boundary_p)
        assert res.status_code == 200

    for bp in [80.0, 220.0]:
        boundary_p = dict(VALID_PATIENT, trestbps=bp)
        res = client.post("/api/predict", json=boundary_p)
        assert res.status_code == 200


def test_what_if_endpoint_valid_and_invalid():
    modified = dict(VALID_PATIENT)
    modified["trestbps"] = 120.0
    modified["chol"] = 200.0
    
    res = client.post("/api/what-if", json={"baseline": VALID_PATIENT, "modified": modified})
    assert res.status_code == 200
    wi = res.json()
    assert "baseline_score" in wi
    assert "simulated_score" in wi
    assert "risk_delta" in wi
    assert "modified_parameters" in wi
    assert "trestbps" in wi["modified_parameters"]
    assert "chol" in wi["modified_parameters"]
    
    # Invalid input returns 422
    res_inv = client.post("/api/what-if", json={"baseline": INVALID_PATIENT, "modified": modified})
    assert res_inv.status_code == 422


def test_what_if_unchanged_inputs_produce_zero_delta():
    # Exact same baseline and modified must return 0.0 delta and "unchanged" direction
    res = client.post("/api/what-if", json={"baseline": VALID_PATIENT, "modified": VALID_PATIENT})
    assert res.status_code == 200
    wi = res.json()
    assert wi["risk_delta"] == 0.0
    assert wi["impact_direction"] == "unchanged"
    assert wi["baseline_score"] == wi["simulated_score"]
    assert len(wi["modified_parameters"]) == 0


def test_explain_endpoint_attribution_metadata():
    res = client.post("/api/explain", json=VALID_PATIENT)
    assert res.status_code == 200
    exp = res.json()
    assert exp["method"] == "marginal_baseline_perturbation"
    assert "marginal" in exp["method_description"].lower()
    assert "base_value" in exp
    assert "predicted_value" in exp
    assert "total_delta" in exp
    assert len(exp["feature_contributions"]) == 13
    assert len(exp["top_risk_drivers"]) > 0


def test_coronary_anatomy_structure_and_counts():
    res = client.get("/api/coronary-anatomy")
    assert res.status_code == 200
    data = res.json()
    assert "arteries" in data
    assert len(data["arteries"]) == 3
    for art in data["arteries"]:
        assert "id" in art
        assert "name" in art
        assert "nickname" in art
        assert "typical_territory" in art
        assert "clinical_impact" in art
    artery_ids = [a["id"] for a in data["arteries"]]
    assert set(artery_ids) == {"LAD", "RCA", "LCX"}



def test_cors_preflight_and_headers():
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:3000",
    ]
    for origin in origins:
        # Preflight OPTIONS request
        options_res = client.options(
            "/api/predict",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type",
            }
        )
        assert options_res.status_code == 200
        assert options_res.headers.get("access-control-allow-origin") == origin
        assert "POST" in options_res.headers.get("access-control-allow-methods", "")

        # Actual GET request with Origin
        get_res = client.get(
            "/api/health",
            headers={"Origin": origin}
        )
        assert get_res.status_code == 200
        assert get_res.headers.get("access-control-allow-origin") == origin


def test_predict_null_or_invalid_fields_returns_422():
    """Verify that null or invalid field types produce 422 Unprocessable Entity."""
    res_null = client.post("/api/predict", json={"age": None})
    assert res_null.status_code == 422
    data = res_null.json()
    assert "detail" in data
    assert len(data["detail"]) > 0


def test_what_if_intervention_simulation_direction():
    """Verify that improving cardiovascular risk factors projects reduced risk score."""
    base = dict(VALID_PATIENT)
    improved = dict(VALID_PATIENT)
    improved["trestbps"] = 118.0
    improved["chol"] = 175.0
    improved["oldpeak"] = 0.2

    res = client.post("/api/what-if", json={"baseline": base, "modified": improved})
    assert res.status_code == 200
    data = res.json()
    assert "baseline_score" in data
    assert "simulated_score" in data
    assert "risk_delta" in data
    assert data["risk_delta"] <= 0.0
    assert data["impact_direction"] in ["improved", "unchanged"]
    assert "clinical_notes" in data
    assert "trestbps" in data["modified_parameters"]
    assert "chol" in data["modified_parameters"]
    assert "oldpeak" in data["modified_parameters"]


def test_predict_confidence_intervals_and_breakdown_consistency():
    """Verify confidence interval bounds and model agreement breakdown."""
    res = client.post("/api/predict", json=VALID_PATIENT)
    assert res.status_code == 200
    data = res.json()
    ci = data["confidence_interval"]
    assert len(ci) == 2
    assert ci[0] <= ci[1]
    assert ci[0] <= data["risk_score"] <= ci[1] or abs(data["risk_score"] - ci[0]) < 10.0
    breakdown = data["model_breakdown"]
    assert "ensemble" in breakdown
    assert "gradient_boosting" in breakdown
    assert "random_forest" in breakdown
    assert "logistic_regression" in breakdown


