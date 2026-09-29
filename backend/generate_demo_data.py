import os
import json
import numpy as np
import pandas as pd
import xarray as xr
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
os.makedirs(DATA_DIR, exist_ok=True)

def generate_ocean_model_nc():
    print("Generating Indian Ocean numerical model NetCDF dataset...")
    # North Indian Ocean bounds: Lat 4N to 24N, Lon 60E to 94E
    lats = np.arange(4.0, 24.5, 1.0) # 21 points
    lons = np.arange(60.0, 94.5, 1.0) # 35 points
    depths = np.array([0, 10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000], dtype=float) # 14 levels
    
    # 5 temporal steps (daily model snapshots)
    base_time = datetime(2026, 9, 24, 0, 0, 0)
    times = [base_time + timedelta(days=i) for i in range(5)]

    nt = len(times)
    nz = len(depths)
    ny = len(lats)
    nx = len(lons)

    # Coordinates meshgrid for 2D calculations
    lon2d, lat2d = np.meshgrid(lons, lats)

    # 1. Temperature: surface ~27-30.5°C, thermocline between 50-250m, deep ~3.5°C
    # Bay of Bengal (lon > 80) is warmer on surface (~29.5°C)
    # Arabian Sea upwelling near Oman (lat > 16, lon < 65) has cooler SST (~25.5°C)
    temp_4d = np.zeros((nt, nz, ny, nx), dtype=np.float32)
    sal_4d = np.zeros((nt, nz, ny, nx), dtype=np.float32)
    u_4d = np.zeros((nt, nz, ny, nx), dtype=np.float32)
    v_4d = np.zeros((nt, nz, ny, nx), dtype=np.float32)
    chla_4d = np.zeros((nt, nz, ny, nx), dtype=np.float32)

    for t_idx in range(nt):
        t_phase = t_idx * 0.15
        for z_idx, z in enumerate(depths):
            # Vertical exponential / sigmoidal decay for thermocline
            depth_factor = np.exp(-z / 320.0) # 1 at surface, ~0.05 at 1000m
            deep_temp = 3.6 + (1.2 * np.exp(-z / 1200.0))

            # Horizontal surface SST variation
            sst_base = 28.6 + 1.2 * np.sin(np.radians(lon2d - 65.0)) - 0.8 * np.sin(np.radians(lat2d - 10.0))
            # Coastal upwelling cool pool off Western Arabian Sea
            upwelling = 2.8 * np.exp(-((lat2d - 18.0)**2 / 12.0 + (lon2d - 62.0)**2 / 16.0))
            # Marine heatwave hotspot in Bay of Bengal / Andaman Sea (Disaster hazard feature!)
            mhw_hotspot = 2.1 * np.exp(-((lat2d - 12.5)**2 / 8.0 + (lon2d - 88.0)**2 / 10.0))
            
            # Combine surface with depth profile
            temp_layer = deep_temp + (sst_base - upwelling + mhw_hotspot - deep_temp) * depth_factor
            # Small temporal perturbation
            temp_layer += 0.2 * np.sin(t_phase + lat2d*0.1 + lon2d*0.1)
            temp_4d[t_idx, z_idx, :, :] = temp_layer

            # 2. Salinity: High in Arabian Sea (36.2 - 36.8 PSU), low in Bay of Bengal (31.5 - 33.5 PSU)
            # Salinity contrast decreases at deep ocean depths (approaches 34.8 PSU)
            as_high_sal = 36.5 - 0.4 * np.tanh((lon2d - 75.0) / 4.0)
            bob_low_sal = -2.8 * (1.0 / (1.0 + np.exp(-(lon2d - 80.0) / 3.0))) * (1.0 / (1.0 + np.exp(-(lat2d - 10.0) / 4.0)))
            deep_sal = 34.75 + 0.1 * np.sin(lat2d*0.05)
            sal_layer = deep_sal + (as_high_sal + bob_low_sal - deep_sal) * depth_factor
            sal_4d[t_idx, z_idx, :, :] = sal_layer

            # 3. Currents (u, v): Southwest Monsoon Drift (eastward u > 0 south of India)
            # and cyclonic/anticyclonic eddies in Bay of Bengal and Arabian Sea
            u_flow = 0.65 * np.exp(-z / 180.0) * np.sin(np.radians(lat2d * 6.0)) + 0.3 * np.cos(np.radians(lon2d * 5.0) + t_phase)
            v_flow = 0.55 * np.exp(-z / 180.0) * np.cos(np.radians(lon2d * 6.0)) - 0.25 * np.sin(np.radians(lat2d * 5.0) + t_phase)
            
            # Strong cyclonic eddy hazard feature near 14°N, 84°E (Bay of Bengal)
            eddy_radius = np.sqrt((lat2d - 14.0)**2 + (lon2d - 84.0)**2)
            eddy_intensity = 1.2 * np.exp(- (eddy_radius / 2.2)**2) * np.exp(-z / 250.0)
            u_flow += -eddy_intensity * ((lat2d - 14.0) / (eddy_radius + 0.1))
            v_flow += eddy_intensity * ((lon2d - 84.0) / (eddy_radius + 0.1))

            u_4d[t_idx, z_idx, :, :] = u_flow
            v_4d[t_idx, z_idx, :, :] = v_flow

            # 4. Chlorophyll: concentrated in euphotic zone (0-75m), peak in Arabian Sea upwelling
            chla_surf = 0.25 + 2.8 * np.exp(-((lat2d - 17.5)**2 / 14.0 + (lon2d - 63.0)**2 / 16.0))
            chla_layer = chla_surf * np.exp(-z / 65.0) if z <= 150 else 0.02
            chla_4d[t_idx, z_idx, :, :] = chla_layer

    # 2D Sea Surface Height (SSH)
    ssh_3d = np.zeros((nt, ny, nx), dtype=np.float32)
    for t_idx in range(nt):
        # Cyclonic eddy has negative SSH (-0.18m), warm pool has positive SSH (+0.15m)
        ssh = 0.08 * np.sin(np.radians(lon2d*4.0)) - 0.18 * np.exp(-(((lat2d - 14.0)**2 + (lon2d - 84.0)**2) / 4.0))
        ssh_3d[t_idx, :, :] = ssh

    ds = xr.Dataset(
        data_vars={
            "temperature": (["time", "depth", "latitude", "longitude"], temp_4d, {
                "long_name": "Sea Water Potential Temperature",
                "units": "°C",
                "standard_name": "sea_water_potential_temperature"
            }),
            "salinity": (["time", "depth", "latitude", "longitude"], sal_4d, {
                "long_name": "Practical Salinity",
                "units": "PSU",
                "standard_name": "sea_water_practical_salinity"
            }),
            "u": (["time", "depth", "latitude", "longitude"], u_4d, {
                "long_name": "Zonal Ocean Velocity (Eastward)",
                "units": "m/s",
                "standard_name": "eastward_sea_water_velocity"
            }),
            "v": (["time", "depth", "latitude", "longitude"], v_4d, {
                "long_name": "Meridional Ocean Velocity (Northward)",
                "units": "m/s",
                "standard_name": "northward_sea_water_velocity"
            }),
            "chlorophyll": (["time", "depth", "latitude", "longitude"], chla_4d, {
                "long_name": "Chlorophyll-a Concentration",
                "units": "mg/m³",
                "standard_name": "mass_concentration_of_chlorophyll_a_in_sea_water"
            }),
            "ssh": (["time", "latitude", "longitude"], ssh_3d, {
                "long_name": "Sea Surface Height Anomaly",
                "units": "m",
                "standard_name": "sea_surface_height_above_sea_level"
            })
        },
        coords={
            "time": ("time", times),
            "depth": ("depth", depths, {"units": "m", "positive": "down"}),
            "latitude": ("latitude", lats, {"units": "degrees_north"}),
            "longitude": ("longitude", lons, {"units": "degrees_east"})
        },
        attrs={
            "title": "North Indian Ocean Numerical Model Simulation (ROMS 0.25° Prototype)",
            "institution": "OceanX Scientific Ingest Pipeline (SIH 26067)",
            "conventions": "CF-1.8",
            "source_type": "DEMO DATASET",
            "description": "High-fidelity demonstration model dataset for Smart India Hackathon 2026."
        }
    )

    nc_path = os.path.join(DATA_DIR, "model_indian_ocean.nc")
    ds.to_netcdf(nc_path)
    print(f"Saved NetCDF dataset: {nc_path} ({os.path.getsize(nc_path)/1024:.1f} KB)")
    return nc_path

def generate_in_situ_observations():
    print("Generating In-Situ observations (Argo, Gliders, CTD, BGC)...")
    # 12 Argo Floats + 2 Gliders + 2 CTD + 2 BGC floats
    sensors = [
        # Argo Floats (Arabian Sea & Bay of Bengal)
        {"id": "ARGO-2902145", "type": "ARGO", "lat": 16.5, "lon": 64.2, "name": "INCOIS Argo #2902145 (Central Arabian Sea)", "cycle": 142, "battery": "94%"},
        {"id": "ARGO-2902210", "type": "ARGO", "lat": 14.8, "lon": 86.4, "name": "INCOIS Argo #2902210 (Central Bay of Bengal)", "cycle": 88, "battery": "89%"},
        {"id": "ARGO-2902305", "type": "ARGO", "lat": 5.2, "lon": 78.5, "name": "INCOIS Argo #2902305 (Equatorial Indian Ocean)", "cycle": 210, "battery": "72%"},
        {"id": "ARGO-6903212", "type": "ARGO", "lat": 12.4, "lon": 72.1, "name": "Argo #6903212 (Lakshadweep Basin)", "cycle": 65, "battery": "96%"},
        {"id": "ARGO-1901844", "type": "ARGO", "lat": 8.1, "lon": 82.6, "name": "Argo #1901844 (Sri Lanka Dome / South BoB)", "cycle": 115, "battery": "81%"},
        {"id": "ARGO-2903102", "type": "ARGO", "lat": 19.8, "lon": 89.2, "name": "Argo #2903102 (Northern Bay of Bengal)", "cycle": 44, "battery": "98%"},
        {"id": "ARGO-5906440", "type": "ARGO", "lat": 18.2, "lon": 68.8, "name": "Argo #5906440 (Northeast Arabian Sea)", "cycle": 156, "battery": "68%"},
        {"id": "ARGO-2902891", "type": "ARGO", "lat": 10.5, "lon": 62.5, "name": "Argo #2902891 (West Lakshadweep Sea)", "cycle": 98, "battery": "85%"},
        {"id": "ARGO-2903420", "type": "ARGO", "lat": 11.8, "lon": 92.4, "name": "Argo #2903420 (Andaman Sea Transect)", "cycle": 52, "battery": "92%"},
        {"id": "ARGO-2903551", "type": "ARGO", "lat": 7.6, "lon": 69.8, "name": "Argo #2903551 (Chagos-Laccadive Ridge)", "cycle": 178, "battery": "75%"},
        {"id": "ARGO-2903612", "type": "ARGO", "lat": 13.5, "lon": 81.9, "name": "Argo #2903612 (Coromandel Coast)", "cycle": 34, "battery": "97%"},
        {"id": "ARGO-2903780", "type": "ARGO", "lat": 21.0, "lon": 66.5, "name": "Argo #2903780 (Gulf of Kachchh Approaches)", "cycle": 72, "battery": "91%"},
        # Underwater Gliders
        {"id": "GLIDER-IN04", "type": "GLIDER", "lat": 13.8, "lon": 84.1, "name": "Deep Ocean Mission Glider GL-IN-04", "mission": "BoB Freshwater Eddy Survey", "status": "Diving 0-1000m"},
        {"id": "GLIDER-AS02", "type": "GLIDER", "lat": 15.2, "lon": 66.8, "name": "Arabian Sea Glider GL-AS-02", "mission": "Oxygen Minimum Zone (OMZ) Monitoring", "status": "Diving 0-1000m"},
        # Cruise CTD Stations (ORV Sagar Kanya)
        {"id": "CTD-SK380-01", "type": "CTD", "lat": 11.0, "lon": 87.0, "name": "ORV Sagar Kanya SK-380 Stn 01", "cruise": "INCOIS BoB Process Study", "depth_max": 2000},
        {"id": "CTD-SK380-08", "type": "CTD", "lat": 15.0, "lon": 88.5, "name": "ORV Sagar Kanya SK-380 Stn 08", "cruise": "INCOIS BoB Process Study", "depth_max": 2000},
        # Biogeochemical (BGC) Argo Floats
        {"id": "BGC-2902998", "type": "BGC", "lat": 17.2, "lon": 65.5, "name": "BGC-Argo #2902998 (OMZ Bio-profiler)", "parameters": ["Temp", "Sal", "Oxygen", "Chl-a"]},
        {"id": "BGC-2903119", "type": "BGC", "lat": 13.1, "lon": 87.8, "name": "BGC-Argo #2903119 (Phytoplankton Bloom Tracker)", "parameters": ["Temp", "Sal", "Oxygen", "Chl-a"]}
    ]

    depth_levels = [0, 10, 25, 50, 75, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000]
    
    profiles = []
    csv_rows = []

    for s in sensors:
        lat = s["lat"]
        lon = s["lon"]
        max_d = 1000 if s["type"] == "GLIDER" else 2000

        # Base physical profiles with slight observational noise and realistic model-diff
        # Bay of Bengal is fresher & warmer on top
        surf_temp = 29.8 if lon > 78 else 28.2
        if lat > 16 and lon < 66: # Arabian Sea upwelling
            surf_temp = 25.8
        if "MHW" in s.get("name", "") or (lat > 11 and lat < 14 and lon > 85 and lon < 90):
            surf_temp += 1.4 # Warm anomaly

        surf_sal = 32.2 if lon > 78 else 36.4

        measurements = []
        for d in depth_levels:
            if d > max_d:
                continue
            
            # Physics-based thermocline
            decay = np.exp(-d / 310.0)
            t_val = 3.6 + (surf_temp - 3.6) * decay
            
            # Salinity halocline
            sal_deep = 34.8
            s_val = sal_deep + (surf_sal - sal_deep) * decay

            # Add slight sensor calibration / environmental micro-variance
            t_obs = round(float(t_val + np.random.normal(0, 0.08)), 2)
            s_obs = round(float(s_val + np.random.normal(0, 0.05)), 2)
            
            # Chlorophyll
            chla_obs = round(max(0.02, float((1.8 if lon < 70 and lat > 15 else 0.4) * np.exp(-d / 60.0) + np.random.normal(0, 0.02))), 2)
            # Dissolved Oxygen (ml/L)
            omz_dip = 0.8 if (lon < 75 and 150 <= d <= 800) else 2.5
            o2_obs = round(float(omz_dip + 2.0 * np.exp(-abs(d - 50)/150.0)), 2)

            qc_flag = 1
            # Randomly assign a flag 2 (probably good) or flag 3 on very deep edge
            if d == 2000 and s["id"] == "ARGO-2903551":
                qc_flag = 2

            m_dict = {
                "depth": d,
                "temperature": t_obs,
                "salinity": s_obs,
                "chlorophyll": chla_obs,
                "oxygen": o2_obs,
                "qc": qc_flag
            }
            measurements.append(m_dict)

            # Flat CSV row
            csv_rows.append({
                "float_id": s["id"],
                "source": s["type"],
                "name": s["name"],
                "latitude": lat,
                "longitude": lon,
                "depth": d,
                "timestamp": "2026-09-28T06:00:00Z",
                "temperature": t_obs,
                "salinity": s_obs,
                "chlorophyll": chla_obs,
                "oxygen": o2_obs,
                "qc": qc_flag
            })

        profile_obj = {
            "id": s["id"],
            "name": s["name"],
            "type": s["type"],
            "latitude": lat,
            "longitude": lon,
            "timestamp": "2026-09-28T06:00:00Z",
            "quality": "WMO Verified (QC Level 1)",
            "source": f"INCOIS / Indian Ocean {s['type']} Array",
            "depth_range": [0, max_d],
            "surface_temp": measurements[0]["temperature"],
            "surface_salinity": measurements[0]["salinity"],
            "attributes": s,
            "measurements": measurements
        }
        profiles.append(profile_obj)

    # Save JSON
    json_path = os.path.join(DATA_DIR, "in_situ_observations.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(profiles, f, indent=2)
    print(f"Saved Observations JSON: {json_path} ({len(profiles)} sensors)")

    # Save CSV
    df = pd.DataFrame(csv_rows)
    csv_path = os.path.join(DATA_DIR, "in_situ_observations.csv")
    df.to_csv(csv_path, index=False)
    print(f"Saved Observations CSV: {csv_path} ({len(df)} rows)")

if __name__ == "__main__":
    generate_ocean_model_nc()
    generate_in_situ_observations()
    print("Demo dataset generation complete!")
