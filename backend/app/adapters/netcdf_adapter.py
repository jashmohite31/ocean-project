import os
import xarray as xr
import numpy as np
from typing import List, Dict, Any, Optional
from backend.app.adapters.base import BaseDataAdapter, OceanDataPoint
from backend.app.core.registry import get_variable_metadata

class NetCDFAdapter(BaseDataAdapter):
    """
    Adapter for ocean model outputs and gridded observation datasets in NetCDF format (.nc).
    Handles latitude/longitude coordinates, depth/depth_levels, and multi-temporal dimensions.
    """
    def __init__(self, source_name: str = "NUMERICAL_MODEL"):
        super().__init__(source_name=source_name)

    def validate_format(self, file_path: str) -> bool:
        if not os.path.exists(file_path):
            return False
        try:
            with xr.open_dataset(file_path) as ds:
                # Check for spatial coordinates
                lat_present = any(k in ds.coords or k in ds.variables for k in ['lat', 'latitude', 'nav_lat'])
                lon_present = any(k in ds.coords or k in ds.variables for k in ['lon', 'longitude', 'nav_lon'])
                return lat_present and lon_present
        except Exception:
            return False

    def inspect_dataset(self, file_path: str) -> Dict[str, Any]:
        """Inspect NetCDF structure for upload verification checklist"""
        with xr.open_dataset(file_path) as ds:
            coords = list(ds.coords.keys())
            variables = [v for v in ds.data_vars.keys()]
            
            # Find depth coordinate
            depth_key = next((k for k in ['depth', 'depth_level', 'lev', 'z'] if k in ds.coords or k in ds.variables), None)
            depths = [float(d) for d in ds[depth_key].values] if depth_key else [0.0]
            
            # Find time coordinate
            time_key = next((k for k in ['time', 'date', 'timestamp'] if k in ds.coords or k in ds.variables), None)
            times = [str(t) for t in ds[time_key].values[:5]] if time_key else ["2026-09-28T00:00:00Z"]

            lat_key = next(k for k in ['lat', 'latitude', 'nav_lat'] if k in ds.coords or k in ds.variables)
            lon_key = next(k for k in ['lon', 'longitude', 'nav_lon'] if k in ds.coords or k in ds.variables)

            return {
                "format": "NetCDF-4",
                "format_valid": True,
                "coordinates_detected": {
                    "latitude": {"name": lat_key, "min": float(np.nanmin(ds[lat_key].values)), "max": float(np.nanmax(ds[lat_key].values))},
                    "longitude": {"name": lon_key, "min": float(np.nanmin(ds[lon_key].values)), "max": float(np.nanmax(ds[lon_key].values))},
                    "depth": {"name": depth_key, "levels": len(depths), "depth_range": [min(depths), max(depths)] if depths else [0, 0]}
                },
                "variables_detected": variables,
                "time_detected": {
                    "count": len(times),
                    "samples": times
                },
                "dimensions": dict(ds.sizes),
                "ready_for_visualization": True
            }

    def read(self, file_path: str, variable: str = "temperature", depth_index: int = 0, time_index: int = 0) -> List[OceanDataPoint]:
        points: List[OceanDataPoint] = []
        with xr.open_dataset(file_path) as ds:
            # Map canonical variable name to dataset variable
            var_name = variable
            if variable not in ds.data_vars:
                candidates = [v for v in ds.data_vars if variable.lower() in v.lower()]
                if candidates:
                    var_name = candidates[0]
                else:
                    return []

            da = ds[var_name]
            meta = get_variable_metadata(variable)

            lat_key = next(k for k in ['lat', 'latitude', 'nav_lat'] if k in ds.coords or k in ds.variables)
            lon_key = next(k for k in ['lon', 'longitude', 'nav_lon'] if k in ds.coords or k in ds.variables)
            depth_key = next((k for k in ['depth', 'depth_level', 'lev', 'z'] if k in ds.coords or k in ds.variables), None)
            time_key = next((k for k in ['time', 'date', 'timestamp'] if k in ds.coords or k in ds.variables), None)

            slice_dict = {}
            if depth_key and depth_key in da.dims:
                slice_dict[depth_key] = ds[depth_key].values[depth_index]
            if time_key and time_key in da.dims:
                slice_dict[time_key] = ds[time_key].values[time_index]

            sub_da = da.sel(slice_dict) if slice_dict else da
            lats = ds[lat_key].values
            lons = ds[lon_key].values
            vals = sub_da.values

            depth_val = float(ds[depth_key].values[depth_index]) if depth_key else 0.0
            time_val = str(ds[time_key].values[time_index]) if time_key else "2026-09-28T00:00:00Z"

            for i, lat in enumerate(lats):
                for j, lon in enumerate(lons):
                    v = vals[i, j] if vals.ndim == 2 else vals[0, i, j]
                    if not np.isnan(v):
                        points.append(OceanDataPoint(
                            latitude=float(lat),
                            longitude=float(lon),
                            depth=depth_val,
                            timestamp=time_val,
                            variable=variable,
                            value=float(v),
                            unit=meta["unit"],
                            source=self.source_name,
                            quality_flag=1
                        ))
        return points
