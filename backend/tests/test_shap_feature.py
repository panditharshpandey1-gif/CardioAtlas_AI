"""New feature regression checks: live TreeSHAP and raw-score alignment."""
from fastapi.testclient import TestClient
from backend.main import app
from backend.model import cardio_engine
import pytest

client=TestClient(app)


def test_real_shap_additivity_and_reference_model():
    if not cardio_engine.is_ready:
        pytest.skip('Model unavailable')
    case=cardio_engine.sample_patients[0]['data']
    res=client.post('/api/feature-shap',json=case)
    assert res.status_code == 200
    data=res.json()
    assert data['method']=='TreeSHAP'
    assert data['is_ensemble_explanation'] is False
    assert data['unit']=='log-odds'
    assert len(data['features'])==13
    score=data['base_log_odds']+sum(x['shap_log_odds'] for x in data['features'])
    assert abs(score-data['prediction_log_odds']) < 0.005


def test_patient_switch_changes_model_score():
    c1=cardio_engine.sample_patients[0]['data']
    c4=cardio_engine.sample_patients[-1]['data']
    p1=client.post('/api/predict',json=c1)
    p4=client.post('/api/predict',json=c4)
    assert p1.status_code==200 and p4.status_code==200
    assert p1.json()['risk_score'] != p4.json()['risk_score']
