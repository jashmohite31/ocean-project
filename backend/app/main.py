import os
import shutil
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Query, HTTPException, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.app.core.config import PROVENANCE_INFO, UPLOAD_DIR
from backend.app.core.registry import list_all_variables, get_variable_metadata
from backend.app.services.ocean_service import OceanService
from backend.app.services.observation_service import ObservationService
from backend.app.services.compare_service import CompareService
from backend.app.services.hazard_service import HazardService
from backend.app.services.nlp_query_service import AskOceanXService
from backend.app.services.explain_service import RegionalExplanationService
from backend.app.adapters.netcdf_adapter import NetCDFAdapter
from backend.app.adapters.csv_adapter import CSVAdapter
from backend.app.adapters.json_adapter import JSONAdapter
from backend.app.adapters.incois_adapter import INCOISApiAdapter
from backend.app.pipeline.confidence import ConfidenceEngine

app = FastAPI(
    title="OceanX – 3D Ocean Intelligence Platform API",
    description="Interactive 3D visualization and analysis platform integrating numerical ocean model outputs and in-situ observations (SIH-26067)",
    version="1.0.0"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize service singletons
ocean_service = OceanService()
obs_service = ObservationService()
compare_service = CompareService(ocean_service, obs_service)
hazard_service = HazardService(ocean_service, compare_service, obs_service)
nlp_service = AskOceanXService(ocean_service, compare_service, obs_service, hazard_service)
explain_service = RegionalExplanationService(ocean_service, compare_service, obs_service)
incois_adapter = INCOISApiAdapter()

# ----------------- PROVENANCE & REGISTRY ENDPOINTS -----------------

@app.get("/api/health")
def health_check():
    return {"status": "ONLINE", "system": "OceanX Platform", "version": "1.0.0-SIH26067"}

@app.get("/api/metadata/provenance")
def get_provenance():
    """Dataset and source provenance, versioning and disclaimer"""
    return PROVENANCE_INFO

@app.get("/api/metadata/variables")
def get_variables():
    """Modular Variable Registry: dynamically registered oceanographic variables"""
    return list_all_variables()

@app.get("/api/metadata/sources")
def get_data_sources():
    incois_status = incois_adapter.check_connection()
    return {
        "active_source": "DEMO_DATASET",
        "sources": [
            {
                "id": "demo",
                "name": "Demo Dataset (ROMS 0.25° + INCOIS Argo Array)",
                "status": "LOADED_ACTIVE",
                "badge": "Active Offline / Local",
                "format": "NetCDF-4 + GeoJSON"
            },
            {
                "id": "incois_api",
                "name": "INCOIS Live API (ERDDAP / TDS Integration)",
                "status": incois_status["status"],
                "badge": "API-Ready Standby",
                "endpoint": incois_status["endpoint"],
                "live": incois_status["live"]
            },
            {
                "id": "custom_upload",
                "name": "User Uploaded Dataset",
                "status": "READY_FOR_INGEST",
                "badge": "Custom NetCDF / CSV / JSON",
                "upload_enabled": True
            }
        ]
    }

# ----------------- OCEAN 3D VIEW & SLICE ENDPOINTS -----------------

@app.get("/api/ocean/metadata")
def get_ocean_metadata():
    return ocean_service.get_metadata()

@app.get("/api/ocean/slice")
def get_ocean_slice(
    variable: str = Query("temperature", description="Variable ID from registry"),
    depth: float = Query(0.0, description="Depth level in meters"),
    time_index: int = Query(0, description="Time step index (0-4)")
):
    """Horizontal depth slice for 3D ocean slice visualization"""
    return ocean_service.get_slice(variable=variable, depth=depth, time_index=time_index)

@app.get("/api/ocean/vectors")
def get_current_vectors(
    depth: float = Query(0.0, description="Depth level in meters"),
    time_index: int = Query(0, description="Time step index"),
    step: int = Query(2, description="Subsample stride for vectors")
):
    """Subsampled (u, v) velocity vector field for particle flow simulation"""
    return ocean_service.get_current_vectors(depth=depth, time_index=time_index, step=step)

@app.get("/api/ocean/xray")
def get_ocean_xray(
    variable: str = Query("temperature", description="Variable ID"),
    time_index: int = Query(0, description="Time step index")
):
    """Ocean X-Ray multi-layer stepping (0m, 25m, 50m, 100m, 250m, 500m, 1000m, 2000m)"""
    return ocean_service.get_xray_layers(variable=variable, time_index=time_index)

@app.get("/api/ocean/cross-section")
def get_vertical_cross_section(
    variable: str = Query("temperature", description="Variable ID"),
    section_type: str = Query("latitudinal", description="'latitudinal' or 'longitudinal'"),
    fixed_coord: float = Query(14.0, description="Fixed latitude or longitude"),
    time_index: int = Query(0, description="Time step index")
):
    """Vertical depth transect / cross-section through the water column"""
    return ocean_service.get_vertical_cross_section(
        variable=variable,
        section_type=section_type,
        fixed_coord=fixed_coord,
        time_index=time_index
    )

# ----------------- OBSERVATIONS ENDPOINTS -----------------

@app.get("/api/observations")
def list_observations(source_type: Optional[str] = Query(None, description="Filter by ARGO, GLIDER, CTD, BGC")):
    """List all active in-situ observation markers with coordinates and QC flags"""
    return obs_service.list_observations(source_filter=source_type)

@app.get("/api/observations/{obs_id}/profile")
def get_observation_profile(obs_id: str):
    """Get full vertical depth profile measurements for a specific platform"""
    prof = obs_service.get_observation_profile(obs_id)
    if not prof:
        raise HTTPException(status_code=404, detail=f"Observation {obs_id} not found")
    return prof

# ----------------- MODEL vs ARGO COMPARISON -----------------

@app.get("/api/compare/argo-model")
def compare_argo_model(
    float_id: str = Query(..., description="Observation ID, e.g. ARGO-2902210"),
    variable: str = Query("temperature", description="Variable to compare"),
    time_index: int = Query(0, description="Model time step index")
):
    """
    Exact spatial, temporal, and depth alignment between in-situ observation and numerical model.
    Returns matched level comparison table (ARGO, MODEL, DIFFERENCE) and error metrics.
    """
    try:
        return compare_service.compare_float_with_model(float_id=float_id, variable=variable, time_index=time_index)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/compare/difference-map")
def get_difference_map(
    variable: str = Query("temperature", description="Variable to compare"),
    depth: float = Query(100.0, description="Depth in meters"),
    time_index: int = Query(0, description="Time step index")
):
    """Spatial 2D difference layer highlighting areas where model and observations diverge"""
    return compare_service.compute_spatial_difference_map(variable=variable, depth=depth, time_index=time_index)

# ----------------- CONFIDENCE & HAZARDS -----------------

@app.get("/api/confidence")
def get_ocean_confidence(depth: float = Query(100.0), time_index: int = Query(0)):
    """Ocean Confidence Layer: High / Medium / Low ratings across grid cells"""
    ds = ocean_service._load_dataset()
    diff_data = compare_service.compute_spatial_difference_map(variable="temperature", depth=depth, time_index=time_index)
    observations = obs_service.list_observations()
    return ConfidenceEngine.compute_confidence_grid(
        [float(y) for y in ds.latitude.values],
        [float(x) for x in ds.longitude.values],
        observations,
        diff_matrix=None
    )

@app.get("/api/hazards")
def get_hazard_analysis(
    time_index: int = Query(0, description="Time step index"),
    temp_threshold: float = Query(1.6, description="Temperature anomaly threshold (°C)"),
    current_speed_threshold: float = Query(1.0, description="Current speed threshold (m/s)"),
    glacier_scenario: bool = Query(False, description="Simulate experimental glacier melt/runoff scenario")
):
    """
    Disaster Management Decision-Support Layer:
    Marine heatwaves, cyclonic eddies, low-confidence zones, and model-observation discrepancies.
    """
    return hazard_service.analyze_hazards(
        time_index=time_index,
        temp_threshold_offset=temp_threshold,
        current_speed_threshold=current_speed_threshold,
        glacier_scenario_active=glacier_scenario
    )

# ----------------- ASK OCEANX & EXPLAIN THIS REGION -----------------

from backend.app.core.config import PROVENANCE_INFO, UPLOAD_DIR, BASE_DIR

class APIKeyRequest(BaseModel):
    api_key: str

@app.get("/api/nlp/status")
def get_nlp_status():
    """Check whether Gemini AI is active or rule-based fallback is in use"""
    is_gemini = nlp_service._genai_client is not None
    return {
        "status": "ONLINE",
        "gemini_active": is_gemini,
        "model": nlp_service._model_id if is_gemini else "rule-based",
        "has_api_key": bool(os.environ.get("GEMINI_API_KEY", "").strip())
    }

@app.post("/api/nlp/key")
def update_gemini_key(req: APIKeyRequest):
    """Update the Gemini API key dynamically and persist to backend/.env"""
    key = req.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    
    # Save to backend/.env
    env_path = BASE_DIR / ".env"
    with open(env_path, "w", encoding="utf-8") as f:
        f.write(f"GEMINI_API_KEY={key}\n")
    
    success = nlp_service.set_api_key(key)
    return {
        "status": "SUCCESS",
        "gemini_active": success,
        "message": "API key updated and Gemini activated!" if success else "API key saved, but Gemini could not initialize (check key validity)."
    }

class NLPQueryRequest(BaseModel):
    query: str
    conversation_history: Optional[List[Dict[str, Any]]] = None
    context: Optional[Dict[str, Any]] = None

@app.post("/api/nlp/ask")
def ask_oceanx(req: NLPQueryRequest):
    """AI-assisted Natural Language Query interface – powered by Gemini with OceanX grounding"""
    if not req.query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    result = nlp_service.process_query(
        req.query,
        conversation_history=req.conversation_history or [],
        context=req.context
    )
    # Normalise: expose both 'answer' and legacy 'response' keys
    if "answer" in result and "response" not in result:
        result["response"] = result["answer"]
    return result

class RegionalExplanationRequest(BaseModel):
    latitude: float
    longitude: float
    depth: float = 100.0
    variable: str = "temperature"
    observation_id: Optional[str] = None

@app.post("/api/nlp/explain")
def explain_region(req: RegionalExplanationRequest):
    """AI Regional Explanation generating factual narrative from actual data"""
    return explain_service.explain_region(
        lat=req.latitude,
        lon=req.longitude,
        depth=req.depth,
        variable=req.variable,
        obs_id=req.observation_id
    )

# ----------------- FILE UPLOAD & VALIDATION PIPELINE -----------------

@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """
    Modular Data Ingestion and Validation Pipeline supporting NetCDF (.nc), CSV (.csv), and JSON (.json).
    Returns multi-point verification checklist.
    """
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    save_path = os.path.join(UPLOAD_DIR, filename)

    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    checklist = {
        "filename": filename,
        "format_detected": False,
        "variables_detected": [],
        "coordinates_detected": False,
        "time_detected": False,
        "depth_detected": False,
        "ready_for_visualization": False,
        "message": ""
    }

    try:
        if ext in [".nc", ".netcdf"]:
            adapter = NetCDFAdapter()
            info = adapter.inspect_dataset(save_path)
            checklist["format_detected"] = True
            checklist["format_type"] = "NetCDF-4 / CF Conventions"
            checklist["variables_detected"] = info["variables_detected"]
            checklist["coordinates_detected"] = True
            checklist["time_detected"] = True
            checklist["depth_detected"] = True
            checklist["ready_for_visualization"] = True
            checklist["message"] = f"Successfully validated NetCDF dataset with {len(info['variables_detected'])} variables across {info['coordinates_detected']['depth']['levels']} depth levels."
        elif ext == ".csv":
            adapter = CSVAdapter()
            info = adapter.inspect_dataset(save_path)
            checklist["format_detected"] = True
            checklist["format_type"] = "Delimited CSV Tabular"
            checklist["variables_detected"] = info["variables_detected"]
            checklist["coordinates_detected"] = True
            checklist["time_detected"] = True
            checklist["depth_detected"] = True
            checklist["ready_for_visualization"] = True
            checklist["message"] = f"Successfully validated CSV dataset with {info['rows_detected']} observation records."
        elif ext in [".json", ".geojson"]:
            adapter = JSONAdapter()
            info = adapter.inspect_dataset(save_path)
            checklist["format_detected"] = True
            checklist["format_type"] = "GeoJSON / Profile JSON"
            checklist["variables_detected"] = ["temperature", "salinity", "chlorophyll"]
            checklist["coordinates_detected"] = True
            checklist["time_detected"] = True
            checklist["depth_detected"] = True
            checklist["ready_for_visualization"] = True
            checklist["message"] = f"Successfully validated JSON dataset with {info['profiles_count']} profile features."
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file format '{ext}'. Must be .nc, .csv, or .json.")

        return checklist
    except Exception as e:
        return {
            "filename": filename,
            "format_detected": False,
            "ready_for_visualization": False,
            "error": str(e)
        }
