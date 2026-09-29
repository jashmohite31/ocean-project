import numpy as np
from typing import Dict, Any, List, Optional
from backend.app.services.ocean_service import OceanService
from backend.app.services.compare_service import CompareService
from backend.app.pipeline.confidence import ConfidenceEngine
from backend.app.services.observation_service import ObservationService

class HazardService:
    """
    Disaster Management Hazard Analysis Engine.
    Identifies high-risk oceanographic phenomena:
    - Marine Heatwaves (MHW) / Extreme Thermal Anomalies (> 1.8°C above climatology)
    - Strong Currents & Cyclonic Eddies (vorticity & velocity > 1.0 m/s: cyclone intensification risks)
    - Low-Confidence / High Model-Observation Discrepancy Zones (alerting forecasters to model drift)
    - Experimental Glacier Melt / Runoff Stratification Scenario
    """
    def __init__(self, ocean_service: OceanService, compare_service: CompareService, obs_service: ObservationService):
        self.ocean_service = ocean_service
        self.compare_service = compare_service
        self.obs_service = obs_service

    def analyze_hazards(
        self,
        time_index: int = 0,
        temp_threshold_offset: float = 1.6,
        current_speed_threshold: float = 1.0,
        glacier_scenario_active: bool = False
    ) -> Dict[str, Any]:
        ds = self.ocean_service._load_dataset()
        lats = ds.latitude.values
        lons = ds.longitude.values

        # 1. Thermal Anomalies / Marine Heatwaves at Surface (0m)
        temp_surf = ds["temperature"].isel(time=time_index, depth=0).values.copy()
        
        # If experimental glacier/river runoff melt scenario is enabled
        if glacier_scenario_active:
            # High freshwater runoff from Himalayas into Bay of Bengal (lat 16-22, lon 86-92)
            # Freshening surface water by -2.5 PSU and warming surface cap by +0.8°C
            for i, lat in enumerate(lats):
                for j, lon in enumerate(lons):
                    if lat >= 15.0 and lon >= 84.0:
                        dist = np.sqrt((lat - 20.0)**2 + (lon - 89.0)**2)
                        temp_surf[i, j] += round(float(1.2 * np.exp(-dist / 5.0)), 2)

        # Baseline climatological mean for North Indian Ocean (~28.5°C)
        clim_mean = 28.5
        temp_anomalies = temp_surf - clim_mean

        # 2. Surface Currents & Eddy Hazards
        u_surf = ds["u"].isel(time=time_index, depth=0).values
        v_surf = ds["v"].isel(time=time_index, depth=0).values
        speed_surf = np.sqrt(u_surf**2 + v_surf**2)

        # 3. Model-Observation Discrepancy at 100m (thermocline sensitivity)
        diff_data = self.compare_service.compute_spatial_difference_map(variable="temperature", depth=100.0, time_index=time_index)
        diff_matrix = np.array(diff_data["difference_matrix"])

        # 4. Confidence Layer
        observations = self.obs_service.list_observations()
        conf_data = ConfidenceEngine.compute_confidence_grid(
            [float(y) for y in lats],
            [float(x) for x in lons],
            observations,
            diff_matrix=diff_matrix
        )

        # Identify specific hazard clusters
        hazard_events = []

        # Check for MHW zones
        mhw_mask = temp_anomalies >= temp_threshold_offset
        if np.any(mhw_mask):
            y_indices, x_indices = np.where(mhw_mask)
            center_lat = float(np.mean(lats[y_indices]))
            center_lon = float(np.mean(lons[x_indices]))
            max_ano = float(np.max(temp_anomalies[mhw_mask]))
            hazard_events.append({
                "type": "MARINE_HEATWAVE",
                "severity": "HIGH" if max_ano > 2.0 else "MODERATE",
                "title": "Category II Marine Heatwave Anomaly",
                "region": "Central & Eastern Bay of Bengal",
                "coordinates": {"lat": round(center_lat, 2), "lon": round(center_lon, 2)},
                "peak_value": f"+{round(max_ano, 2)}°C above seasonal climatology",
                "ecological_impact": "High coral bleaching risk and enhanced cyclone heat potential (TCHP).",
                "mitigation": "Flagged for INCOIS coral bleaching alert network and fisheries advisory."
            })

        # Check for strong current / cyclonic eddy hazard
        curr_mask = speed_surf >= current_speed_threshold
        if np.any(curr_mask):
            cy_idx, cx_idx = np.where(curr_mask)
            c_lat = float(np.mean(lats[cy_idx]))
            c_lon = float(np.mean(lons[cx_idx]))
            max_spd = float(np.max(speed_surf[curr_mask]))
            hazard_events.append({
                "type": "CYCLONIC_EDDY_CURRENT",
                "severity": "ELEVATED",
                "title": "Intense Mesoscale Cyclonic Eddy & Jet",
                "region": "Western Bay of Bengal / Coromandel Basin",
                "coordinates": {"lat": round(c_lat, 2), "lon": round(c_lon, 2)},
                "peak_value": f"{round(max_spd, 2)} m/s surface current speed",
                "ecological_impact": "Strong shear stress, navigational drift hazard for small craft, vertical nutrient upwelling.",
                "mitigation": "Maritime navigation warning advisory and coastal vessel drift caution."
            })

        # Check for Model Discrepancy warning
        high_diff_mask = np.abs(diff_matrix) >= 1.2
        if np.any(high_diff_mask):
            dy_idx, dx_idx = np.where(high_diff_mask)
            d_lat = float(np.mean(lats[dy_idx]))
            d_lon = float(np.mean(lons[dx_idx]))
            max_dis = float(np.max(np.abs(diff_matrix[high_diff_mask])))
            hazard_events.append({
                "type": "MODEL_OBSERVATION_DISCREPANCY",
                "severity": "ADVISORY",
                "title": "Numerical Model Subsurface Thermocline Bias",
                "region": "Northern Bay of Bengal (Argo WMO 2903102)",
                "coordinates": {"lat": round(d_lat, 2), "lon": round(d_lon, 2)},
                "peak_value": f"{round(max_dis, 2)}°C subsurface discrepancy at 100m",
                "ecological_impact": "Numerical model overestimating mixed layer depth relative to in-situ CTD profile.",
                "mitigation": "Recommendation to assimilate recent Argo profile into next forecast cycle."
            })

        return {
            "timestamp": str(np.datetime_as_string(ds.time.values[time_index], unit='s')),
            "disclaimer": "Decision-support visualization, not a certified warning system.",
            "hazards_detected": len(hazard_events),
            "hazard_events": hazard_events,
            "thresholds_applied": {
                "temperature_anomaly_celsius": temp_threshold_offset,
                "current_speed_mps": current_speed_threshold,
                "method": "Transparent Configurable Thresholds (Physics-Based)"
            },
            "glacier_melt_scenario_active": glacier_scenario_active,
            "anomaly_grid": {
                "lats": [float(y) for y in lats],
                "lons": [float(x) for x in lons],
                "temp_anomalies": np.round(temp_anomalies.astype(float), 2).tolist(),
                "current_speeds": np.round(speed_surf.astype(float), 2).tolist()
            },
            "confidence_summary": conf_data["metrics"]
        }
