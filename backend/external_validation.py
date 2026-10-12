"""Reproducible out-of-site check on UCI Heart Disease cohorts.

Usage:
    python backend/external_validation.py --download
    python backend/external_validation.py --data-dir /path/to/unpacked/heart-disease

IMPORTANT: This script does not assert external validation has happened.
It requires real UCI site files to be present or to download successfully.
The fitted Cleveland models are frozen; test cohorts are never fitted.
Missing inputs are imputed by the TRAINED Cleveland model's imputer.
This is an exploratory distribution-shift audit, not clinical validation.
"""
import argparse
import json
import os
from pathlib import Path
from urllib.request import urlretrieve
import numpy as np
from sklearn.metrics import accuracy_score, roc_auc_score, brier_score_loss, precision_score, recall_score, confusion_matrix

try:
    from dataset import FEATURE_COLUMNS
    from model import cardio_engine
except ImportError:
    from backend.dataset import FEATURE_COLUMNS
    from backend.model import cardio_engine

SOURCES = {
    'Hungarian': 'processed.hungarian.data',
    'Switzerland': 'processed.switzerland.data',
    'VA Long Beach': 'processed.va.data',
}
UCI_BASE = 'https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/'
# cp/slope are 1-based in UCI raw; thal values are (3,6,7).

def read_site(path):
    rows=[];labels=[];missing=0;invalid=0
    for line_number,line in enumerate(path.read_text(encoding='utf-8').splitlines(),1):
        if not line.strip():continue
        cells=line.strip().split(',')
        if len(cells)!=14:
            invalid+=1; continue
        try:
            record=np.array([float(v) if v!='?' else np.nan for v in cells],dtype=float)
            if not np.isfinite(record[13]):invalid+=1;continue
            record[2]=record[2]-1 if np.isfinite(record[2]) else np.nan
            record[10]=record[10]-1 if np.isfinite(record[10]) else np.nan
            if np.isfinite(record[12]):
                record[12]={3:1,6:2,7:3}.get(int(record[12]),np.nan)
            if np.isfinite(record[2]) and not 0<=record[2]<=3: invalid+=1;continue
            if np.isfinite(record[10]) and not 0<=record[10]<=2: invalid+=1;continue
            missing+=int(np.isnan(record[:13]).sum())
            rows.append(record[:13]);labels.append(int(record[13]>0))
        except (ValueError,TypeError):invalid+=1
    if not rows:raise ValueError(f'No parseable records in {path}')
    return np.stack(rows),np.array(labels,dtype=int),missing,invalid


def ensemble_probs(X):
    models=(cardio_engine.cal_gb,cardio_engine.cal_rf,cardio_engine.cal_lr)
    return sum(model.predict_proba(X)[:,1] for model in models)/len(models)


def evaluate(X,y):
    proba=ensemble_probs(X);pred=(proba>=.5).astype(int)
    tn,fp,fn,tp=[int(x) for x in confusion_matrix(y,pred,labels=[0,1]).ravel()]
    return dict(n=len(y),positives=int(y.sum()), prevalence=float(y.mean()),
        accuracy=float(accuracy_score(y,pred)),roc_auc=float(roc_auc_score(y,proba)) if len(set(y))==2 else None,
        precision=float(precision_score(y,pred,zero_division=0)),sensitivity=float(recall_score(y,pred,zero_division=0)),
        specificity=float(tn/(tn+fp)) if tn+fp else None,brier=float(brier_score_loss(y,proba)),
        confusion_matrix=dict(tp=tp,fp=fp,tn=tn,fn=fn))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true',help='Try to retrieve the three original site files from UCI')
    parser.add_argument('--data-dir',type=Path,default=Path(__file__).resolve().parent/'data'/'external')
    args=parser.parse_args();args.data_dir.mkdir(parents=True,exist_ok=True)
    output={'source':'UCI original heart disease processed site cohorts',
            'model':'Frozen, calibrated Cleveland-trained equal-weight ensemble',
            'status':'partial','disclaimer':'Research domain-shift audit only; historical site data with high missingness and possible coding differences. Not prospective or clinical validation.',
            'sites':{}}
    for name,filename in SOURCES.items():
        dest=args.data_dir/filename
        if not dest.exists() and args.download:
            try:urlretrieve(UCI_BASE+filename,dest)
            except Exception as exc:print(f'{name}: download failed: {exc}')
        if not dest.exists():
            output['sites'][name]={'status':'not_evaluated','reason':f'Missing {filename}. Supply original UCI file or run with --download.'}
            continue
        try:
            X,y,missing,invalid=read_site(dest)
            values=evaluate(X,y)
            output['sites'][name]={'status':'evaluated','n_missing_feature_cells':missing,'discarded_rows':invalid,**values}
            print(f'{name}: n={len(y)}, missing cells={missing}, ROC-AUC={values["roc_auc"]}, accuracy={values["accuracy"]:.3f}')
        except Exception as exc:
            output['sites'][name]={'status':'failed','reason':str(exc)}
            print(f'{name}: evaluation failed: {exc}')
    output['status']='complete' if all(v.get('status')=='evaluated' for v in output['sites'].values()) else 'incomplete'
    dest=Path(__file__).resolve().parent/'data'/'external_validation.json'
    dest.write_text(json.dumps(output,indent=2),encoding='utf-8')
    print('Saved:',dest, '| status:',output['status'])

if __name__=='__main__':main()
