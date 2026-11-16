from typing import Literal, Optional

from pydantic import BaseModel


class Finding(BaseModel):
    description: str
    classification: Literal["normal_wear", "damage"]
    pre_existing_worsened: bool


class InspectionResult(BaseModel):
    photo_quality: Literal["good", "too_dark", "blurry", "wrong_area"]
    same_area: bool
    change_detected: bool
    classification: Literal["none", "normal_wear", "damage"]
    severity: Optional[Literal["low", "medium", "high"]]
    confidence: Literal["low", "medium", "high"]
    obstructed_areas: Optional[str]
    findings: list[Finding]
    summary: str
