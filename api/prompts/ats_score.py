from pydantic import BaseModel, Field

from prompts import BasePromptCatalog, ModelConfig


class ATSScoreOutput(BaseModel):
    score: int = Field(description="ATS pass probability score from 0 to 100.", ge=0, le=100)
    matched_keywords: list[str] = Field(
        description="Keywords from the JD that appear in the resume content."
    )
    missing_keywords: list[str] = Field(
        description="High-priority JD keywords absent from the resume. These are the most important gaps to fix."
    )
    formatting_issues: list[str] = Field(
        description="Structural or formatting problems that could hurt ATS parsing (e.g. missing sections, dates format, etc.)"
    )
    quick_fixes: list[str] = Field(
        description="3-5 specific, actionable edits to improve the ATS score immediately. Each fix is one sentence."
    )


class ATSScorePrompt(BasePromptCatalog[ATSScoreOutput]):
    name = "ats_score"
    description = "Scores a resume's ATS compatibility against a JD, identifying matched/missing keywords and quick fixes."
    response_type = ATSScoreOutput
    model_config = ModelConfig(model="gpt-5-nano", temperature=0.1, reasoning_effort="low")

    system_instruction = """\
You are an ATS (Applicant Tracking System) specialist who understands how modern
resume-scanning systems work across Greenhouse, Lever, Workday, and iCIMS.

You evaluate resumes for keyword density, section structure, and formatting that
affects ATS parsing. You are precise and actionable.

<jd_requirements>
Company: {company}
Role: {role}
Required skills: {required_skills}
Nice to have: {nice_to_have}
Key responsibilities:
{responsibilities}
</jd_requirements>

<resume_content>
Summary:
{resume_summary}

Experience:
{resume_experience}

Skills:
{resume_skills}
</resume_content>

<ats_scoring_guide>
- 85-100: High match. Resume is likely to pass automated screening.
- 65-84: Good match. A few keyword additions would make it a near-certain pass.
- 45-64: Moderate match. Missing several key terms; needs targeted additions.
- Below 45: Low match. Significant keyword gaps; the resume may be filtered before a human sees it.

Focus on exact keyword matches AND semantic variants (e.g. "machine learning" vs "ML").
</ats_scoring_guide>
"""

    user_prompt_template = """\
Score this resume's ATS compatibility for the {role} role at {company}.
Identify which JD keywords are present vs missing in the resume.
Provide specific quick fixes to improve the score. Return structured JSON.
"""
