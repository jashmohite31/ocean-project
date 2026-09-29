import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "data" / "uploads"

# Load environment variables from .env
from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env", override=True)
load_dotenv(BASE_DIR.parent / ".env", override=True)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Quality control thresholds
QC_THRESHOLDS = {
    "temperature": {"min": -2.0, "max": 36.0, "unit": "°C"},
    "salinity": {"min": 20.0, "max": 42.0, "unit": "PSU"},
    "current_speed": {"min": 0.0, "max": 4.5, "unit": "m/s"},
    "depth": {"min": 0.0, "max": 6000.0, "unit": "m"},
    "chlorophyll": {"min": 0.0, "max": 50.0, "unit": "mg/m³"}
}

# Anomaly detection standard deviation thresholds
ANOMALY_Z_SCORE_THRESHOLD = 2.2
MHW_TEMP_THRESHOLD_OFFSET = 1.8  # Marine Heatwave threshold: >1.8°C above climatological mean

# Data Provenance Metadata
PROVENANCE_INFO = {
    "platform": "OceanX – 3D Ocean Intelligence Platform",
    "dataset_type": "DEMO DATASET",
    "region": "North Indian Ocean (Arabian Sea, Bay of Bengal, Equatorial)",
    "numerical_model_basis": "ROMS / MOM6 Indian Ocean Configuration (0.25° grid)",
    "in_situ_sources": ["INCOIS Indian Ocean Argo Network", "Deep Ocean Mission Glider", "ORV Sagar Kanya CTD", "BGC-Argo"],
    "version": "1.0.0-SIH26067",
    "last_updated": "2026-09-28T12:00:00Z",
    "disclaimer": "Decision-support visualization for Smart India Hackathon. Not a certified operational warning system."
}
