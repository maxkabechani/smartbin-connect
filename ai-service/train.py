"""Train the SmartBin fill-time model and write model.joblib.

If data/telemetry.csv is not present, a deterministic synthetic telemetry set
is generated so the demo can be trained end-to-end without private data.
Expected CSV columns: fill_level, fill_rate, hour, weekday,
hours_since_collection, hours_until_full.
"""

from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestRegressor


ROOT = Path(__file__).parent
DATA = ROOT / "data" / "telemetry.csv"
OUTPUT = ROOT / "model.joblib"
FEATURES = ["fill_level", "fill_rate", "hour", "weekday", "hours_since_collection"]


def load_training_data():
    if DATA.exists():
        rows = np.genfromtxt(DATA, delimiter=",", names=True)
        x = np.column_stack([rows[name] for name in FEATURES])
        y = rows["hours_until_full"]
        return x, y

    rng = np.random.default_rng(42)
    count = 1600
    fill = rng.uniform(5, 96, count)
    rate = rng.uniform(0.15, 7.0, count)
    hour = rng.integers(0, 24, count)
    weekday = rng.integers(0, 7, count)
    since_collection = rng.uniform(0, 120, count)
    demand_factor = 1.0 + 0.22 * ((hour >= 7) & (hour <= 9)) + 0.18 * ((hour >= 16) & (hour <= 19))
    effective_rate = rate * demand_factor
    target = np.maximum(0, (95 - fill) / effective_rate)
    target += rng.normal(0, 0.35, count)
    target = np.maximum(0, target)
    x = np.column_stack([fill, rate, hour, weekday, since_collection])
    return x, target


def main():
    x, y = load_training_data()
    model = RandomForestRegressor(n_estimators=180, random_state=42, min_samples_leaf=3, n_jobs=-1)
    model.fit(x, y)
    joblib.dump(model, OUTPUT)
    print(f"trained {len(x)} samples -> {OUTPUT}")


if __name__ == "__main__":
    main()
