from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class OceanDataPoint(BaseModel):
    """
    Standardized ocean data point meeting SIH-26067 requirements:
    latitude, longitude, depth, timestamp, variable, value, unit, source, quality flag
    """
    latitude: float = Field(..., description="Latitude in decimal degrees (-90 to 90)")
    longitude: float = Field(..., description="Longitude in decimal degrees (-180 to 180)")
    depth: float = Field(..., description="Depth below sea level in meters (>= 0)")
    timestamp: str = Field(..., description="ISO 8601 formatted timestamp")
    variable: str = Field(..., description="Variable identifier (e.g. temperature, salinity)")
    value: float = Field(..., description="Measured or modeled numeric value")
    unit: str = Field(..., description="Scientific unit (e.g. °C, PSU, m/s)")
    source: str = Field(..., description="Data origin (e.g. ARGO_FLOAT, NUMERICAL_MODEL, GLIDER, CTD, BGC)")
    quality_flag: int = Field(default=1, description="QC flag: 1=Good, 2=Probably Good, 3=Suspect, 4=Bad")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Auxiliary attributes")

class BaseDataAdapter(ABC):
    """
    Abstract Base Adapter for OceanX ingest pipeline.
    Enables plug-and-play addition of new ocean data sources and formats.
    """
    def __init__(self, source_name: str):
        self.source_name = source_name

    @abstractmethod
    def read(self, source_path_or_payload: Any, **kwargs) -> List[OceanDataPoint]:
        """Read raw input and return normalized OceanDataPoints"""
        pass

    @abstractmethod
    def validate_format(self, source_path_or_payload: Any) -> bool:
        """Verify format integrity before processing"""
        pass
