"""
CardioVision AI - Cardiovascular Machine Learning Engine
Trained on real UCI Heart Disease Cleveland cohort (n=303).
Provides calibrated ensemble predictions, feature contributions via one-at-a-time
marginal perturbations against training-set mean baselines, and what-if simulation.
"""

import os
import sys
import logging
from typing import Dict, Any, List, Optional
import numpy as np
import joblib

# Ensure backend directory is in sys.path so intra-package imports resolve cleanly
# whether running from repository root, backend directory, or as an external package.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:
    from dataset import FEATURE_COLUMNS
    from train_eval import train_and_evaluate, ARTIFACTS_PATH
except ImportError:
    from backend.dataset import FEATURE_COLUMNS
    from backend.train_eval import train_and_evaluate, ARTIFACTS_PATH

logger = logging.getLogger("cardiovision.engine")

FEATURE_NAMES = FEATURE_COLUMNS

FEATURE_LABELS = {
    "age": "Age (years)",
    "sex": "Biological Sex",
    "cp": "Chest Pain Type",
    "trestbps": "Resting Blood Pressure (mmHg)",
    "chol": "Serum Cholesterol (mg/dL)",
    "fbs": "Fasting Blood Sugar > 120",
    "restecg": "Resting ECG Abnormality",
    "thalach": "Max Heart Rate Achieved (bpm)",
    "exang": "Exercise-Induced Angina",
    "oldpeak": "ST Depression (oldpeak)",
    "slope": "ST Segment Slope",
    "ca": "Fluoroscopy Major Vessels (ca)",
    "thal": "Thalassemia Classification",
}


class CardioMLEngine:
    def __init__(self):
        self.cal_gb = None
        self.cal_rf = None
        self.cal_lr = None
        self.raw_gb_pipeline = None
        self.imputer = None
        self.training_baseline: Dict[str, float] = {}
        self.sample_patients: List[Dict[str, Any]] = []
        self.is_ready: bool = False
        self.init_error: Optional[str] = None
        self._load_or_train()

    def _load_or_train(self):
        """Loads existing model artifacts or trains once if artifacts are absent or stale."""
        try:
            if not os.path.exists(ARTIFACTS_PATH):
                logger.info("Model artifacts not found; executing train_and_evaluate...")
                train_and_evaluate(force=False)

            logger.info(f"Loading model artifacts from {ARTIFACTS_PATH}...")
            artifacts = joblib.load(ARTIFACTS_PATH)
            required_keys = {
                "cal_gb", "cal_rf", "cal_lr", "raw_gb_pipeline",
                "imputer", "training_baseline", "sample_patients"
            }
            if not isinstance(artifacts, dict) or not required_keys.issubset(artifacts.keys()):
                raise ValueError("Model artifacts are missing required components. Forcing retraining.")
            if any(artifacts.get(k) is None for k in required_keys):
                raise ValueError("Model artifacts contain null components. Forcing retraining.")
        except Exception as load_err:
            logger.warning(f"Existing model artifacts incompatible or corrupted ({load_err}). Retraining clean baseline...")
            try:
                train_and_evaluate(force=True)
                artifacts = joblib.load(ARTIFACTS_PATH)
            except Exception as train_err:
                self.is_ready = False
                self.init_error = f"Model training/loading failed: {train_err}"
                logger.error(self.init_error)
                return

        self.cal_gb = artifacts["cal_gb"]
        self.cal_rf = artifacts["cal_rf"]
        self.cal_lr = artifacts["cal_lr"]
        self.raw_gb_pipeline = artifacts["raw_gb_pipeline"]
        self.imputer = artifacts["imputer"]
        self.training_baseline = artifacts["training_baseline"]
        self.sample_patients = artifacts["sample_patients"]
        self.is_ready = True
        self.init_error = None
        logger.info("CardioMLEngine successfully initialized.")

    def _extract_vector(self, data: Dict[str, Any]) -> np.ndarray:
        vec = []
        for feat in FEATURE_NAMES:
            val = data.get(feat, self.training_baseline.get(feat, 0.0))
            try:
                num_val = float(val)
                if np.isnan(num_val) or np.isinf(num_val):
                    num_val = self.training_baseline.get(feat, 0.0)
                vec.append(num_val)
            except (ValueError, TypeError):
                vec.append(self.training_baseline.get(feat, 0.0))
        return np.array(vec, dtype=np.float64)

    def predict(self, data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.is_ready:
            raise RuntimeError(f"CardioMLEngine is not initialized: {self.init_error or 'Artifacts not loaded'}")

        vec = self._extract_vector(data).reshape(1, -1)

        p_gb = float(self.cal_gb.predict_proba(vec)[0][1])
        p_rf = float(self.cal_rf.predict_proba(vec)[0][1])
        p_lr = float(self.cal_lr.predict_proba(vec)[0][1])

        p_ensemble = float(np.clip((p_gb + p_rf + p_lr) / 3.0, 0.0, 1.0))
        risk_score = round(p_ensemble * 100.0, 1)

        # Base model agreement spread across the 3 calibrated classifiers
        min_score = round(min(p_gb, p_rf, p_lr) * 100.0, 1)
        max_score = round(max(p_gb, p_rf, p_lr) * 100.0, 1)

        # Prototype display bands 25 / 50 / 75 (not clinically validated thresholds)
        if risk_score < 25.0:
            tier = "Low"
            color = "#10B981"
        elif risk_score < 50.0:
            tier = "Moderate"
            color = "#F59E0B"
        elif risk_score < 75.0:
            tier = "High"
            color = "#F97316"
        else:
            tier = "Very high"
            color = "#EF4444"

        return {
            "risk_score": risk_score,
            "risk_tier": tier,
            "display_band": tier,
            "risk_color": color,
            "confidence_interval": [min_score, max_score],
            "clinical_recommendation": f"Model score band: {tier}. This research prototype does not provide clinical diagnostic or therapeutic recommendations.",
            "model_breakdown": {
                "ensemble": risk_score,
                "gradient_boosting": round(p_gb * 100.0, 1),
                "random_forest": round(p_rf * 100.0, 1),
                "logistic_regression": round(p_lr * 100.0, 1),
            },
            "disclaimer": (
                "Research and educational prototype. Reflects dataset angiographic disease presence (>=50% stenosis), "
                "not future cardiovascular event prediction. Not an FDA-cleared diagnostic device."
            )
        }

    def explain_features(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        One-at-a-time marginal baseline perturbation on the fitted GradientBoosting model
        evaluated against the training-set mean baseline.
        Accurately described as marginal baseline perturbation (sensitivity analysis; not genuine TreeSHAP).
        Contributions are independent, non-additive, and non-causal.
        """
        if not self.is_ready:
            raise RuntimeError(f"CardioMLEngine is not initialized: {self.init_error or 'Artifacts not loaded'}")

        vec = self._extract_vector(data)
        base_vec = np.array([self.training_baseline.get(k, 0.0) for k in FEATURE_NAMES], dtype=np.float64)

        base_pred = float(self.raw_gb_pipeline.predict_proba(base_vec.reshape(1, -1))[0][1]) * 100.0
        current_pred = float(self.raw_gb_pipeline.predict_proba(vec.reshape(1, -1))[0][1]) * 100.0

        contributions: List[Dict[str, Any]] = []
        for i, feat in enumerate(FEATURE_NAMES):
            val = vec[i]
            base_val = base_vec[i]

            pert_vec = base_vec.copy()
            pert_vec[i] = val
            pert_pred = float(self.raw_gb_pipeline.predict_proba(pert_vec.reshape(1, -1))[0][1]) * 100.0
            diff = pert_pred - base_pred
            contrib = round(float(diff), 2)

            contributions.append({
                "feature": feat,
                "label": FEATURE_LABELS[feat],
                "patient_value": round(float(val), 1),
                "baseline_value": round(float(base_val), 1),
                "contribution": contrib,
                "marginal_contribution": contrib,
                "shap_value": contrib,  # Retained for backwards compatibility with existing UI contracts
                "direction": "increases_risk" if diff >= 0 else "reduces_risk",
                "importance_magnitude": round(abs(contrib), 2),
            })

        contributions.sort(key=lambda x: x["importance_magnitude"], reverse=True)

        return {
            "method": "marginal_baseline_perturbation",
            "method_name": "One-at-a-time Marginal Feature Sensitivity",
            "method_description": (
                "Marginal feature attribution via one-at-a-time feature replacement evaluated "
                "against the Cleveland training-cohort mean baseline. Marginal perturbations measure "
                "independent feature sensitivity on the reference Gradient Boosting model and are not additive components. "
                "Results reflect statistical model associations and do not establish biological or clinical disease causation."
            ),
            "reference_model": "Gradient Boosting Classifier (base estimator trained on Cleveland cohort)",
            "is_additive": False,
            "is_causal": False,
            "base_value": round(base_pred, 1),
            "predicted_value": round(current_pred, 1),
            "total_delta": round(current_pred - base_pred, 1),
            "feature_contributions": contributions,
            "top_risk_drivers": [c for c in contributions if c["contribution"] > 0][:4],
            "top_protective_factors": [c for c in contributions if c["contribution"] < 0][:4],
        }

    def gradient_boosting_shap(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Exact TreeSHAP for the raw gradient boosting component, in log-odds.

        IMPORTANT: The output explains only raw Gradient Boosting, not the
        calibrated 1/3 + 1/3 + 1/3 ensemble. Log-odds additivity is checked.
        """
        if not self.is_ready:
            raise RuntimeError("Model unavailable")
        try:
            import shap
        except ImportError as exc:
            raise RuntimeError("Optional SHAP dependency is not installed") from exc
        row = self._extract_vector(data).reshape(1, -1)
        imputed_row = self.raw_gb_pipeline.named_steps["imputer"].transform(row)
        estimator = self.raw_gb_pipeline.named_steps["gb"]
        tree_explainer = shap.TreeExplainer(estimator, model_output="raw")
        shap_vec = np.asarray(tree_explainer.shap_values(imputed_row)).reshape(-1)
        base = float(np.asarray(tree_explainer.expected_value).reshape(-1)[0])
        log_odds = float(base + shap_vec.sum())
        model_log_odds = float(estimator.decision_function(imputed_row)[0])
        if not np.isclose(log_odds, model_log_odds, atol=1e-5):
            raise RuntimeError("SHAP additivity check failed")
        rows = sorted([{
            "feature": name, "label": FEATURE_LABELS[name],
            "value": float(imputed_row[0, i]),
            "shap_log_odds": round(float(shap_vec[i]), 4),
        } for i, name in enumerate(FEATURE_NAMES)],
            key=lambda record: abs(record["shap_log_odds"]), reverse=True)
        return {
            "method": "TreeSHAP", "reference_model": "Uncalibrated Gradient Boosting component",
            "unit": "log-odds", "base_log_odds": round(base, 4),
            "prediction_log_odds": round(model_log_odds, 4),
            "prediction_probability": round(float(estimator.predict_proba(imputed_row)[0, 1]) * 100, 2),
            "is_ensemble_explanation": False,
            "disclaimer": "Explains the raw Gradient Boosting component, NOT the calibrated ensemble probability. Historical correlations are not causes.",
            "features": rows,
        }

    def simulate_what_if(self, baseline_data: Dict[str, Any], modified_data: Dict[str, Any]) -> Dict[str, Any]:
        if not self.is_ready:
            raise RuntimeError(f"CardioMLEngine is not initialized: {self.init_error or 'Artifacts not loaded'}")

        base_res = self.predict(baseline_data)
        mod_res = self.predict(modified_data)

        delta = round(mod_res["risk_score"] - base_res["risk_score"], 1)

        def is_different(param_key: str) -> bool:
            v_base = baseline_data.get(param_key)
            v_mod = modified_data.get(param_key)
            try:
                return abs(float(v_mod) - float(v_base)) > 1e-4
            except (ValueError, TypeError):
                return v_mod != v_base

        modified_parameters = {
            k: modified_data[k]
            for k in modified_data
            if k in baseline_data and is_different(k)
        }

        return {
            "baseline_score": base_res["risk_score"],
            "baseline_tier": base_res["risk_tier"],
            "simulated_score": mod_res["risk_score"],
            "simulated_tier": mod_res["risk_tier"],
            "risk_delta": delta,
            "impact_direction": "improved" if delta < 0 else ("elevated" if delta > 0 else "unchanged"),
            "clinical_notes": (
                f"Hypothetical simulation: parameter adjustment projects a {abs(delta):.1f}% "
                f"{'reduction' if delta < 0 else 'increase'} in model score. For educational exploration only; not a clinical treatment recommendation."
            ),
            "modified_parameters": modified_parameters,
        }


cardio_engine = CardioMLEngine()
