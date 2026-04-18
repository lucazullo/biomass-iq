"""
Basis normalization engine for biomass characterization data.

Supports conversions between:
- ar (as received) → dry → daf (dry ash-free)
- And reverse where valid

Conversion rules:
- AR → dry: value_dry = value_ar * 100 / (100 - moisture_ar)
- AR → DAF: value_daf = value_ar * 100 / (100 - moisture_ar - ash_ar)
- dry → DAF: value_daf = value_dry * 100 / (100 - ash_dry)
- dry → AR: value_ar = value_dry * (100 - moisture_ar) / 100
- DAF → dry: value_dry = value_daf * (100 - ash_dry) / 100

Critical rule: if the required supporting values (moisture, ash) are not
available, the conversion MUST be refused rather than fabricated.
"""

from dataclasses import dataclass


@dataclass
class ConversionResult:
    """Result of a basis conversion attempt."""
    success: bool
    value: float | None = None
    target_basis: str | None = None
    note: str | None = None
    error: str | None = None


def convert_to_dry(
    value: float,
    original_basis: str,
    moisture_ar: float | None = None,
    ash_dry: float | None = None,
) -> ConversionResult:
    """Convert a measurement value to dry basis."""
    if original_basis == "dry":
        return ConversionResult(success=True, value=value, target_basis="dry", note="Already on dry basis")

    if original_basis == "ar":
        if moisture_ar is None:
            return ConversionResult(success=False, error="Cannot convert AR→dry: moisture (AR) not available")
        if moisture_ar >= 100:
            return ConversionResult(success=False, error=f"Invalid moisture value: {moisture_ar}%")
        converted = value * 100.0 / (100.0 - moisture_ar)
        return ConversionResult(
            success=True, value=round(converted, 4), target_basis="dry",
            note=f"Converted from AR using moisture_ar={moisture_ar}%",
        )

    if original_basis == "daf":
        if ash_dry is None:
            return ConversionResult(success=False, error="Cannot convert DAF→dry: ash (dry) not available")
        if ash_dry >= 100:
            return ConversionResult(success=False, error=f"Invalid ash value: {ash_dry}%")
        converted = value * (100.0 - ash_dry) / 100.0
        return ConversionResult(
            success=True, value=round(converted, 4), target_basis="dry",
            note=f"Converted from DAF using ash_dry={ash_dry}%",
        )

    return ConversionResult(success=False, error=f"Unknown basis: {original_basis}")


def convert_to_daf(
    value: float,
    original_basis: str,
    moisture_ar: float | None = None,
    ash_ar: float | None = None,
    ash_dry: float | None = None,
) -> ConversionResult:
    """Convert a measurement value to dry ash-free basis."""
    if original_basis == "daf":
        return ConversionResult(success=True, value=value, target_basis="daf", note="Already on DAF basis")

    if original_basis == "ar":
        if moisture_ar is None or ash_ar is None:
            return ConversionResult(
                success=False,
                error="Cannot convert AR→DAF: need both moisture (AR) and ash (AR)",
            )
        denominator = 100.0 - moisture_ar - ash_ar
        if denominator <= 0:
            return ConversionResult(success=False, error=f"Invalid: moisture_ar + ash_ar >= 100%")
        converted = value * 100.0 / denominator
        return ConversionResult(
            success=True, value=round(converted, 4), target_basis="daf",
            note=f"Converted from AR using moisture_ar={moisture_ar}%, ash_ar={ash_ar}%",
        )

    if original_basis == "dry":
        if ash_dry is None:
            return ConversionResult(success=False, error="Cannot convert dry→DAF: ash (dry) not available")
        if ash_dry >= 100:
            return ConversionResult(success=False, error=f"Invalid ash value: {ash_dry}%")
        converted = value * 100.0 / (100.0 - ash_dry)
        return ConversionResult(
            success=True, value=round(converted, 4), target_basis="daf",
            note=f"Converted from dry using ash_dry={ash_dry}%",
        )

    return ConversionResult(success=False, error=f"Unknown basis: {original_basis}")


def convert_to_ar(
    value: float,
    original_basis: str,
    moisture_ar: float | None = None,
    ash_dry: float | None = None,
    ash_ar: float | None = None,
) -> ConversionResult:
    """Convert a measurement value to as-received basis."""
    if original_basis == "ar":
        return ConversionResult(success=True, value=value, target_basis="ar", note="Already on AR basis")

    if original_basis == "dry":
        if moisture_ar is None:
            return ConversionResult(success=False, error="Cannot convert dry→AR: moisture (AR) not available")
        converted = value * (100.0 - moisture_ar) / 100.0
        return ConversionResult(
            success=True, value=round(converted, 4), target_basis="ar",
            note=f"Converted from dry using moisture_ar={moisture_ar}%",
        )

    if original_basis == "daf":
        if moisture_ar is None or ash_ar is None:
            return ConversionResult(
                success=False,
                error="Cannot convert DAF→AR: need both moisture (AR) and ash (AR)",
            )
        denominator = 100.0
        converted = value * (100.0 - moisture_ar - ash_ar) / denominator
        return ConversionResult(
            success=True, value=round(converted, 4), target_basis="ar",
            note=f"Converted from DAF using moisture_ar={moisture_ar}%, ash_ar={ash_ar}%",
        )

    return ConversionResult(success=False, error=f"Unknown basis: {original_basis}")


# Registry of which properties can be basis-converted
CONVERTIBLE_PROPERTIES = {
    # Proximate analysis
    "moisture", "ash", "volatile_matter", "fixed_carbon",
    # Ultimate analysis
    "C", "H", "N", "S", "O", "Cl",
    # Heating values
    "HHV", "LHV",
}

# Properties that are basis-independent (no conversion needed)
BASIS_INDEPENDENT_PROPERTIES = {
    "bulk_density", "particle_size", "ash_fusion_temperature",
}
