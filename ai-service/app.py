import os
from datetime import datetime
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title='SmartBin AI Service')
model = None
try:
    repo, token = os.getenv('HF_MODEL_REPO'), os.getenv('HF_TOKEN')
    if repo:
        from huggingface_hub import hf_hub_download
        import joblib
        model = joblib.load(hf_hub_download(repo_id=repo, filename='model.joblib', token=token))
except Exception as exc:
    print(f'Hugging Face model unavailable, using fallback: {exc}')

class Prediction(BaseModel):
    bin_id: str
    fill_level: float
    fill_rate: float = 0.0
    hours_since_collection: float = 0.0

@app.get('/health')
def health(): return {'ok': True, 'model_loaded': model is not None}

@app.post('/predict')
def predict(p: Prediction):
    if model is not None:
        now = datetime.now(); hours = max(0.0, float(model.predict([[p.fill_level, max(p.fill_rate, .1), now.hour, now.weekday(), p.hours_since_collection]])[0]))
        reason = 'Hugging Face model'
    else:
        hours = max(0.0, (95 - p.fill_level) / max(p.fill_rate, 1.0)); reason = 'explainable fallback'
    priority = 'urgent' if p.fill_level >= 90 or hours <= 4 else 'high' if p.fill_level >= 80 or hours <= 12 else 'medium' if p.fill_level >= 60 else 'low'
    return {'priority': priority, 'hours_until_full': round(hours, 1), 'reason': reason}
