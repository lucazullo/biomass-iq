import csv
import io

from app.schemas import SampleRecordOut


def observations_to_csv(records: list[SampleRecordOut]) -> str:
    """Convert observation records to CSV format with full provenance."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "source_dataset", "source_record_id", "original_name",
        "geography", "year", "process_state", "is_grouped_average",
        "property_code", "property_name", "category",
        "value", "unit", "basis",
        "normalized_value", "normalized_basis",
        "derivation", "conversion_note", "quality_flag",
        "remarks", "citation",
    ])

    for record in records:
        for m in record.measurements:
            writer.writerow([
                record.source_dataset,
                record.source_record_id,
                record.original_name,
                record.geography or "",
                record.year or "",
                record.process_state or "",
                record.is_grouped_average,
                m.property_code,
                m.property_name,
                m.category,
                m.original_value,
                m.original_unit,
                m.original_basis,
                m.normalized_value or "",
                m.normalized_basis or "",
                m.derivation,
                m.conversion_note or "",
                m.quality_flag or "",
                record.remarks or "",
                record.citation or "",
            ])

    return output.getvalue()
