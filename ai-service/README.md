---
library_name: scikit-learn
tags:
  - smart-city
  - waste-management
  - tabular-regression
---

# SmartBin fill predictor

This model estimates hours until a bin reaches collection capacity. It is
trained by `train.py` from telemetry features: fill level, fill rate, hour,
weekday, and hours since collection.

The SmartBin API consumes it through the separate AI service. The service
falls back to an explainable calculation when the model is unavailable.

To retrain locally, install `requirements.txt` with Python and run:

```bash
python train.py
```
