"""
Data Validation and Quality Control Pipeline.
Executes multi-stage validation:
Format Check -> Missing/Invalid Value Check -> Range Check -> Timestamp Check -> Source Verification -> Quality Flag Assignment.
"""

from typing import List, Dict, Any, Tuple
from datetime import datetime
from backend.app.adapters.base import OceanDataPoint
from backend.app.core.config import QC_THRESHOLDS

class ValidationResult:
    def __init__(self):
        self.total_checked = 0
        self.passed_count = 0
        self.flagged_count = 0
        self.rejected_count = 0
        self.errors = []
        self.warnings = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_checked": self.total_checked,
            "passed_count": self.passed_count,
            "flagged_count": self.flagged_count,
            "rejected_count": self.rejected_count,
            "qc_pass_rate": round((self.passed_count / max(1, self.total_checked)) * 100, 1),
            "errors": self.errors[:10],
            "warnings": self.warnings[:10]
        }

class DataValidator:
    """
    Validates OceanDataPoints against WMO / IOC / Argo Ocean Data Quality standards.
    """
    @staticmethod
    def validate_point(point: OceanDataPoint) -> Tuple[bool, int, str]:
        """
        Returns (is_valid, quality_flag, note).
        Quality Flags:
          1 = Good
          2 = Probably Good / Slight Outlier
          3 = Suspect / Flagged
          4 = Bad / Rejected
        """
        # 1. Coordinate check
        if not (-90.0 <= point.latitude <= 90.0):
            return False, 4, f"Latitude out of bounds: {point.latitude}"
        if not (-180.0 <= point.longitude <= 180.0):
            return False, 4, f"Longitude out of bounds: {point.longitude}"

        # 2. Depth check
        depth_qc = QC_THRESHOLDS["depth"]
        if point.depth < depth_qc["min"] or point.depth > depth_qc["max"]:
            return False, 4, f"Depth out of bounds: {point.depth}m"

        # 3. Missing/NaN Value Check
        if point.value is None or point.value != point.value: # NaN check
            return False, 4, "Missing or NaN value"

        # 4. Range Check
        var_key = point.variable.lower()
        if var_key in QC_THRESHOLDS:
            threshold = QC_THRESHOLDS[var_key]
            if point.value < threshold["min"] or point.value > threshold["max"]:
                return True, 3, f"Value {point.value} exceeds physiological bounds [{threshold['min']}, {threshold['max']}]"

        # 5. Timestamp Check
        try:
            # Handle ISO string with or without Z
            ts = point.timestamp.replace("Z", "+00:00")
            parsed_time = datetime.fromisoformat(ts)
        except Exception:
            return False, 4, f"Invalid ISO 8601 timestamp: {point.timestamp}"

        # 6. Source Verification
        valid_sources = ["ARGO", "ARGO_FLOAT", "NUMERICAL_MODEL", "GLIDER", "CTD", "BGC", "INCOIS_API", "IN_SITU_OBSERVATION"]
        if not any(s in point.source.upper() for s in valid_sources):
            return True, 2, f"Unverified source identity: {point.source}"

        return True, 1, "Passed all QC gates"

    @classmethod
    def process_pipeline(cls, points: List[OceanDataPoint]) -> Tuple[List[OceanDataPoint], ValidationResult]:
        result = ValidationResult()
        validated_points: List[OceanDataPoint] = []

        for p in points:
            result.total_checked += 1
            is_valid, qc_flag, note = cls.validate_point(p)
            p.quality_flag = qc_flag

            if not is_valid:
                result.rejected_count += 1
                result.errors.append(note)
            else:
                if qc_flag == 1:
                    result.passed_count += 1
                else:
                    result.flagged_count += 1
                    result.warnings.append(note)
                validated_points.append(p)

        return validated_points, result
