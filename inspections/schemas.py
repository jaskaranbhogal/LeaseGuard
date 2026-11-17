"""Strict response schema: malformed and contradictory outputs are not accepted."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Finding(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(min_length=3, max_length=1000)
    classification: Literal["normal_wear", "damage"]
    pre_existing_worsened: bool


class InspectionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    photo_quality: Literal["good", "too_dark", "blurry", "wrong_area"]
    same_area: bool
    change_detected: bool
    classification: Literal["none", "normal_wear", "damage"]
    severity: Literal["low", "medium", "high"] | None
    confidence: Literal["low", "medium", "high"]
    obstructed_areas: str | None
    findings: list[Finding] = Field(max_length=20)
    summary: str = Field(min_length=3, max_length=2000)

    @model_validator(mode="after")
    def check_semantics(self):
        if self.photo_quality != "good" or not self.same_area:
            if self.change_detected or self.classification != "none" or self.findings:
                raise ValueError("Unusable or mismatched photos must not assert damage")
        if self.classification == "none" and (self.change_detected or self.findings):
            raise ValueError("No-change classification contradicts findings")
        if self.classification != "none" and (not self.change_detected or not self.findings):
            raise ValueError("A change classification requires a visible finding")
        if (self.classification == "damage") != (self.severity is not None):
            raise ValueError("Severity must be set exactly when classification is damage")
        if self.classification == "damage" and not any(f.classification == "damage" for f in self.findings):
            raise ValueError("Damage classification requires a damage finding")
        if self.classification == "normal_wear" and any(f.classification == "damage" for f in self.findings):
            raise ValueError("Normal wear cannot contain a damage finding")
        return self
