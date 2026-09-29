import os
import pandas as pd
import numpy as np
from typing import List, Dict, Any
from backend.app.adapters.base import BaseDataAdapter, OceanDataPoint
from backend.app.core.registry import get_variable_metadata

class CSVAdapter(BaseDataAdapter):
    """
    Adapter for tabular in-situ observations (Argo floats, CTD casts, Glider transects)
    in CSV format.
    """
    def __init__(self, source_name: str = "IN_SITU_OBSERVATION"):
        super().__init__(source_name=source_name)

    def validate_format(self, file_path: str) -> bool:
        if not os.path.exists(file_path):
            return False
        try:
            df = pd.read_csv(file_path, nrows=5)
            cols = [c.lower() for c in df.columns]
            has_lat = any(k in cols for k in ['lat', 'latitude'])
            has_lon = any(k in cols for k in ['lon', 'longitude'])
            return has_lat and has_lon
        except Exception:
            return False

    def inspect_dataset(self, file_path: str) -> Dict[str, Any]:
        df = pd.read_csv(file_path)
        cols_lower = {c.lower(): c for c in df.columns}
        
        lat_col = next(cols_lower[k] for k in ['lat', 'latitude'] if k in cols_lower)
        lon_col = next(cols_lower[k] for k in ['lon', 'longitude'] if k in cols_lower)
        depth_col = next((cols_lower[k] for k in ['depth', 'depth_m', 'pressure'] if k in cols_lower), None)
        time_col = next((cols_lower[k] for k in ['time', 'timestamp', 'date', 'datetime'] if k in cols_lower), None)

        var_candidates = [c for c in df.columns if c not in [lat_col, lon_col, depth_col, time_col, 'id', 'qc', 'quality']]

        return {
            "format": "Delimited CSV",
            "format_valid": True,
            "rows_detected": len(df),
            "coordinates_detected": {
                "latitude": {"name": lat_col, "min": float(df[lat_col].min()), "max": float(df[lat_col].max())},
                "longitude": {"name": lon_col, "min": float(df[lon_col].min()), "max": float(df[lon_col].max())},
                "depth": {"name": depth_col, "min": float(df[depth_col].min()) if depth_col else 0.0, "max": float(df[depth_col].max()) if depth_col else 0.0}
            },
            "variables_detected": var_candidates,
            "time_detected": {
                "column": time_col,
                "first": str(df[time_col].iloc[0]) if time_col else "N/A",
                "last": str(df[time_col].iloc[-1]) if time_col else "N/A"
            },
            "ready_for_visualization": True
        }

    def read(self, file_path: str, **kwargs) -> List[OceanDataPoint]:
        df = pd.read_csv(file_path)
        cols_lower = {c.lower(): c for c in df.columns}
        
        lat_col = next(cols_lower[k] for k in ['lat', 'latitude'] if k in cols_lower)
        lon_col = next(cols_lower[k] for k in ['lon', 'longitude'] if k in cols_lower)
        depth_col = next((cols_lower[k] for k in ['depth', 'depth_m', 'pressure'] if k in cols_lower), None)
        time_col = next((cols_lower[k] for k in ['time', 'timestamp', 'date', 'datetime'] if k in cols_lower), None)
        qc_col = next((cols_lower[k] for k in ['qc', 'quality', 'flag'] if k in cols_lower), None)

        var_cols = [c for c in df.columns if c not in [lat_col, lon_col, depth_col, time_col, qc_col, 'id', 'float_id']]

        points = []
        for _, row in df.iterrows():
            lat = float(row[lat_col])
            lon = float(row[lon_col])
            depth = float(row[depth_col]) if depth_col else 0.0
            time_val = str(row[time_col]) if time_col else "2026-09-28T00:00:00Z"
            qc = int(row[qc_col]) if qc_col and not pd.isna(row[qc_col]) else 1

            for vcol in var_cols:
                val = row[vcol]
                if pd.isna(val):
                    continue
                meta = get_variable_metadata(vcol.lower())
                points.append(OceanDataPoint(
                    latitude=lat,
                    longitude=lon,
                    depth=depth,
                    timestamp=time_val,
                    variable=vcol.lower(),
                    value=float(val),
                    unit=meta.get("unit", ""),
                    source=self.source_name,
                    quality_flag=qc
                ))
        return points
