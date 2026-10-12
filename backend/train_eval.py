"""
CardioVision AI - Model Training, Calibration, and Bootstrap Evaluation
Trains GradientBoosting, RandomForest, and LogisticRegression on Cleveland UCI dataset.
Calibrates probabilities using sigmoid (Platt scaling) cross-validation.
Evaluates 5-fold CV and held-out test split with 95% bootstrap confidence intervals.
"""

import os
import sys
import json
import hashlib
from typing import Dict, Any, List, Tuple
import numpy as np
import joblib

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)

try:
    from dataset import load_and_convert_cleveland_data, FEATURE_COLUMNS
except ImportError:
    from backend.dataset import load_and_convert_cleveland_data, FEATURE_COLUMNS

METRICS_PATH = os.path.join(BACKEND_DIR, "data", "metrics.json")
ARTIFACTS_PATH = os.path.join(BACKEND_DIR, "data", "model_artifacts.joblib")


def calculate_sensitivity_specificity(y_true: np.ndarray, y_pred_prob: np.ndarray, threshold: float = 0.5) -> Tuple[float, float]:
    y_pred = (y_pred_prob >= threshold).astype(int)
    tp = np.sum((y_pred == 1) & (y_true == 1))
    fn = np.sum((y_pred == 0) & (y_true == 1))
    tn = np.sum((y_pred == 0) & (y_true == 0))
    fp = np.sum((y_pred == 1) & (y_true == 0))
    
    sens = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    return sens, spec


def acc_fn(yt: np.ndarray, yp: np.ndarray) -> float:
    return float(accuracy_score(yt, (yp >= 0.5).astype(int)))


def prec_fn(yt: np.ndarray, yp: np.ndarray) -> float:
    return float(precision_score(yt, (yp >= 0.5).astype(int), zero_division=0))


def sens_fn(yt: np.ndarray, yp: np.ndarray) -> float:
    return float(recall_score(yt, (yp >= 0.5).astype(int), zero_division=0))


def spec_fn(yt: np.ndarray, yp: np.ndarray) -> float:
    return calculate_sensitivity_specificity(yt, yp, threshold=0.5)[1]


def f1_metric_fn(yt: np.ndarray, yp: np.ndarray) -> float:
    return float(f1_score(yt, (yp >= 0.5).astype(int), zero_division=0))


def bootstrap_metric_ci(
    y_true: np.ndarray, 
    y_prob: np.ndarray, 
    metric_fn, 
    n_resamples: int = 1000, 
    seed: int = 42
) -> Tuple[float, float, float]:
    """Computes point estimate and 95% bootstrap CI (2.5% and 97.5% percentiles)."""
    point_val = float(metric_fn(y_true, y_prob))
    rng = np.random.RandomState(seed)
    n = len(y_true)
    boot_vals = []
    
    for _ in range(n_resamples):
        idx = rng.choice(n, size=n, replace=True)
        y_b = y_true[idx]
        p_b = y_prob[idx]
        # Skip resample if only 1 class present for ROC or PR AUC
        if len(np.unique(y_b)) < 2:
            continue
        try:
            val = metric_fn(y_b, p_b)
            boot_vals.append(val)
        except Exception:
            continue
            
    if len(boot_vals) < 100:
        return point_val, point_val, point_val
        
    ci_low = float(np.percentile(boot_vals, 2.5))
    ci_high = float(np.percentile(boot_vals, 97.5))
    return point_val, round(ci_low, 3), round(ci_high, 3)


def train_and_evaluate(force: bool = False) -> Dict[str, Any]:
    if not force and os.path.exists(METRICS_PATH) and os.path.exists(ARTIFACTS_PATH):
        try:
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                cached_metrics = json.load(f)
            if isinstance(cached_metrics, dict) and "cv" in cached_metrics and "test" in cached_metrics:
                return cached_metrics
        except Exception:
            pass  # Fall through to retraining if cached metrics file is corrupted or unreadable

    X, y, feature_names = load_and_convert_cleveland_data()
    n_total = len(y)
    pos_rate = float(np.mean(y))

    # Stratified 80/20 train/test split, random_state=42
    indices = np.arange(n_total)
    train_idx, test_idx = train_test_split(indices, test_size=0.2, random_state=42, stratify=y)

    X_train, y_train = X[train_idx], y[train_idx]
    X_test, y_test = X[test_idx], y[test_idx]

    # Model specifications
    def build_base_pipelines():
        gb_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("gb", GradientBoostingClassifier(n_estimators=100, max_depth=2, learning_rate=0.05, random_state=42))
        ])
        rf_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("rf", RandomForestClassifier(n_estimators=300, max_depth=4, min_samples_leaf=3, random_state=42))
        ])
        lr_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("lr", LogisticRegression(max_iter=1000, random_state=42))
        ])
        return gb_pipe, rf_pipe, lr_pipe

    # --- 1. 5-Fold Stratified CV on Training Split ---
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    metric_keys = ["roc_auc", "pr_auc", "accuracy", "precision", "sensitivity", "specificity", "f1", "brier"]
    cv_records = {
        name: {m: [] for m in metric_keys}
        for name in ["Ensemble", "Gradient boosting", "Random forest", "Logistic regression"]
    }

    for fold_train_idx, fold_val_idx in skf.split(X_train, y_train):
        X_f_tr, y_f_tr = X_train[fold_train_idx], y_train[fold_train_idx]
        X_f_val, y_f_val = X_train[fold_val_idx], y_train[fold_val_idx]

        gb_pipe, rf_pipe, lr_pipe = build_base_pipelines()

        cal_gb = CalibratedClassifierCV(estimator=gb_pipe, method="sigmoid", cv=5)
        cal_rf = CalibratedClassifierCV(estimator=rf_pipe, method="sigmoid", cv=5)
        cal_lr = CalibratedClassifierCV(estimator=lr_pipe, method="sigmoid", cv=5)

        cal_gb.fit(X_f_tr, y_f_tr)
        cal_rf.fit(X_f_tr, y_f_tr)
        cal_lr.fit(X_f_tr, y_f_tr)

        p_gb = cal_gb.predict_proba(X_f_val)[:, 1]
        p_rf = cal_rf.predict_proba(X_f_val)[:, 1]
        p_lr = cal_lr.predict_proba(X_f_val)[:, 1]
        p_ens = (p_gb + p_rf + p_lr) / 3.0

        for name, probs in [
            ("Ensemble", p_ens),
            ("Gradient boosting", p_gb),
            ("Random forest", p_rf),
            ("Logistic regression", p_lr),
        ]:
            cv_records[name]["roc_auc"].append(roc_auc_score(y_f_val, probs))
            cv_records[name]["pr_auc"].append(average_precision_score(y_f_val, probs))
            cv_records[name]["accuracy"].append(acc_fn(y_f_val, probs))
            cv_records[name]["precision"].append(prec_fn(y_f_val, probs))
            cv_records[name]["sensitivity"].append(sens_fn(y_f_val, probs))
            cv_records[name]["specificity"].append(spec_fn(y_f_val, probs))
            cv_records[name]["f1"].append(f1_metric_fn(y_f_val, probs))
            cv_records[name]["brier"].append(brier_score_loss(y_f_val, probs))

    cv_results = []
    for name in ["Ensemble", "Gradient boosting", "Random forest", "Logistic regression"]:
        model_cv: Dict[str, Any] = {"name": name}
        for m in metric_keys:
            model_cv[m] = {
                "mean": round(float(np.mean(cv_records[name][m])), 3),
                "std": round(float(np.std(cv_records[name][m])), 3),
            }
        cv_results.append(model_cv)

    # --- 2. Fit Full Models on X_train, evaluate on X_test ---
    gb_pipe, rf_pipe, lr_pipe = build_base_pipelines()
    cal_gb_full = CalibratedClassifierCV(estimator=gb_pipe, method="sigmoid", cv=5)
    cal_rf_full = CalibratedClassifierCV(estimator=rf_pipe, method="sigmoid", cv=5)
    cal_lr_full = CalibratedClassifierCV(estimator=lr_pipe, method="sigmoid", cv=5)

    cal_gb_full.fit(X_train, y_train)
    cal_rf_full.fit(X_train, y_train)
    cal_lr_full.fit(X_train, y_train)

    # Raw fitted GB pipeline on X_train for baseline feature perturbation in /explain
    raw_gb_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("gb", GradientBoostingClassifier(n_estimators=100, max_depth=2, learning_rate=0.05, random_state=42))
    ])
    raw_gb_pipeline.fit(X_train, y_train)

    p_test_gb = cal_gb_full.predict_proba(X_test)[:, 1]
    p_test_rf = cal_rf_full.predict_proba(X_test)[:, 1]
    p_test_lr = cal_lr_full.predict_proba(X_test)[:, 1]
    p_test_ens = (p_test_gb + p_test_rf + p_test_lr) / 3.0

    test_models = [
        ("Ensemble", "Primary", p_test_ens),
        ("Gradient boosting", "Candidate", p_test_gb),
        ("Random forest", "Candidate", p_test_rf),
        ("Logistic regression", "Candidate", p_test_lr),
    ]

    test_results = []
    for name, status, probs in test_models:
        v_roc, ci_l_roc, ci_h_roc = bootstrap_metric_ci(y_test, probs, roc_auc_score)
        v_pr, ci_l_pr, ci_h_pr = bootstrap_metric_ci(y_test, probs, average_precision_score)
        v_acc, ci_l_acc, ci_h_acc = bootstrap_metric_ci(y_test, probs, acc_fn)
        v_prec, ci_l_prec, ci_h_prec = bootstrap_metric_ci(y_test, probs, prec_fn)
        v_sens, ci_l_sens, ci_h_sens = bootstrap_metric_ci(y_test, probs, sens_fn)
        v_spec, ci_l_spec, ci_h_spec = bootstrap_metric_ci(y_test, probs, spec_fn)
        v_f1, ci_l_f1, ci_h_f1 = bootstrap_metric_ci(y_test, probs, f1_metric_fn)
        v_brier, ci_l_brier, ci_h_brier = bootstrap_metric_ci(y_test, probs, brier_score_loss)

        # Confusion matrix at threshold 0.5
        y_pred = (probs >= 0.5).astype(int)
        cm = confusion_matrix(y_test, y_pred)
        tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

        test_results.append({
            "name": name,
            "status": status,
            "roc_auc": {"value": round(v_roc, 3), "ci_low": ci_l_roc, "ci_high": ci_h_roc},
            "pr_auc": {"value": round(v_pr, 3), "ci_low": ci_l_pr, "ci_high": ci_h_pr},
            "accuracy": {"value": round(v_acc, 3), "ci_low": ci_l_acc, "ci_high": ci_h_acc},
            "precision": {"value": round(v_prec, 3), "ci_low": ci_l_prec, "ci_high": ci_h_prec},
            "sensitivity": {"value": round(v_sens, 3), "ci_low": ci_l_sens, "ci_high": ci_h_sens},
            "specificity": {"value": round(v_spec, 3), "ci_low": ci_l_spec, "ci_high": ci_h_spec},
            "f1": {"value": round(v_f1, 3), "ci_low": ci_l_f1, "ci_high": ci_h_f1},
            "brier": {"value": round(v_brier, 3), "ci_low": ci_l_brier, "ci_high": ci_h_brier},
            "confusion_matrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        })

    # --- 3. Calibration Reliability Bins for Ensemble on Test Set (5 bins) ---
    bin_edges = np.linspace(0.0, 1.0, 6)
    calibration_bins = []
    for i in range(5):
        low, high = bin_edges[i], bin_edges[i + 1]
        if i == 4:
            mask = (p_test_ens >= low) & (p_test_ens <= high)
        else:
            mask = (p_test_ens >= low) & (p_test_ens < high)
            
        count = int(np.sum(mask))
        if count > 0:
            mean_pred = round(float(np.mean(p_test_ens[mask])), 3)
            frac_pos = round(float(np.mean(y_test[mask])), 3)
        else:
            mean_pred = round(float((low + high) / 2.0), 3)
            frac_pos = 0.0
            
        calibration_bins.append({
            "mean_predicted": mean_pred,
            "fraction_positive": frac_pos,
            "n": count
        })

    # --- 4. Select 4 Real Test-Set Cases (lowest, two mid, highest ensemble score) ---
    sorted_test_order = np.argsort(p_test_ens)
    lowest_idx = sorted_test_order[0]
    mid_idx_1 = sorted_test_order[len(sorted_test_order) // 3]
    mid_idx_2 = sorted_test_order[(2 * len(sorted_test_order)) // 3]
    highest_idx = sorted_test_order[-1]
    
    selected_sample_indices_in_test = [lowest_idx, mid_idx_1, mid_idx_2, highest_idx]
    
    # Impute missing values for sample cases using training median so input values are cleanly displayable
    imputer = SimpleImputer(strategy="median").fit(X_train)
    X_test_imputed = imputer.transform(X_test)
    
    sample_patients = []
    for i, test_i in enumerate(selected_sample_indices_in_test):
        orig_row = int(test_idx[test_i])
        row_vals = X_test_imputed[test_i]
        outcome_val = int(y_test[test_i])
        score_val = round(float(p_test_ens[test_i] * 100), 1)
        age_val = int(row_vals[0])
        sex_str = "male" if int(row_vals[1]) == 1 else "female"
        
        patient_dict = {
            "id": f"tc-{i+1}",
            "name": f"Test case {i+1}",
            "dataset_row": orig_row,
            "clinical_summary": f"{age_val}-year-old {sex_str}, test-set row {orig_row}",
            "ensemble_score": score_val,
            "outcome": outcome_val,
            "data": {
                feat: float(row_vals[f_i]) for f_i, feat in enumerate(FEATURE_COLUMNS)
            }
        }
        sample_patients.append(patient_dict)

    # --- 5. Training-Set Mean Baseline (for /explain) ---
    training_baseline_vector = {
        feat: float(np.nanmean(X_train[:, f_i])) for f_i, feat in enumerate(FEATURE_COLUMNS)
    }

    # Assemble complete metrics shape required by /api/model-metrics
    metrics_payload = {
        "dataset": {
            "name": "UCI Heart Disease (Cleveland)",
            "source_url": "https://archive.ics.uci.edu/dataset/45/heart+disease",
            "n_rows": n_total,
            "n_train": len(train_idx),
            "n_test": len(test_idx),
            "positive_rate": round(pos_rate, 3),
            "split": "stratified 80/20, seed 42",
            "missing_handling": "median/mode imputation fitted on training split"
        },
        "threshold": 0.5,
        "cv": cv_results,
        "test": test_results,
        "calibration": {
            "method": "sigmoid",
            "bins": calibration_bins
        },
        "limitations": [
            "Small dataset (n=303); wide confidence intervals.",
            "Single-centre historical data; not externally validated.",
            "Outcome is presence of angiographic heart disease, not a future event.",
            "Research and educational prototype; not a diagnostic device."
        ]
    }

    # Save metrics.json atomically
    os.makedirs(os.path.dirname(METRICS_PATH), exist_ok=True)
    tmp_metrics = f"{METRICS_PATH}.tmp"
    with open(tmp_metrics, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)
    os.replace(tmp_metrics, METRICS_PATH)

    # Save artifacts for backend serving atomically
    artifacts = {
        "cal_gb": cal_gb_full,
        "cal_rf": cal_rf_full,
        "cal_lr": cal_lr_full,
        "raw_gb_pipeline": raw_gb_pipeline,
        "imputer": imputer,
        "training_baseline": training_baseline_vector,
        "sample_patients": sample_patients,
        "train_idx": train_idx.tolist(),
        "test_idx": test_idx.tolist(),
    }
    tmp_artifacts = f"{ARTIFACTS_PATH}.tmp"
    joblib.dump(artifacts, tmp_artifacts)
    os.replace(tmp_artifacts, ARTIFACTS_PATH)

    print("Successfully trained models, generated metrics.json and model_artifacts.joblib")
    return metrics_payload


if __name__ == "__main__":
    metrics = train_and_evaluate(force=True)
    print("\n--- TEST SET METRICS ---")
    for m in metrics["test"]:
        print(f"{m['name']} ({m['status']}):")
        print(f"  ROC-AUC: {m['roc_auc']['value']} (95% CI: {m['roc_auc']['ci_low']} - {m['roc_auc']['ci_high']})")
        print(f"  PR-AUC:  {m['pr_auc']['value']} (95% CI: {m['pr_auc']['ci_low']} - {m['pr_auc']['ci_high']})")
        print(f"  Brier:   {m['brier']['value']} (95% CI: {m['brier']['ci_low']} - {m['brier']['ci_high']})")
        print(f"  Sens:    {m['sensitivity']['value']} (95% CI: {m['sensitivity']['ci_low']} - {m['sensitivity']['ci_high']})")
        print(f"  Spec:    {m['specificity']['value']} (95% CI: {m['specificity']['ci_low']} - {m['specificity']['ci_high']})")
