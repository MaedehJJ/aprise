"""Regression tests for tag browse SQL (production 500 fixes)."""
import json

from sqlalchemy import cast, select, text
from sqlalchemy.dialects.postgresql import JSONB

from db.models import JD, Resume


def test_browse_tag_filter_targets_labels_tags_array():
    """Containment must apply to labels->tags, not the whole labels object."""
    tag_array = cast(json.dumps(["Python"]), JSONB)
    stmt = (
        select(JD)
        .filter(
            JD.user_id == "00000000-0000-0000-0000-000000000001",
            JD.labels["tags"].op("@>")(tag_array),
        )
    )
    compiled = str(stmt.compile(compile_kwargs={"literal_binds": True}))
    assert "labels" in compiled
    assert "tags" in compiled
    assert "@>" in compiled


def test_list_tags_sql_uses_cast_not_double_colon_param():
    """SQLAlchemy text() params must use CAST(:uid AS uuid), not :uid::uuid."""
    from sqlalchemy import text

    sql = text("""
        SELECT t.tag, COUNT(*) AS cnt
        FROM jds j,
             jsonb_array_elements_text(j.labels->'tags') AS t(tag)
        WHERE j.user_id = CAST(:uid AS uuid)
          AND (j.labels->>'tags') IS NOT NULL
        GROUP BY t.tag
    """)
    # Should compile without treating :: as part of the bind name
    compiled = str(sql.compile(compile_kwargs={"literal_binds": True}))
    assert "CAST" in compiled
    assert ":uid::uuid" not in compiled
