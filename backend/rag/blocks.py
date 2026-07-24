"""Fixed block-type library (subset for Phase 0 step 3, per CLAUDE.md).

Frontend renders purely off this structured JSON -- the LLM never returns
free text directly. Four block types for now: description_list, stat_grid,
comparison_table, faq_accordion. More get added to BLOCK_SCHEMAS as the
component library grows; nothing else about the calling code should need
to change.

Both tools use strict mode (`strict: True`) so the API validates
`tool_use.input` against the schema before returning it, instead of just
hoping the model complies -- this is what actually prevents the "blocks
came back as a JSON-string instead of a real array" class of bug, not
just papering over it after the fact. Strict mode requires
additionalProperties: false on every object and doesn't support
minItems/maxItems, so those constraints are enforced by the system prompt
instead (see rag/query.py).
"""

DESCRIPTION_LIST = {
    "type": "object",
    "properties": {
        "block_type": {"const": "description_list"},
        "heading": {"type": "string"},
        "body": {"type": "string"},
        "bullets": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["block_type", "heading", "body", "bullets"],
    "additionalProperties": False,
}

STAT_GRID = {
    "type": "object",
    "properties": {
        "block_type": {"const": "stat_grid"},
        "stats": {
            "type": "array",
            "description": "2-6 stats.",
            "items": {
                "type": "object",
                "properties": {
                    "value": {"type": "string"},
                    "label": {"type": "string"},
                },
                "required": ["value", "label"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["block_type", "stats"],
    "additionalProperties": False,
}

COMPARISON_TABLE = {
    "type": "object",
    "properties": {
        "block_type": {"const": "comparison_table"},
        "headers": {"type": "array", "items": {"type": "string"}},
        "rows": {
            "type": "array",
            "items": {"type": "array", "items": {"type": "string"}},
        },
    },
    "required": ["block_type", "headers", "rows"],
    "additionalProperties": False,
}

FAQ_ACCORDION = {
    "type": "object",
    "properties": {
        "block_type": {"const": "faq_accordion"},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "answer": {"type": "string"},
                },
                "required": ["question", "answer"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["block_type", "items"],
    "additionalProperties": False,
}

BLOCK_SCHEMAS = [DESCRIPTION_LIST, STAT_GRID, COMPARISON_TABLE, FAQ_ACCORDION]

# Two-phase generation, split into two tool schemas so phase 1 (title) can be
# a small, fast, low-effort call that returns before phase 2 (blocks) even
# starts -- matches the "title renders fast, blocks populate progressively"
# pattern from the Sharda AI benchmark in CLAUDE.md, and gives the frontend
# something to paint almost immediately instead of one long blocking wait.

TITLE_TOOL = {
    "name": "emit_title",
    "description": (
        "Emit just the page headline and subtitle for this query. Always "
        "call this tool exactly once -- never respond in free text."
    ),
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "H1 headline -- the user's query reframed as an editorial title.",
            },
            "subtitle": {
                "type": "string",
                "description": "1-2 line muted context line under the title.",
            },
        },
        "required": ["title", "subtitle"],
        "additionalProperties": False,
    },
}

BLOCKS_TOOL = {
    "name": "emit_blocks",
    "description": (
        "Emit the structured content blocks answering this query. Always "
        "call this tool exactly once -- never respond in free text."
    ),
    "strict": True,
    "input_schema": {
        "type": "object",
        "properties": {
            "blocks": {
                "type": "array",
                "description": "One or more content blocks, chosen from the fixed block library.",
                "items": {"anyOf": BLOCK_SCHEMAS},
            },
            "follow_up_chips": {
                "type": "array",
                "description": "2-4 contextual follow-up questions related to this answer.",
                "items": {"type": "string"},
            },
            "insufficient_context": {
                "type": "boolean",
                "description": (
                    "True if the retrieved context did not contain enough "
                    "information to answer -- in that case `blocks` should "
                    "explain what is/isn't known and point to official "
                    "contact info, not fabricate an answer."
                ),
            },
            "grounded": {
                "type": "boolean",
                "description": (
                    "True only if every factual claim in `blocks` traces "
                    "back to the provided context chunks."
                ),
            },
        },
        "required": ["blocks", "follow_up_chips", "insufficient_context", "grounded"],
        "additionalProperties": False,
    },
}
