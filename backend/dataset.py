import os
import sys
from typing import Tuple, Dict, Any, List
import numpy as np

# Ensure backend directory is in sys.path so intra-package imports resolve cleanly
# whether running from repository root, backend directory, or as an external package.
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

try:
    from download_data import download_cleveland_dataset, DEFAULT_DATA_PATH
except ImportError:
    from backend.download_data import download_cleveland_dataset, DEFAULT_DATA_PATH

COLUMNS = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", 
    "restecg", "thalach", "exang", "oldpeak", "slope", 
    "ca", "thal", "num"
]

FEATURE_COLUMNS = COLUMNS[:-1]
TARGET_COLUMN = COLUMNS[-1]


def resolve_data_path(data_path: str = DEFAULT_DATA_PATH) -> str:
    """Resolves dataset path across various execution working directories."""
    candidates = [
        os.path.abspath(data_path) if data_path else None,
        data_path,
        DEFAULT_DATA_PATH,
        os.path.join(BACKEND_DIR, "data", os.path.basename(data_path or "processed.cleveland.data")),
        os.path.join(os.getcwd(), data_path) if data_path else None,
        os.path.join(os.getcwd(), "backend", data_path) if data_path else None,
        os.path.join(os.getcwd(), "data", os.path.basename(data_path or "processed.cleveland.data")),
    ]

    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            return os.path.abspath(candidate)

    # If file is missing, automatically download and initialize
    target = data_path if (data_path and os.path.isabs(data_path)) else DEFAULT_DATA_PATH
    try:
        resolved = download_cleveland_dataset(target)
        if os.path.isfile(resolved):
            return os.path.abspath(resolved)
    except Exception as e:
        searched_info = "\n  ".join(str(c) for c in candidates[:4] if c)
        raise FileNotFoundError(
            f"Cleveland dataset not found at '{data_path}' and automatic download failed: {e}\n"
            f"Searched candidate locations:\n  {searched_info}"
        ) from e

    raise FileNotFoundError(f"Cleveland dataset not found at {data_path}")


def load_and_convert_cleveland_data(data_path: str = DEFAULT_DATA_PATH) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    """
    Loads UCI Heart Disease (processed.cleveland.data) and applies app-standard encodings:
      - cp 1-4 -> 0-3 (subtract 1)
      - slope 1-3 -> 0-2 (subtract 1)
      - thal 3 -> 1 (normal), 6 -> 2 (fixed defect), 7 -> 3 (reversible defect)
      - target: num > 0 -> 1 else 0
      - Missing values ('?') are preserved as np.nan to be imputed inside sklearn pipelines.
    Returns:
      (X, y, feature_names)
    """
    resolved_path = resolve_data_path(data_path)

    rows = []
    with open(resolved_path, "r", encoding="utf-8-sig") as f:
        for line_num, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            parts = [p.strip() for p in line.split(",")]
            if len(parts) != len(COLUMNS):
                raise ValueError(
                    f"Invalid column count ({len(parts)}) at line {line_num} in {resolved_path}. "
                    f"Expected {len(COLUMNS)}."
                )
            # Parse values, keeping '?' and empty markers as np.nan
            row = []
            for p in parts:
                if p in ("?", "", "NA", "NaN", "nan", "null"):
                    row.append(np.nan)
                else:
                    try:
                        row.append(float(p))
                    except ValueError as val_err:
                        raise ValueError(
                            f"Unparseable numeric value '{p}' at line {line_num} in {resolved_path}"
                        ) from val_err
            rows.append(row)

    data = np.array(rows, dtype=np.float64)
    if data.shape[0] != 303:
        raise ValueError(f"Expected 303 rows in processed.cleveland.data, got {data.shape[0]}")

    X = data[:, :-1].copy()
    y_raw = data[:, -1].copy()

    # Apply conversions preserving NaNs
    # cp is column index 2: 1-4 -> 0-3
    X[:, 2] = np.where(np.isnan(X[:, 2]), np.nan, X[:, 2] - 1.0)

    # slope is column index 10: 1-3 -> 0-2
    X[:, 10] = np.where(np.isnan(X[:, 10]), np.nan, X[:, 10] - 1.0)

    # thal is column index 12: 3 -> 1, 6 -> 2, 7 -> 3
    thal_col = X[:, 12].copy()
    new_thal = np.full_like(thal_col, np.nan)
    new_thal[thal_col == 3.0] = 1.0
    new_thal[thal_col == 6.0] = 2.0
    new_thal[thal_col == 7.0] = 3.0
    # Any other values that are not nan or mapped:
    unmapped = ~np.isnan(thal_col) & (thal_col != 3.0) & (thal_col != 6.0) & (thal_col != 7.0)
    if np.any(unmapped):
        raise ValueError(f"Unexpected thal values found: {thal_col[unmapped]}")
    X[:, 12] = new_thal

    # Target: num > 0 -> 1, else 0
    y = (y_raw > 0.0).astype(np.int64)

    return X, y, FEATURE_COLUMNS


if __name__ == "__main__":
    X, y, features = load_and_convert_cleveland_data()
    print(f"Dataset successfully loaded: X shape={X.shape}, y shape={y.shape}")
    print(f"Features ({len(features)}): {features}")
    print(f"Target distribution: 0={np.sum(y == 0)}, 1={np.sum(y == 1)}")
    ca_idx = features.index("ca")
    thal_idx = features.index("thal")
    print(f"Missing values: ca={np.isnan(X[:, ca_idx]).sum()}, thal={np.isnan(X[:, thal_idx]).sum()}")
