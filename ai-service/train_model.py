"""Train and optionally upload the SmartBin fill-time model."""
import os, json, random
from pathlib import Path
import joblib
from sklearn.ensemble import RandomForestRegressor

random.seed(7); features=['fill_level','fill_rate','hour','day_of_week','hours_since_collection']; X=[]; y=[]
for _ in range(1500):
    fill=random.uniform(5,95); rate=random.uniform(.1,8); hour=random.randint(0,23); dow=random.randint(0,6); since=random.uniform(0,72)
    X.append([fill,rate,hour,dow,since]); y.append(max(0,(95-fill)/rate)*(1.15 if hour in (11,12,13,17,18) else 1.0))
model=RandomForestRegressor(n_estimators=60,max_depth=10,random_state=7,n_jobs=1); model.fit(X,y)
out=Path('model_artifact'); out.mkdir(exist_ok=True); joblib.dump(model,out/'model.joblib'); (out/'features.json').write_text(json.dumps(features))
repo=os.getenv('HF_MODEL_REPO'); token=os.getenv('HF_TOKEN')
if repo and token:
    from huggingface_hub import HfApi
    api=HfApi(token=token); api.create_repo(repo_id=repo,repo_type='model',exist_ok=True); api.upload_folder(folder_path=str(out),repo_id=repo,repo_type='model',commit_message='Upload SmartBin fill prediction model')
print('Saved model_artifact/model.joblib')
