import os
import xarray as xr
import numpy as np
from typing import Dict, Any, List, Optional
from backend.app.core.config import DATA_DIR
from backend.app.core.registry import get_variable_metadata

class OceanService:
    def __init__(self, nc_path: Optional[str] = None):
        self.nc_path = nc_path or os.path.join(DATA_DIR, "model_indian_ocean.nc")
        self._ds: Optional[xr.Dataset] = None

    def _load_dataset(self) -> xr.Dataset:
        if self._ds is None:
            self._ds = xr.open_dataset(self.nc_path, engine='netcdf4')
        return self._ds

    def get_metadata(self) -> Dict[str, Any]:
        ds = self._load_dataset()
        return {
            "title": ds.attrs.get("title", "OceanX Model Data"),
            "source_type": ds.attrs.get("source_type", "DEMO DATASET"),
            "dimensions": {
                "latitude": {"min": float(ds.latitude.min()), "max": float(ds.latitude.max()), "count": len(ds.latitude)},
                "longitude": {"min": float(ds.longitude.min()), "max": float(ds.longitude.max()), "count": len(ds.longitude)},
                "depth": [float(d) for d in ds.depth.values],
                "time": [str(np.datetime_as_string(t, unit='s')) for t in ds.time.values]
            },
            "variables": list(ds.data_vars.keys())
        }

    def get_slice(
        self,
        variable: str = "temperature",
        depth: float = 0.0,
        time_index: int = 0
    ) -> Dict[str, Any]:
        """
        Retrieves horizontal depth slice (lat x lon) for the requested variable and depth.
        """
        ds = self._load_dataset()
        var_key = variable
        if var_key not in ds.data_vars:
            if var_key == "currents":
                var_key = "u"
            else:
                var_key = "temperature"

        meta = get_variable_metadata(variable)

        # Find closest depth
        depths = ds.depth.values
        depth_idx = int(np.argmin(np.abs(depths - depth)))
        actual_depth = float(depths[depth_idx])

        # Slice data
        time_index = min(max(0, time_index), len(ds.time) - 1)
        sub_da = ds[var_key].isel(time=time_index, depth=depth_idx)
        raw_vals = sub_da.values

        # If currents, compute magnitude speed
        if variable == "currents":
            u_vals = ds["u"].isel(time=time_index, depth=depth_idx).values
            v_vals = ds["v"].isel(time=time_index, depth=depth_idx).values
            raw_vals = np.sqrt(u_vals**2 + v_vals**2)

        valid_vals = raw_vals[~np.isnan(raw_vals)]
        vmin = float(np.min(valid_vals)) if len(valid_vals) else 0.0
        vmax = float(np.max(valid_vals)) if len(valid_vals) else 1.0
        vmean = float(np.mean(valid_vals)) if len(valid_vals) else 0.0
        vstd = float(np.std(valid_vals)) if len(valid_vals) else 0.0

        return {
            "variable": variable,
            "label": meta["label"],
            "unit": meta["unit"],
            "requested_depth": depth,
            "actual_depth": actual_depth,
            "time_index": time_index,
            "timestamp": str(np.datetime_as_string(ds.time.values[time_index], unit='s')),
            "lats": [float(y) for y in ds.latitude.values],
            "lons": [float(x) for x in ds.longitude.values],
            "grid_shape": [len(ds.latitude), len(ds.longitude)],
            "values": np.round(raw_vals.astype(float), 3).tolist(),
            "stats": {
                "min": round(vmin, 3),
                "max": round(vmax, 3),
                "mean": round(vmean, 3),
                "std": round(vstd, 3)
            }
        }

    def get_current_vectors(self, depth: float = 0.0, time_index: int = 0, step: int = 2) -> Dict[str, Any]:
        """
        Subsampled horizontal vector field (u, v) for particle flow and current arrows
        """
        ds = self._load_dataset()
        depths = ds.depth.values
        depth_idx = int(np.argmin(np.abs(depths - depth)))
        actual_depth = float(depths[depth_idx])

        time_index = min(max(0, time_index), len(ds.time) - 1)
        u = ds["u"].isel(time=time_index, depth=depth_idx).values
        v = ds["v"].isel(time=time_index, depth=depth_idx).values

        lats = ds.latitude.values
        lons = ds.longitude.values

        vectors = []
        for i in range(0, len(lats), step):
            for j in range(0, len(lons), step):
                u_val = float(u[i, j])
                v_val = float(v[i, j])
                speed = float(np.sqrt(u_val**2 + v_val**2))
                vectors.append({
                    "lat": float(lats[i]),
                    "lon": float(lons[j]),
                    "u": round(u_val, 3),
                    "v": round(v_val, 3),
                    "speed": round(speed, 3)
                })

        return {
            "depth": actual_depth,
            "timestamp": str(np.datetime_as_string(ds.time.values[time_index], unit='s')),
            "count": len(vectors),
            "vectors": vectors
        }

    def get_xray_layers(self, variable: str = "temperature", time_index: int = 0) -> Dict[str, Any]:
        """
        Returns full multi-depth profile stepping (0, 25, 50, 100, 250, 500, 1000, 2000m)
        with oceanographic layer categorization (Mixed Layer, Upper Thermocline, Main Thermocline, Deep Abyss).
        """
        target_depths = [0, 25, 50, 100, 250, 500, 1000, 2000]
        layers = []
        for d in target_depths:
            s = self.get_slice(variable=variable, depth=d, time_index=time_index)
            layer_name = "Surface Mixed Layer" if d <= 50 else (
                "Upper Thermocline" if d <= 150 else (
                    "Main Thermocline" if d <= 500 else (
                        "Intermediate Water" if d <= 1000 else "Deep Abyssal Ocean"
                    )
                )
            )
            layers.append({
                "depth": d,
                "layer_name": layer_name,
                "stats": s["stats"],
                "values": s["values"]
            })

        return {
            "variable": variable,
            "target_depths": target_depths,
            "layers": layers
        }

    def get_vertical_cross_section(
        self,
        variable: str = "temperature",
        section_type: str = "latitudinal", # or 'longitudinal'
        fixed_coord: float = 12.0,
        time_index: int = 0
    ) -> Dict[str, Any]:
        """
        Extracts depth vs latitude or depth vs longitude vertical transect
        """
        ds = self._load_dataset()
        var_key = variable if variable in ds.data_vars else "temperature"
        time_index = min(max(0, time_index), len(ds.time) - 1)

        if section_type == "latitudinal": # along a given latitude (varying longitude)
            lats = ds.latitude.values
            lat_idx = int(np.argmin(np.abs(lats - fixed_coord)))
            actual_coord = float(lats[lat_idx])
            transect = ds[var_key].isel(time=time_index, latitude=lat_idx).values # shape: (depth, lon)
            x_axis = [float(x) for x in ds.longitude.values]
            x_label = "Longitude (°E)"
        else: # longitudinal along given lon (varying latitude)
            lons = ds.longitude.values
            lon_idx = int(np.argmin(np.abs(lons - fixed_coord)))
            actual_coord = float(lons[lon_idx])
            transect = ds[var_key].isel(time=time_index, longitude=lon_idx).values # shape: (depth, lat)
            x_axis = [float(y) for y in ds.latitude.values]
            x_label = "Latitude (°N)"

        depths = [float(d) for d in ds.depth.values]
        return {
            "variable": variable,
            "section_type": section_type,
            "fixed_coordinate": actual_coord,
            "x_axis": x_axis,
            "x_label": x_label,
            "depths": depths,
            "matrix": np.round(transect.astype(float), 3).tolist()
        }
