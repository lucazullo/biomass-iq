"""One-time (re-entrant) deduplication of canonical substances whose
`preferred_name` differs only in case or surrounding whitespace.

Runs after every ingest so mixed-source data doesn't leak out through
two nearly-identical canonical rows. Keeps the row with the largest
sample count as the winner; redirects all sample records, aliases, and
relations from the losers onto the winner; deletes the losers.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import (
    Alias,
    CanonicalSubstance,
    SampleRecord,
    SubstanceRelation,
)


def _norm(name: str) -> str:
    return " ".join((name or "").strip().split()).lower()


def dedupe_case_collisions(db: Session) -> dict:
    """Merge canonical substances whose names normalize to the same key.

    Winner rule:
      1. Highest sample count wins.
      2. Tie-break: the variant whose original name equals its normalized
         (lowercase) form — so "wheat straw" beats "Wheat straw".
      3. Final tie-break: lowest UUID for determinism.
    """
    # Build groups by normalized name in Python so we can apply the
    # tie-break rules without needing a SQL function.
    all_subs = db.query(CanonicalSubstance).all()
    groups: dict[str, list[CanonicalSubstance]] = {}
    for s in all_subs:
        groups.setdefault(_norm(s.preferred_name), []).append(s)

    # Pre-index sample counts so we don't issue N extra queries.
    count_rows = dict(
        db.query(SampleRecord.substance_id, func.count(SampleRecord.id))
        .group_by(SampleRecord.substance_id)
        .all()
    )

    merged_groups = 0
    merged_samples = 0
    merged_aliases = 0
    merged_relations = 0
    removed_substances = 0

    for key, variants in groups.items():
        if len(variants) < 2:
            continue

        def score(sub: CanonicalSubstance) -> tuple[int, int, str]:
            n = int(count_rows.get(sub.id, 0) or 0)
            lower_preferred = 1 if sub.preferred_name == _norm(sub.preferred_name) else 0
            return (n, lower_preferred, str(sub.id))

        variants.sort(key=score, reverse=True)
        winner = variants[0]
        losers = variants[1:]

        for loser in losers:
            # Re-point sample records.
            moved = (
                db.query(SampleRecord)
                .filter(SampleRecord.substance_id == loser.id)
                .update({"substance_id": winner.id}, synchronize_session=False)
            )
            merged_samples += moved

            # Re-point aliases (avoid duplicates by (substance_id, label)).
            loser_aliases = db.query(Alias).filter(Alias.substance_id == loser.id).all()
            for a in loser_aliases:
                exists = (
                    db.query(Alias)
                    .filter(Alias.substance_id == winner.id, Alias.label == a.label)
                    .first()
                )
                if exists:
                    db.delete(a)
                else:
                    a.substance_id = winner.id
                    merged_aliases += 1
            # Also add an alias for the loser's preferred_name itself so it
            # remains findable via search.
            if loser.preferred_name and loser.preferred_name != winner.preferred_name:
                exists = (
                    db.query(Alias)
                    .filter(
                        Alias.substance_id == winner.id,
                        Alias.label == loser.preferred_name,
                    )
                    .first()
                )
                if not exists:
                    db.add(
                        Alias(
                            substance_id=winner.id,
                            label=loser.preferred_name,
                            alias_type="common",
                            source="dedupe",
                        )
                    )
                    merged_aliases += 1

            # Re-point substance relations (from/to).
            for col in (SubstanceRelation.from_id, SubstanceRelation.to_id):
                moved_rel = (
                    db.query(SubstanceRelation)
                    .filter(col == loser.id)
                    .update({col.key: winner.id}, synchronize_session=False)
                )
                merged_relations += moved_rel

            db.delete(loser)
            removed_substances += 1

        merged_groups += 1

    db.commit()

    # Strip pathological self-relations that might have been created.
    db.query(SubstanceRelation).filter(
        SubstanceRelation.from_id == SubstanceRelation.to_id
    ).delete(synchronize_session=False)
    db.commit()

    stats = {
        "groups_merged": merged_groups,
        "substances_removed": removed_substances,
        "samples_repointed": merged_samples,
        "aliases_repointed": merged_aliases,
        "relations_repointed": merged_relations,
    }
    print(f"[dedupe] {stats}", flush=True)
    return stats
