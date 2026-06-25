import json
from typing import Any

SYSTEM_PROMPT = (
    "You are a thermodynamic operations advisor for the Sirajganj 150 MW peaking plant "
    "(SGT5-2000E). Use only the plant context JSON provided. Do not invent MW, efficiency, "
    "heat rate, or fuel flow values. Be brief and practical."
)


def build_context_block(context: dict[str, Any] | None) -> str:
    if not context:
        return "No plant context provided."
    return json.dumps(context, default=str)
