import os
import numpy as np
import pytest
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split

from dataset import load_and_convert_cleveland_data, FEATURE_COLUMNS

def test_cleveland_data_loading_and_ranges():
    X, y, feature_names = load_and_convert_cleveland_data()
    
    # Verify shape
    assert X.shape[0] == 303
    assert X.shape[1] == 13
    assert y.shape[0] == 303
    assert len(feature_names) == 13
    
    # Target values must be 0 or 1
    assert set(np.unique(y)).issubset({0, 1})
    
    # Column indices
    cp_idx = feature_names.index("cp")
    slope_idx = feature_names.index("slope")
    thal_idx = feature_names.index("thal")
    ca_idx = feature_names.index("ca")
    sex_idx = feature_names.index("sex")
    fbs_idx = feature_names.index("fbs")
    exang_idx = feature_names.index("exang")
    
    # 1. cp in 0..3
    cp_valid = X[:, cp_idx][~np.isnan(X[:, cp_idx])]
    assert np.all(np.isin(cp_valid, [0, 1, 2, 3])), f"Invalid cp values: {np.unique(cp_valid)}"
    
    # 2. slope in 0..2
    slope_valid = X[:, slope_idx][~np.isnan(X[:, slope_idx])]
    assert np.all(np.isin(slope_valid, [0, 1, 2])), f"Invalid slope values: {np.unique(slope_valid)}"
    
    # 3. thal in 1..3
    thal_valid = X[:, thal_idx][~np.isnan(X[:, thal_idx])]
    assert np.all(np.isin(thal_valid, [1, 2, 3])), f"Invalid thal values: {np.unique(thal_valid)}"
    
    # 4. ca in 0..3
    ca_valid = X[:, ca_idx][~np.isnan(X[:, ca_idx])]
    assert np.all(np.isin(ca_valid, [0, 1, 2, 3])), f"Invalid ca values: {np.unique(ca_valid)}"
    
    # Binary features
    assert set(np.unique(X[:, sex_idx])).issubset({0, 1})
    assert set(np.unique(X[:, fbs_idx])).issubset({0, 1})
    assert set(np.unique(X[:, exang_idx])).issubset({0, 1})
    
    # Verify expected missing values
    assert np.sum(np.isnan(X[:, ca_idx])) == 4, "Expected 4 missing ca values"
    assert np.sum(np.isnan(X[:, thal_idx])) == 2, "Expected 2 missing thal values"

def test_imputation_in_pipeline_no_leakage():
    X, y, _ = load_and_convert_cleveland_data()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median"))
    ])
    
    # Fit only on training set
    X_train_imp = pipe.fit_transform(X_train)
    X_test_imp = pipe.transform(X_test)
    
    # No NaNs remain after imputation
    assert not np.any(np.isnan(X_train_imp))
    assert not np.any(np.isnan(X_test_imp))
