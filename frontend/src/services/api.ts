import { 
  PatientData, 
  PatientProfile, 
  PredictionResult, 
  ShapExplanation, 
  WhatIfResult, 
  ArteryMetadata,
  ModelMetricsResponse,
  HealthResponse,
  TreeShapExplanation,
} from '../types/cardio';

// Configurable API base URL: defaults to empty string so requests use Vite dev proxy '/api'
// In production or custom environments, set VITE_API_BASE_URL (e.g. 'http://127.0.0.1:8000')
const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const API_BASE_URL = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;

// Real training-set mean baseline computed from Cleveland dataset (n=242 training split)
export const POPULATION_BASELINE_DATA: PatientData = {
  age: 54.5,
  sex: 1,
  cp: 2,
  trestbps: 131.0,
  chol: 249.8,
  fbs: 0,
  restecg: 1,
  thalach: 150.0,
  exang: 0,
  oldpeak: 1.0,
  slope: 1,
  ca: 1,
  thal: 2,
};

// 4 real patients from the held-out test split (n=61, seed=42)
export const FALLBACK_SAMPLE_PATIENTS: PatientProfile[] = [
  {
    id: "tc-1",
    name: "Test case 1",
    dataset_row: 134,
    clinical_summary: "43-year-old female, test-set row 134",
    isDemo: true,
    data: {
      age: 43.0,
      sex: 0.0,
      cp: 2.0,
      trestbps: 122.0,
      chol: 213.0,
      fbs: 0.0,
      restecg: 0.0,
      thalach: 165.0,
      exang: 0.0,
      oldpeak: 0.2,
      slope: 1.0,
      ca: 0.0,
      thal: 1.0
    }
  },
  {
    id: "tc-2",
    name: "Test case 2",
    dataset_row: 3,
    clinical_summary: "37-year-old male, test-set row 3",
    isDemo: true,
    data: {
      age: 37.0,
      sex: 1.0,
      cp: 2.0,
      trestbps: 130.0,
      chol: 250.0,
      fbs: 0.0,
      restecg: 0.0,
      thalach: 187.0,
      exang: 0.0,
      oldpeak: 3.5,
      slope: 2.0,
      ca: 0.0,
      thal: 1.0
    }
  },
  {
    id: "tc-3",
    name: "Test case 3",
    dataset_row: 23,
    clinical_summary: "58-year-old male, test-set row 23",
    isDemo: true,
    data: {
      age: 58.0,
      sex: 1.0,
      cp: 2.0,
      trestbps: 132.0,
      chol: 224.0,
      fbs: 0.0,
      restecg: 2.0,
      thalach: 173.0,
      exang: 0.0,
      oldpeak: 3.2,
      slope: 0.0,
      ca: 2.0,
      thal: 3.0
    }
  },
  {
    id: "tc-4",
    name: "Test case 4",
    dataset_row: 62,
    clinical_summary: "58-year-old male, test-set row 62",
    isDemo: true,
    data: {
      age: 58.0,
      sex: 1.0,
      cp: 3.0,
      trestbps: 128.0,
      chol: 216.0,
      fbs: 0.0,
      restecg: 2.0,
      thalach: 131.0,
      exang: 1.0,
      oldpeak: 2.2,
      slope: 1.0,
      ca: 3.0,
      thal: 3.0
    }
  }
];

export const CORONARY_ARTERY_DETAILS: Record<'LAD' | 'RCA' | 'LCX', ArteryMetadata> = {
  LAD: {
    id: 'LAD',
    name: 'Left Anterior Descending (LAD)',
    nickname: 'The Widow Maker',
    description: 'Courses down the anterior interventricular groove toward the cardiac apex. Primary conduit delivering oxygenated blood to the left ventricular anterior wall and septum.',
    clinical_impact: 'Proximal occlusion causes extensive anterior myocardial infarction, severe loss of ejection fraction, cardiogenic shock, or sudden cardiac arrest.',
    typical_territory: 'Anterior left ventricular wall, anterior two-thirds of interventricular septum, cardiac apex.',
    color_indicator: '#06B6D4'
  },
  RCA: {
    id: 'RCA',
    name: 'Right Coronary Artery (RCA)',
    nickname: 'Inferior & Nodal Feeder',
    description: 'Arises from the right aortic sinus, coursing along the atrioventricular groove. Supplies blood to the right ventricle, inferior LV wall, and cardiac conduction system (SA/AV nodes).',
    clinical_impact: 'Ischemia can induce acute inferior myocardial infarction, right ventricular dysfunction, severe sinus bradycardia, and high-grade AV block.',
    typical_territory: 'Right atrium, right ventricle, inferior left ventricular wall, SA node (60%), AV node (90%).',
    color_indicator: '#3B82F6'
  },
  LCX: {
    id: 'LCX',
    name: 'Left Circumflex Artery (LCX)',
    nickname: 'Posterolateral Coronary',
    description: 'Branches from the left main coronary artery at an acute angle and travels around the coronary sulcus to the diaphragmatic surface of the heart.',
    clinical_impact: 'Occlusion often produces posterolateral myocardial ischemia. Due to ECG lead orientations, LCX occlusions can be electrically silent or subtle on standard 12-lead ECGs.',
    typical_territory: 'Posterolateral left ventricular free wall, obtuse marginal distribution, SA node (40%).',
    color_indicator: '#A855F7'
  }
};

/**
 * Standard fetch wrapper with configurable request timeout and error classification.
 */
async function extractErrorMessage(res: Response, defaultMessage: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text) {
      return `${defaultMessage} (HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''})`;
    }
    try {
      const errJson = JSON.parse(text);
      if (errJson) {
        if (typeof errJson.detail === 'string') {
          return errJson.detail;
        }
        if (Array.isArray(errJson.detail)) {
          const formatted = errJson.detail
            .map((item: any) => {
              if (typeof item === 'object' && item !== null) {
                const field = Array.isArray(item.loc)
                  ? item.loc.filter((locPart: any) => locPart !== 'body').join('.')
                  : '';
                const msg = item.msg || JSON.stringify(item);
                return field ? `${field}: ${msg}` : msg;
              }
              return String(item);
            })
            .join('; ');
          if (formatted) return formatted;
        }
        if (typeof errJson.message === 'string') {
          return errJson.message;
        }
      }
    } catch {
      if (text.length < 300) return text;
    }
  } catch {
    // ignore
  }
  return `${defaultMessage} (HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''})`;
}

/**
 * Standard fetch wrapper with configurable request timeout and error classification.
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s while calling ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const apiService = {
  async checkHealth(): Promise<HealthResponse | null> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/health`, { method: 'GET' }, 4000);
      if (res.ok) {
        return await res.json();
      }
      if (res.status === 503) {
        const degradedData = await res.json().catch(() => null);
        if (degradedData && typeof degradedData === 'object') {
          return degradedData as HealthResponse;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  async getSamplePatients(includeOutcome: boolean = false): Promise<PatientProfile[]> {
    try {
      const url = `${API_BASE_URL}/api/sample-patients${includeOutcome ? '?include_outcome=true' : ''}`;
      const res = await fetchWithTimeout(url, { method: 'GET' }, 8000);
      if (!res.ok) {
        const errorMsg = await extractErrorMessage(res, 'Sample cohort fetch failed');
        throw new Error(errorMsg);
      }
      const data: PatientProfile[] = await res.json();
      return data.map(p => ({ ...p, isDemo: true }));
    } catch (err) {
      console.warn("Unable to fetch cohort from backend, using held-out test split fallback:", err);
      return FALLBACK_SAMPLE_PATIENTS.map(p => ({ ...p, isDemo: true }));
    }
  },

  async predict(patient: PatientData): Promise<PredictionResult> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient),
    });

    if (!res.ok) {
      const detailMsg = await extractErrorMessage(res, 'Risk prediction computation failed');
      throw new Error(detailMsg);
    }

    return await res.json();
  },

  async explain(patient: PatientData): Promise<ShapExplanation> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient),
    });

    if (!res.ok) {
      const detailMsg = await extractErrorMessage(res, 'Feature attribution computation failed');
      throw new Error(detailMsg);
    }

    return await res.json();
  },

  async whatIf(baseline: PatientData, modified: PatientData): Promise<WhatIfResult> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/what-if`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseline, modified }),
    });

    if (!res.ok) {
      const detailMsg = await extractErrorMessage(res, 'What-If simulation failed');
      throw new Error(detailMsg);
    }

    return await res.json();
  },

  async getModelMetrics(): Promise<ModelMetricsResponse | null> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/model-metrics`, { method: 'GET' }, 8000);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async getCoronaryAnatomy(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetchWithTimeout(`${API_BASE_URL}/api/coronary-anatomy`, { method: 'GET' }, 6000);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
};

/** Exact TreeSHAP values for the raw gradient boosting component (not the ensemble). */
export async function fetchTreeShap(data: PatientData): Promise<TreeShapExplanation> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/feature-shap`, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data),
  }, 15000);
  if (!response.ok) throw new Error(await extractErrorMessage(response, 'TreeSHAP unavailable'));
  return response.json();
}
