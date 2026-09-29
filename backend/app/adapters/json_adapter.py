import os
import json
from typing import List, Dict, Any
from backend.app.adapters.base import BaseDataAdapter, OceanDataPoint
from backend.app.core.registry import get_variable_metadata

class JSONAdapter(BaseDataAdapter):
    """
    Adapter for GeoJSON or nested JSON observation profiles (Argo profiles, Glider transects).
    """
    def __init__(self, source_name: str = "JSON_FEED"):
        super().__init__(source_name=source_name)

    def validate_format(self, file_path_or_str: str) -> bool:
        try:
            if os.path.exists(file_path_or_str):
                with open(file_path_or_str, 'r', encoding='utf-8') as f:
                    data = json.load(f)
            else:
                data = json.loads(file_path_or_str)
            return isinstance(data, (list, dict))
        except Exception:
            return False

    def inspect_dataset(self, file_path: str) -> Dict[str, Any]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        items = data if isinstance(data, list) else data.get("features", data.get("profiles", [data]))
        sample = items[0] if items else {}

        return {
            "format": "GeoJSON / Profile JSON",
            "format_valid": True,
            "profiles_count": len(items),
            "sample_keys": list(sample.keys()) if isinstance(sample, dict) else [],
            "ready_for_visualization": True
        }

    def read(self, file_path_or_str: str, **kwargs) -> List[OceanDataPoint]:
        if os.path.exists(file_path_or_str):
            with open(file_path_or_str, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = json.loads(file_path_or_str)

        points: List[OceanDataPoint] = []
        profiles = data if isinstance(data, list) else data.get("profiles", data.get("features", []))

        for prof in profiles:
            lat = float(prof.get("latitude", prof.get("lat", 0.0)))
            lon = float(prof.get("longitude", prof.get("lon", 0.0)))
            time_val = prof.get("timestamp", prof.get("time", "2026-09-28T00:00:00Z"))
            source = prof.get("source", self.source_name)
            qc = int(prof.get("quality_flag", prof.get("qc", 1)))

            # Check if this profile has vertical profile measurements
            measurements = prof.get("measurements", prof.get("levels", []))
            if measurements:
                for m in measurements:
                    depth = float(m.get("depth", 0.0))
                    for k, val in m.items():
                        if k in ["depth", "qc"]:
                            continue
                        if val is not None:
                            meta = get_variable_metadata(k)
                            points.append(OceanDataPoint(
                                latitude=lat,
                                longitude=lon,
                                depth=depth,
                                timestamp=time_val,
                                variable=k,
                                value=float(val),
                                unit=meta.get("unit", ""),
                                source=source,
                                quality_flag=int(m.get("qc", qc))
                            ))
            else:
                depth = float(prof.get("depth", 0.0))
                for k in ["temperature", "salinity", "chlorophyll", "oxygen"]:
                    if k in prof and prof[k] is not None:
                        meta = get_variable_metadata(k)
                        points.append(OceanDataPoint(
                            latitude=lat,
                            longitude=lon,
                            depth=depth,
                            timestamp=time_val,
                            variable=k,
                            value=float(prof[k]),
                            unit=meta.get("unit", ""),
                            source=source,
                            quality_flag=qc
                        ))
        return points
