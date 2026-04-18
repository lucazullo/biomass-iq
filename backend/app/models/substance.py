import uuid

from sqlalchemy import String, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CanonicalSubstance(Base):
    __tablename__ = "canonical_substance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    preferred_name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    scientific_name: Mapped[str | None] = mapped_column(String(500))
    type: Mapped[str] = mapped_column(String(50), nullable=False)  # agricultural_residue, woody, processed, ash, other
    taxonomy_path: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    aliases: Mapped[list["Alias"]] = relationship(back_populates="substance", cascade="all, delete-orphan")
    relations_from: Mapped[list["SubstanceRelation"]] = relationship(
        foreign_keys="SubstanceRelation.from_id", back_populates="from_substance"
    )
    relations_to: Mapped[list["SubstanceRelation"]] = relationship(
        foreign_keys="SubstanceRelation.to_id", back_populates="to_substance"
    )
    sample_records: Mapped[list["SampleRecord"]] = relationship(back_populates="substance")


class Alias(Base):
    __tablename__ = "alias"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    substance_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_substance.id"), nullable=False)
    label: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    alias_type: Mapped[str] = mapped_column(String(50), nullable=False)  # common, scientific, source_label, regional
    source: Mapped[str | None] = mapped_column(String(100))  # e.g. "phylis"
    language: Mapped[str | None] = mapped_column(String(10))

    substance: Mapped["CanonicalSubstance"] = relationship(back_populates="aliases")


class SubstanceRelation(Base):
    __tablename__ = "substance_relation"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_substance.id"), nullable=False)
    to_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("canonical_substance.id"), nullable=False)
    relation_type: Mapped[str] = mapped_column(String(50), nullable=False)  # broader, narrower, processed_from, derived_from, related

    from_substance: Mapped["CanonicalSubstance"] = relationship(foreign_keys=[from_id], back_populates="relations_from")
    to_substance: Mapped["CanonicalSubstance"] = relationship(foreign_keys=[to_id], back_populates="relations_to")
