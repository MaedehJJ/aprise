from pydantic import BaseModel, Field

from prompts import BasePromptCatalog, ModelConfig


class StarStoryOutput(BaseModel):
    title: str = Field(description="Short descriptive title for the story (e.g. 'Led payment system migration at Acme')")
    situation: str = Field(description="The context and challenge — what was the situation? 1-3 sentences.")
    task_action: str = Field(description="What did the candidate do specifically? Include concrete actions. 2-4 sentences.")
    result: str = Field(description="Measurable outcome or impact. Numbers preferred. 1-2 sentences.")
    skills: list[str] = Field(description="Skills demonstrated: e.g. ['leadership', 'Python', 'system design', 'stakeholder management']")


class StarExtractionOutput(BaseModel):
    stories: list[StarStoryOutput] = Field(
        description="List of STAR stories extracted from the conversation. 1-5 stories. Only include genuine stories with enough detail."
    )


class StarExtractionPrompt(BasePromptCatalog[StarExtractionOutput]):
    name = "star_extraction"
    description = "Extracts structured STAR (Situation-Task/Action-Result) stories from coaching conversation answers."
    response_type = StarExtractionOutput
    model_config = ModelConfig(model="gpt-5-nano", temperature=0.3, reasoning_effort="low")

    system_instruction = """\
You are extracting STAR (Situation-Task-Action-Result) stories from a coaching conversation.

A STAR story is a concrete, specific narrative about a past experience — it must have:
  - A real situation/challenge (not hypothetical)
  - Specific actions the candidate personally took
  - A concrete outcome or result

<jd_context>
Company: {company}
Role: {role}
Required skills: {required_skills}
</jd_context>

<conversation_answers>
{answers}
</conversation_answers>

<rules>
- Extract only genuine stories — ignore vague statements like "I'm good at X".
- Combine fragments if multiple answers build the same story.
- Do not fabricate details not present in the source material.
- If no clear STAR stories exist, return an empty list.
- Split into separate stories if two distinct situations are described.
</rules>
"""

    user_prompt_template = """\
Extract all distinct STAR stories from the coaching conversation answers above.
Return structured JSON with a `stories` list.
"""
