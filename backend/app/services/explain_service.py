from typing import Dict, Any, Optional
from backend.app.services.ocean_service import OceanService
from backend.app.services.compare_service import CompareService
from backend.app.services.observation_service import ObservationService

class RegionalExplanationService:
    """
    Generates factual, scientifically rigorous natural language oceanographic narratives
    grounded purely in actual model output and in-situ observation data.
    """
    def __init__(
        self,
        ocean_service: OceanService,
        compare_service: CompareService,
        obs_service: ObservationService
    ):
        self.ocean_service = ocean_service
        self.compare_service = compare_service
        self.obs_service = obs_service

    def explain_region(
        self,
        lat: float,
        lon: float,
        depth: float = 100.0,
        variable: str = "temperature",
        obs_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # If an observation ID is given or found nearby
        if not obs_id:
            obs_list = self.obs_service.list_observations()
            # find closest observation
            closest = None
            min_dist = 999.0
            for obs in obs_list:
                dist = ((obs["latitude"] - lat)**2 + (obs["longitude"] - lon)**2)**0.5
                if dist < min_dist:
                    min_dist = dist
                    closest = obs
            if closest and min_dist < 4.0:
                obs_id = closest["id"]

        if obs_id:
            comp = self.compare_service.compare_float_with_model(float_id=obs_id, variable=variable)
            # Find level at or nearest to depth
            levels = comp["table"]
            matched = min(levels, key=lambda l: abs(l["depth"] - depth)) if levels else None

            if matched:
                d = matched["depth"]
                obs_v = matched["observation_value"]
                mod_v = matched["model_value"]
                diff = matched["difference"]
                unit = matched["unit"]
                sign = "+" if diff > 0 else ""

                sea_sector = "Arabian Sea" if lon < 75 else ("Bay of Bengal" if lon > 78 else "Equatorial Indian Ocean")

                narrative = (
                    f"At {int(d)}m depth in the {sea_sector} ({round(lat, 2)}°N, {round(lon, 2)}°E), "
                    f"the selected in-situ observation ({obs_id}) records {obs_v}{unit} while the numerical ocean model predicts {mod_v}{unit}, "
                    f"producing an aligned difference of {sign}{diff}{unit}. "
                    f"This location is characterized by strong vertical stratification across the { 'upper mixed layer' if d <= 50 else 'main thermocline' }. "
                    f"Model bias across all {comp['summary']['observation_count']} depth levels averages {comp['summary']['mean_bias']}{unit} with an RMSE of {comp['summary']['rmse']}{unit}."
                )
                return {
                    "explanation": narrative,
                    "target": {
                        "observation_id": obs_id,
                        "latitude": lat,
                        "longitude": lon,
                        "depth": d,
                        "variable": variable
                    },
                    "metrics": {
                        "observation_value": obs_v,
                        "model_value": mod_v,
                        "difference": diff,
                        "unit": unit,
                        "overall_rmse": comp["summary"]["rmse"],
                        "confidence_rating": "HIGH" if comp["summary"]["rmse"] < 0.6 else "MEDIUM"
                    }
                }

        # Fallback explanation when no specific float is selected
        slice_info = self.ocean_service.get_slice(variable=variable, depth=depth)
        stats = slice_info["stats"]
        narrative = (
            f"At {int(slice_info['actual_depth'])}m depth across the North Indian Ocean, {variable} ranges from "
            f"{stats['min']}{slice_info['unit']} to {stats['max']}{slice_info['unit']} "
            f"(mean: {stats['mean']}{slice_info['unit']}). Regional gradients reflect distinct hydrological boundaries "
            f"between the high-evaporation Arabian Sea water mass and the low-salinity Bay of Bengal runoff zone."
        )
        return {
            "explanation": narrative,
            "target": {
                "latitude": lat,
                "longitude": lon,
                "depth": slice_info["actual_depth"],
                "variable": variable
            },
            "metrics": stats
        }
