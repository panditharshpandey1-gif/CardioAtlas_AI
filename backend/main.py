"""
CardioVision AI - FastAPI Backend
REST API providing real-time cardiovascular risk prediction,
feature contributions via training-set mean baseline perturbations,
hypothetical what-if intervention modeling, model evaluation metrics, and real test-set patient cases.
"""

import os
import sys
import json
import hashlib
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, ValidationInfo

# Ensure backend directory is in sys.path so intra-package imports resolve cleanly
# whether running from repository root, backend directory, or as an external package.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:
    from model import cardio_engine, FEATURE_NAMES
    from train_eval import METRICS_PATH, ARTIFACTS_PATH, train_and_evaluate
    from dataset import DEFAULT_DATA_PATH
except ImportError:
    from backend.model import cardio_engine, FEATURE_NAMES
    from backend.train_eval import METRICS_PATH, ARTIFACTS_PATH, train_and_evaluate
    from backend.dataset import DEFAULT_DATA_PATH

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("cardiovision.api")

app = FastAPI(
    title="CardioVision AI - Cardiovascular Research API",
    description="Explainable Cardiovascular Risk Assessment and 3D Anatomical Correlation Backend",
    version="1.0.0"
)

# Enable restricted CORS with environment override for deployment flexibility
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
if not allowed_origins:
    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)


def _sanitize_for_json(obj: Any) -> Any:
    import math
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return str(obj)
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v) for v in obj]
    return obj


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    from fastapi.encoders import jsonable_encoder
    from fastapi.responses import JSONResponse
    
    encoded = jsonable_encoder(exc.errors())
    sanitized = _sanitize_for_json(encoded)
    return JSONResponse(status_code=422, content={"detail": sanitized})


def get_metrics_hash() -> str:
    if not os.path.exists(METRICS_PATH):
        try:
            train_and_evaluate(force=False)
        except Exception as e:
            logger.error(f"Failed to generate metrics during hash calculation: {e}")
            return "uninitialized"
    try:
        with open(METRICS_PATH, "rb") as f:
            content = f.read()
        return hashlib.sha256(content).hexdigest()[:8]
    except Exception:
        return "unknown"


class PatientData(BaseModel):
    age: float = Field(default=55.0, ge=18, le=100, description="Age in years")
    sex: float = Field(default=1.0, ge=0, le=1, description="1=Male, 0=Female")
    cp: float = Field(default=1.0, ge=0, le=3, description="Chest pain type (0-3)")
    trestbps: float = Field(default=135.0, ge=80, le=220, description="Resting Blood Pressure (mmHg)")
    chol: float = Field(default=240.0, ge=100, le=600, description="Serum Cholesterol (mg/dL)")
    fbs: float = Field(default=0.0, ge=0, le=1, description="Fasting Blood Sugar > 120 (1/0)")
    restecg: float = Field(default=0.0, ge=0, le=2, description="Resting ECG (0-2)")
    thalach: float = Field(default=145.0, ge=60, le=220, description="Max Heart Rate Achieved (bpm)")
    exang: float = Field(default=0.0, ge=0, le=1, description="Exercise Induced Angina (1/0)")
    oldpeak: float = Field(default=1.2, ge=0.0, le=8.0, description="ST Depression (oldpeak)")
    slope: float = Field(default=1.0, ge=0, le=2, description="ST slope (0-2)")
    ca: float = Field(default=0.0, ge=0, le=3, description="Fluoroscopy Vessels (0-3)")
    thal: float = Field(default=2.0, ge=1, le=3, description="Thalassemia (1-3)")

    @field_validator("age", "trestbps", "chol", "thalach", "oldpeak", mode="before")
    @classmethod
    def validate_finite_numeric(cls, v: Any, info: ValidationInfo) -> float:
        try:
            val = float(v)
        except (ValueError, TypeError):
            raise ValueError(f"{info.field_name} must be a valid numeric value")
        import math
        if math.isnan(val) or math.isinf(val):
            raise ValueError(f"{info.field_name} cannot be NaN or Infinity")
        return val

    @field_validator("sex", "fbs", "exang", mode="before")
    @classmethod
    def validate_binary(cls, v: Any, info: ValidationInfo) -> float:
        try:
            val = float(v)
        except (ValueError, TypeError):
            raise ValueError(f"{info.field_name} must be 0 or 1")
        import math
        if math.isnan(val) or math.isinf(val) or val not in (0.0, 1.0):
            raise ValueError(f"{info.field_name} must be 0 or 1")
        return val

    @field_validator("cp", mode="before")
    @classmethod
    def validate_cp(cls, v: Any) -> float:
        try:
            val = float(v)
        except (ValueError, TypeError):
            raise ValueError("cp must be an integer between 0 and 3")
        import math
        if math.isnan(val) or math.isinf(val) or val not in (0.0, 1.0, 2.0, 3.0):
            raise ValueError("cp must be an integer between 0 and 3")
        return val

    @field_validator("restecg", "slope", mode="before")
    @classmethod
    def validate_three_class(cls, v: Any, info: ValidationInfo) -> float:
        try:
            val = float(v)
        except (ValueError, TypeError):
            raise ValueError(f"{info.field_name} must be an integer between 0 and 2")
        import math
        if math.isnan(val) or math.isinf(val) or val not in (0.0, 1.0, 2.0):
            raise ValueError(f"{info.field_name} must be an integer between 0 and 2")
        return val

    @field_validator("ca", mode="before")
    @classmethod
    def validate_ca(cls, v: Any) -> float:
        try:
            val = float(v)
        except (ValueError, TypeError):
            raise ValueError("ca must be an integer between 0 and 3")
        import math
        if math.isnan(val) or math.isinf(val) or val not in (0.0, 1.0, 2.0, 3.0):
            raise ValueError("ca must be an integer between 0 and 3")
        return val

    @field_validator("thal", mode="before")
    @classmethod
    def validate_thal(cls, v: Any) -> float:
        try:
            val = float(v)
        except (ValueError, TypeError):
            raise ValueError("thal must be 1 (normal), 2 (fixed defect), or 3 (reversible defect)")
        import math
        if math.isnan(val) or math.isinf(val) or val not in (1.0, 2.0, 3.0):
            raise ValueError("thal must be 1 (normal), 2 (fixed defect), or 3 (reversible defect)")
        return val


class WhatIfRequest(BaseModel):
    baseline: PatientData
    modified: PatientData


class ModelBreakdownResponse(BaseModel):
    ensemble: float
    gradient_boosting: float
    random_forest: float
    logistic_regression: float


class PredictionResponse(BaseModel):
    risk_score: float
    risk_tier: str
    display_band: str
    risk_color: Optional[str] = None
    confidence_interval: Optional[List[float]] = None
    benchmark_percentile: Optional[float] = None
    clinical_recommendation: str
    model_breakdown: ModelBreakdownResponse
    disclaimer: str


class FeatureContributionResponse(BaseModel):
    feature: str
    label: str
    patient_value: float
    baseline_value: float
    contribution: float
    marginal_contribution: Optional[float] = None
    shap_value: float
    direction: str
    importance_magnitude: float


class ExplanationResponse(BaseModel):
    method: str
    method_name: Optional[str] = None
    method_description: str
    reference_model: Optional[str] = None
    is_additive: Optional[bool] = False
    is_causal: Optional[bool] = False
    base_value: float
    predicted_value: float
    total_delta: float
    feature_contributions: List[FeatureContributionResponse]
    top_risk_drivers: List[FeatureContributionResponse]
    top_protective_factors: List[FeatureContributionResponse]


class WhatIfResponse(BaseModel):
    baseline_score: float
    baseline_tier: str
    simulated_score: float
    simulated_tier: str
    risk_delta: float
    impact_direction: str
    clinical_notes: str
    modified_parameters: Dict[str, Any]


@app.get("/")
def root():
    return {
        "project": "CardioVision AI",
        "description": "Explainable Cardiovascular Research Prototype API",
        "version": "1.0.0",
        "status": "online",
        "documentation": "/docs"
    }


@app.get("/api/health")
def health_check(response: Response):
    """Accurately reports backend readiness, dataset presence, and model status."""
    engine_ready = cardio_engine is not None and getattr(cardio_engine, "is_ready", False)
    dataset_present = os.path.exists(DEFAULT_DATA_PATH)
    artifacts_present = os.path.exists(ARTIFACTS_PATH)
    metrics_present = os.path.exists(METRICS_PATH)
    
    is_healthy = engine_ready and dataset_present and artifacts_present
    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    version_hash = get_metrics_hash() if metrics_present else "uninitialized"

    return {
        "status": "healthy" if is_healthy else "degraded",
        "ready": engine_ready,
        "dataset": "UCI Heart Disease (Cleveland)",
        "dataset_present": dataset_present,
        "dataset_available": dataset_present,
        "artifacts_present": artifacts_present,
        "artifacts_available": artifacts_present,
        "metrics_present": metrics_present,
        "metrics_available": metrics_present,
        "n_rows": 303,
        "model_version": f"cardiovision-{version_hash}",
        "engine_error": getattr(cardio_engine, "init_error", None) if cardio_engine else "Not instantiated"
    }


@app.get("/api/model-metrics")
def get_model_metrics():
    """Returns validated CV and test evaluation metrics loaded from metrics.json."""
    if not os.path.exists(METRICS_PATH):
        try:
            train_and_evaluate(force=False)
        except Exception as e:
            logger.error(f"Error training/evaluating models for metrics: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Model evaluation metrics could not be computed: {str(e)}"
            )

    try:
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict) or "test" not in data or "cv" not in data:
            raise ValueError("metrics.json is missing required test/cv sections")
        return data
    except Exception as e:
        logger.warning(f"Failed to read metrics from {METRICS_PATH} ({e}). Retrying via evaluation pipeline...")
        try:
            return train_and_evaluate(force=True)
        except Exception as regen_err:
            logger.error(f"Failed to regenerate model metrics: {regen_err}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read or regenerate model metrics: {str(regen_err)}"
            )


@app.get("/api/sample-patients")
def get_sample_patients(include_outcome: bool = Query(False, description="Expose true held-out test outcome")):
    """
    Returns real patients from the held-out test split (lowest, two mid, highest ensemble score).
    Does not expose true ground-truth outcome unless explicitly requested via ?include_outcome=true.
    """
    if not cardio_engine or not cardio_engine.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CardioVision ML engine is not yet initialized."
        )

    cases = []
    for p in cardio_engine.sample_patients:
        case_dict = {
            "id": p["id"],
            "name": p["name"],
            "dataset_row": p["dataset_row"],
            "clinical_summary": p["clinical_summary"],
            "data": p["data"]
        }
        if include_outcome:
            case_dict["outcome"] = p.get("outcome")
            case_dict["ensemble_score"] = p.get("ensemble_score")
        cases.append(case_dict)
    return cases


@app.post("/api/predict", response_model=PredictionResponse)
def predict_cardiac_risk(patient: PatientData):
    if not cardio_engine or not cardio_engine.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CardioVision ML engine is not ready for inference."
        )
    try:
        return cardio_engine.predict(patient.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while computing cardiac risk prediction."
        )


@app.post("/api/explain", response_model=ExplanationResponse)
def explain_features(patient: PatientData):
    if not cardio_engine or not cardio_engine.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CardioVision ML engine is not ready for feature attribution."
        )
    try:
        return cardio_engine.explain_features(patient.model_dump())
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Feature explanation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while computing feature contributions."
        )


@app.post("/api/feature-shap")
def feature_shap(patient: PatientData):
    """Genuine additive TreeSHAP, for the raw GB reference estimator only."""
    if not cardio_engine or not cardio_engine.is_ready:
        raise HTTPException(status_code=503, detail="Model unavailable")
    try:
        return cardio_engine.gradient_boosting_shap(patient.model_dump())
    except RuntimeError as exc:
        logger.warning("SHAP unavailable: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("SHAP calculation error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="SHAP explanation unavailable") from exc


@app.post("/api/what-if", response_model=WhatIfResponse)
def simulate_intervention(request: WhatIfRequest):
    if not cardio_engine or not cardio_engine.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CardioVision ML engine is not ready for what-if simulation."
        )
    try:
        return cardio_engine.simulate_what_if(
            request.baseline.model_dump(),
            request.modified.model_dump()
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"What-If simulation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while simulating what-if intervention."
        )


@app.get("/api/coronary-anatomy")
def get_coronary_anatomy_metadata():
    """Educational medical metadata regarding coronary arterial distribution."""
    return {
        "disclaimer": "Educational / research reference: Artery annotations provide educational vessel topography. Not patient-specific angiographic anatomy.",
        "arteries": [
            {
                "id": "LAD",
                "name": "Left Anterior Descending (LAD)",
                "nickname": "The Widow Maker",
                "description": "Supplies blood to the anterior wall of the left ventricle and anterior two-thirds of the interventricular septum.",
                "clinical_impact": "Occlusion here severely compromises left ventricular ejection fraction and cardiac output.",
                "typical_territory": "Anterior myocardium, cardiac apex, bundle of His.",
                "color_indicator": "#06B6D4"
            },
            {
                "id": "RCA",
                "name": "Right Coronary Artery (RCA)",
                "nickname": "Inferior Feeder",
                "description": "Courses through right atrioventricular groove. Supplies the right ventricle, inferior wall of the left ventricle, and SA/AV nodes.",
                "clinical_impact": "Ischemia can lead to acute inferior myocardial infarction and sinus bradycardia/heart block.",
                "typical_territory": "Right atrium, right ventricle, inferior LV wall, conduction nodes.",
                "color_indicator": "#3B82F6"
            },
            {
                "id": "LCX",
                "name": "Left Circumflex Artery (LCX)",
                "nickname": "Lateral Coronary",
                "description": "Branches off the left main coronary artery, running along coronary sulcus to supply posterolateral left ventricle.",
                "clinical_impact": "Infarction often presents with subtle lateral ST elevations or non-ST elevation acute coronary syndrome.",
                "typical_territory": "Posterolateral left ventricle, obtuse marginal branches, SA node in 40% of cases.",
                "color_indicator": "#8B5CF6"
            }
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, app_dir=BACKEND_DIR)
