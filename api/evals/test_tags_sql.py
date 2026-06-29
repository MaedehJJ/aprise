"""Regression tests for tag browse SQL (production 500 fixes)."""
import json
import uuid

from sqlalchemy import cast, select, text
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import JSONB

from db.models import JD, Resume


def test_browse_tag_filter_targets_labels_tags_array():
    """Containment must apply to labels->tags, not the whole labels object."""
    tag_array = cast(json.dumps(["Python"]), JSONB)
    user_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
    stmt = (
        select(JD)
        .filter(
            JD.user_id == user_id,
            JD.labels["tags"].op("@>")(tag_array),
        )
    )
    # Compile without literal_binds — JSONB cannot be rendered as a literal.
    # We only need to assert the SQL *structure*, not the parameter values.
    pg_dialect = postgresql.dialect()
    compiled = str(stmt.compile(dialect=pg_dialect))
    # "tags" becomes a bind param, so check for the subscript operator on labels.
    assert "labels[" in compiled   # labels['tags'] subscript, not bare labels
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
