"""
Variable Registry Module.
Defines modular oceanographic variable metadata, colormaps, units, and visualization styles.
Adding a new variable (e.g., Oxygen, Turbidity, SSH) requires adding its definition here.
"""

from typing import Dict, Any, List

VARIABLE_REGISTRY: Dict[str, Dict[str, Any]] = {
    "temperature": {
        "id": "temperature",
        "label": "Sea Water Potential Temperature",
        "short_label": "Temperature",
        "unit": "°C",
        "type": "scalar",
        "visualization": "volume",
        "standard_name": "sea_water_potential_temperature",
        "range": {"min": 2.0, "max": 32.0},
        "color_palette": "thermal", # Viridis / Turbo / Thermal
        "description": "In-situ and numerical potential temperature across depth layers.",
        "icon": "Thermometer",
        "default_depth_slices": [0, 25, 50, 100, 250, 500, 1000, 2000]
    },
    "salinity": {
        "id": "salinity",
        "label": "Practical Salinity",
        "short_label": "Salinity",
        "unit": "PSU",
        "type": "scalar",
        "visualization": "volume",
        "standard_name": "sea_water_practical_salinity",
        "range": {"min": 31.0, "max": 37.5},
        "color_palette": "haline",
        "description": "Concentration of dissolved salts; highlights Arabian Sea vs Bay of Bengal contrast.",
        "icon": "Droplets",
        "default_depth_slices": [0, 25, 50, 100, 250, 500, 1000, 2000]
    },
    "currents": {
        "id": "currents",
        "label": "Horizontal Ocean Velocity Vectors (u, v)",
        "short_label": "Currents (u, v)",
        "unit": "m/s",
        "type": "vector",
        "visualization": "particles",
        "standard_name": "sea_water_velocity",
        "range": {"min": 0.0, "max": 2.2},
        "color_palette": "speed",
        "description": "Zonal (u) and meridional (v) surface and subsurface current vectors and kinetic energy.",
        "icon": "Wind",
        "sub_variables": ["u", "v"]
    },
    "chlorophyll": {
        "id": "chlorophyll",
        "label": "Chlorophyll-a Concentration",
        "short_label": "Chlorophyll",
        "unit": "mg/m³",
        "type": "scalar",
        "visualization": "surface",
        "standard_name": "mass_concentration_of_chlorophyll_a_in_sea_water",
        "range": {"min": 0.05, "max": 6.0},
        "color_palette": "algae",
        "description": "Biogeochemical tracer for phytoplankton blooms and ocean productivity.",
        "icon": "Activity"
    },
    "ssh": {
        "id": "ssh",
        "label": "Sea Surface Height Anomaly",
        "short_label": "SSH Anomaly",
        "unit": "m",
        "type": "scalar",
        "visualization": "surface",
        "standard_name": "sea_surface_height_above_sea_level",
        "range": {"min": -0.35, "max": 0.35},
        "color_palette": "balance",
        "description": "Altimeter and model dynamic topography highlighting cyclonic & anticyclonic eddies.",
        "icon": "Waves"
    }
}

def get_variable_metadata(var_id: str) -> Dict[str, Any]:
    return VARIABLE_REGISTRY.get(var_id, {
        "id": var_id,
        "label": var_id.capitalize(),
        "short_label": var_id.capitalize(),
        "unit": "unknown",
        "type": "scalar",
        "visualization": "volume",
        "range": {"min": 0, "max": 100},
        "color_palette": "viridis"
    })

def list_all_variables() -> List[Dict[str, Any]]:
    return list(VARIABLE_REGISTRY.values())
