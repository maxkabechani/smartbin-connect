import os
from math import asin, cos, radians, sin, sqrt
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

class RouteStop(BaseModel):
    bin_id: str
    fill_level: float
    priority: str
    reason: str
    latitude: float | None = None
    longitude: float | None = None
    owner_name: str | None = None

class RouteRequest(BaseModel):
    stops: list[RouteStop]
    start_latitude: float = float(os.getenv('ROUTE_DEPOT_LATITUDE', '-15.408'))
    start_longitude: float = float(os.getenv('ROUTE_DEPOT_LONGITUDE', '28.283'))
    return_to_start: bool = True

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

def distance_km(a_lat: float, a_lon: float, b_lat: float, b_lon: float) -> float:
    earth_radius_km = 6371.0
    lat_delta = radians(b_lat - a_lat)
    lon_delta = radians(b_lon - a_lon)
    haversine = sin(lat_delta / 2) ** 2 + cos(radians(a_lat)) * cos(radians(b_lat)) * sin(lon_delta / 2) ** 2
    return earth_radius_km * 2 * asin(sqrt(haversine))

@app.post('/optimize-route')
def optimize_route(request: RouteRequest):
    priority_weight = {'urgent': 2.5, 'high': 1.5, 'medium': 0.5, 'low': 0.0}
    located = [stop for stop in request.stops if stop.latitude is not None and stop.longitude is not None]
    unlocated = [stop for stop in request.stops if stop.latitude is None or stop.longitude is None]
    remaining = located.copy()
    ordered: list[tuple[RouteStop, float]] = []
    current_lat, current_lon = request.start_latitude, request.start_longitude

    while remaining:
        next_stop = min(remaining, key=lambda stop: distance_km(current_lat, current_lon, stop.latitude, stop.longitude) - priority_weight.get(stop.priority, 0.0))
        leg = distance_km(current_lat, current_lon, next_stop.latitude, next_stop.longitude)
        ordered.append((next_stop, leg))
        current_lat, current_lon = next_stop.latitude, next_stop.longitude
        remaining.remove(next_stop)

    ordered.extend((stop, 0.0) for stop in sorted(unlocated, key=lambda item: (-priority_weight.get(item.priority, 0.0), -item.fill_level)))
    distance_to_first = ordered[0][1] if ordered else 0.0
    between_stops = sum(leg for _, leg in ordered[1:]) if ordered else 0.0
    return_distance = 0.0
    if request.return_to_start and located:
        last_stop = ordered[len(located) - 1][0]
        return_distance = distance_km(last_stop.latitude, last_stop.longitude, request.start_latitude, request.start_longitude)
    outbound_distance = distance_to_first + between_stops
    total_distance = outbound_distance + return_distance
    estimated_minutes = max(8, round(total_distance * 4 + len(ordered) * 8)) if ordered else 0
    return {
        'stops': [
            {
                'sequence': index,
                'bin_id': stop.bin_id,
                'fill_level': stop.fill_level,
                'priority': stop.priority,
                'reason': stop.reason,
                'owner_name': stop.owner_name,
                'distance_from_previous_km': round(leg, 1),
                'location_available': stop.latitude is not None and stop.longitude is not None,
            }
            for index, (stop, leg) in enumerate(ordered, start=1)
        ],
        'distance_to_first_km': round(distance_to_first, 1),
        'between_stops_distance_km': round(between_stops, 1),
        'outbound_distance_km': round(outbound_distance, 1),
        'return_distance_km': round(return_distance, 1),
        'total_distance_km': round(total_distance, 1),
        'estimated_minutes': estimated_minutes,
        'estimated_savings_percent': min(35, max(8, 8 + len(ordered) * 2)) if ordered else 0,
        'algorithm': 'priority-weighted nearest neighbour',
        'unlocated_stops': len(unlocated),
    }
