import os
import json
from typing import List, Dict, Any, Optional
from backend.app.core.config import DATA_DIR

class ObservationService:
    def __init__(self, json_path: Optional[str] = None):
        self.json_path = json_path or os.path.join(DATA_DIR, "in_situ_observations.json")
        self._cache: Optional[List[Dict[str, Any]]] = None

    def _load_data(self) -> List[Dict[str, Any]]:
        if self._cache is None:
            if os.path.exists(self.json_path):
                with open(self.json_path, 'r', encoding='utf-8') as f:
                    self._cache = json.load(f)
            else:
                self._cache = []
        return self._cache

    def list_observations(self, source_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        data = self._load_data()
        results = []
        for obs in data:
            if source_filter and obs.get("type", "").upper() != source_filter.upper():
                continue
            # Return lightweight overview marker
            results.append({
                "id": obs["id"],
                "name": obs["name"],
                "type": obs["type"],
                "latitude": obs["latitude"],
                "longitude": obs["longitude"],
                "timestamp": obs["timestamp"],
                "quality": obs["quality"],
                "source": obs["source"],
                "depth_range": obs["depth_range"],
                "surface_temp": obs.get("surface_temp"),
                "surface_salinity": obs.get("surface_salinity"),
                "measurements_count": len(obs.get("measurements", []))
            })
        return results

    def get_observation_profile(self, obs_id: str) -> Optional[Dict[str, Any]]:
        data = self._load_data()
        for obs in data:
            if obs["id"] == obs_id:
                return obs
        return None
