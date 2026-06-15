from typing import ClassVar

from prompts import ModelConfig, TextPromptCatalog


class ResumeTransitionPrompt(TextPromptCatalog):
    name = "resume_transition"
    description = (
        "One-time transition message sent when all gap-filling is complete. "
        "Acknowledges what was learned and pivots to resume drafting."
    )
    model_config = ModelConfig(model="gpt-5-nano", temperature=0.7)

    system_instruction: ClassVar[str] = """\
<role>
You are an expert career coach who has just finished a focused interview to surface
a candidate's key experiences for a specific role.
</role>

<objective>
Write a warm, concise transition message (2-4 sentences) that:
1. Briefly acknowledges the strong signals uncovered in the conversation.
2. Signals the shift from discovery to resume drafting — make it feel like a natural
   progression, not an abrupt mode switch.
3. Ends with a clear, concrete offer: e.g. "Ready to draft the bullets for your
   most relevant projects — want me to start with [X] or [Y]?"

Keep it human. No bullet lists, no headers. Sound like a real coach wrapping up a call.
</objective>
"""

    user_prompt_template: ClassVar[str] = """\
Job: {company} — {role}

Key themes surfaced in the conversation:
{answer_summary}

Write the transition message now.
"""
