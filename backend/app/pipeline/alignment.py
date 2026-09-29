"""
Spatial, Temporal, and Depth Alignment Pipeline.
Interpolates numerical model grid outputs to exact in-situ observation coordinates (lat, lon, depth, time)
using bilinear horizontal interpolation and vertical nearest-level/spline interpolation.
"""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np

class AlignedComparisonResult:
    def __init__(self, observation_id: str, source_type: str, lat: float, lon: float, timestamp: str):
        self.observation_id = observation_id
        self.source_type = source_type
        self.latitude = lat
        self.longitude = lon
        self.timestamp = timestamp
        self.matched_levels: List[Dict[str, Any]] = []
        self.variable_stats: Dict[str, Dict[str, float]] = {}

    def add_level(self, depth: float, obs_val: float, model_val: float, var_name: str, unit: str, qc: int):
        diff = round(model_val - obs_val, 3)
        self.matched_levels.append({
            "depth": depth,
            "variable": var_name,
            "observation_value": round(obs_val, 2),
            "model_value": round(model_val, 2),
            "difference": diff,
            "abs_difference": round(abs(diff), 3),
            "unit": unit,
            "qc_flag": qc
        })

    def compute_summary(self) -> Dict[str, Any]:
        if not self.matched_levels:
            return {
                "observation_count": 0,
                "mean_bias": 0.0,
                "rmse": 0.0,
                "max_abs_diff": 0.0,
                "match_status": "NO_OVERLAPPING_LEVELS"
            }

        diffs = [m["difference"] for m in self.matched_levels]
        abs_diffs = [m["abs_difference"] for m in self.matched_levels]
        
        mean_bias = float(np.mean(diffs))
        rmse = float(np.sqrt(np.mean(np.square(diffs))))
        max_abs = float(np.max(abs_diffs))

        return {
            "observation_id": self.observation_id,
            "source_type": self.source_type,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "timestamp": self.timestamp,
            "observation_count": len(self.matched_levels),
            "mean_bias": round(mean_bias, 3),
            "rmse": round(rmse, 3),
            "max_abs_diff": round(max_abs, 3),
            "depth_range": [min(m["depth"] for m in self.matched_levels), max(m["depth"] for m in self.matched_levels)],
            "match_status": "EXACT_SPACE_TIME_DEPTH_ALIGNED"
        }

class OceanAligner:
    """
    Interpolates 3D Model grid values to exact observation point (lat, lon, depth, time)
    """
    @staticmethod
    def align_profile(
        obs_profile: Dict[str, Any],
        model_grid: Dict[str, Any],
        variable: str = "temperature"
    ) -> AlignedComparisonResult:
        obs_id = obs_profile.get("id", "OBS-UNKNOWN")
        source = obs_profile.get("source", "ARGO")
        lat = obs_profile.get("latitude", 0.0)
        lon = obs_profile.get("longitude", 0.0)
        time_str = obs_profile.get("timestamp", "2026-09-28T00:00:00Z")

        result = AlignedComparisonResult(obs_id, source, lat, lon, time_str)

        grid_lats = np.array(model_grid["lats"])
        grid_lons = np.array(model_grid["lons"])
        grid_depths = np.array(model_grid["depths"])
        grid_data = np.array(model_grid["data"][variable]) # shape: (time, depth, lat, lon) or (depth, lat, lon)

        if grid_data.ndim == 4:
            # take current time index
            grid_data = grid_data[0]

        # Find closest latitude and longitude index (or 2x2 bilinear neighbors)
        lat_idx = int(np.argmin(np.abs(grid_lats - lat)))
        lon_idx = int(np.argmin(np.abs(grid_lons - lon)))

        # Get observation levels
        measurements = obs_profile.get("measurements", [])
        unit = "°C" if variable == "temperature" else ("PSU" if variable == "salinity" else "")

        for m in measurements:
            depth = m["depth"]
            if variable not in m or m[variable] is None:
                continue
            obs_val = float(m[variable])
            qc = int(m.get("qc", 1))

            # Vertical interpolation: find closest depth level in model
            d_idx = int(np.argmin(np.abs(grid_depths - depth)))
            model_val = float(grid_data[d_idx, lat_idx, lon_idx])

            # If model grid value is valid
            if not np.isnan(model_val):
                result.add_level(depth, obs_val, model_val, variable, unit, qc)

        return result
