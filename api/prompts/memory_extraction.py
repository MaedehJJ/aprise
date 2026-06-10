from enum import Enum
from typing import ClassVar

from pydantic import BaseModel, Field

from prompts import BasePromptCatalog, ModelConfig


class MemoryCategory(str, Enum):
    EXPERIENCE = "experience"
    EDUCATION = "education"
    SKILLS_SUMMARY = "skills_summary"
    PROJECTS = "projects"
    LANGUAGES = "languages"
    OTHER = "other"


class MemoryChunk(BaseModel):
    category: MemoryCategory
    content: str = Field(
        description=(
            "A coherent section from the CV — e.g. a full company experience "
            "with role, responsibilities, and achievements."
        )
    )
    source: str = Field(
        description="The section title or company name this was extracted from."
    )


class MemoryExtractionOutput(BaseModel):
    chunks: list[MemoryChunk]


class MemoryExtractionPrompt(BasePromptCatalog[MemoryExtractionOutput]):
    name = "memory_extraction"
    description = "Extracts structured memory chunks from a raw CV text."
    response_type = MemoryExtractionOutput
    model_config = ModelConfig(model="gpt-5-nano", temperature=0, reasoning_effort="low")

    system_instruction: ClassVar[str] = """\
<role>
You are an expert CV analyst.
</role>

<objective>
Extract structured memory chunks from a candidate's CV.
</objective>

<instructions>
- Each chunk must represent one coherent section: a full company experience, an education entry, or a skills summary.
- Preserve context within each chunk by keeping the role, responsibilities, and achievements together.
- Write in third person and avoid pronouns.
- Be factual: do not infer, embellish, or score.
- Ignore formatting artifacts such as page numbers, headers, and export metadata.
</instructions>

<quality_bar>
Return only high-signal chunks that are complete, concise, and faithful to the source.
</quality_bar>

<chunk_types>
A chunk may be any of the following (create as many chunks as needed, but never mix unrelated facts in one chunk):
- Company experience (role, team/company, dates, responsibilities, achievements)
- Education (degree, school, dates, focus)
- Skills (grouped categories like languages, tools/technologies, domains)
- Projects (project name, role, dates, what was built, impact/achievements)
- Languages (languages spoken and proficiency if present)
</chunk_types>

<language_handling>
If the CV includes a languages section, extract it as a dedicated Languages chunk(s).
If proficiency levels are not present, extract only the language names.
</language_handling>

<projects_handling>
If the CV includes a projects section (or standalone project descriptions), extract them as Projects chunk(s) even when they are not tied to company experience.
</projects_handling>
"""

    user_prompt_template: ClassVar[str] = """\
Extract memory chunks from the following CV.

<cv>
{cv_text}
</cv>
"""
