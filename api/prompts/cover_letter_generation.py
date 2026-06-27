from pydantic import BaseModel, Field

from prompts import BasePromptCatalog, ModelConfig


class CoverLetterOutput(BaseModel):
    opening_paragraph: str = Field(
        description=(
            "First paragraph: hook sentence about why this specific company and role is exciting, "
            "followed by a brief positioning statement. 3-4 sentences. No generic openers."
        )
    )
    body_paragraphs: list[str] = Field(
        description=(
            "2-3 paragraphs connecting the candidate's experience to the role requirements. "
            "Each paragraph focuses on one theme (e.g. technical depth, leadership, domain match). "
            "Use specific achievements and numbers where available. No bullet points."
        )
    )
    closing_paragraph: str = Field(
        description=(
            "Closing paragraph: reiterate enthusiasm, mention specific next step (interview), "
            "thank the reader. 2-3 sentences. Confident, not desperate."
        )
    )
    tags: list[str] = Field(
        description=(
            "3-8 retrieval tags for this cover letter. Use the same tag vocabulary as resumes: "
            "role type, domain, tech stack, company size, seniority level."
        )
    )


class CoverLetterGenerationPrompt(BasePromptCatalog[CoverLetterOutput]):
    name = "cover_letter_generation"
    description = "Generates a tailored, compelling cover letter from coaching session answers and user background."
    response_type = CoverLetterOutput
    model_config = ModelConfig(model="gpt-4o-mini", temperature=0.75)

    system_instruction = """\
You are an expert cover letter writer who crafts compelling, highly personalised letters
that get read. You write in a confident, direct professional voice — never sycophantic,
never generic.

<role_context>
Target company: {company}
Target role: {role}
Company size / type: {company_size}
Role focus: {role_focus}
Tech depth: {tech_depth}
Domain: {domain}
</role_context>

<company_research>
{company_research}
</company_research>

<jd_requirements>
Required skills: {required_skills}
Key responsibilities:
{responsibilities}
</jd_requirements>

<coaching_answers>
What the candidate shared during coaching (these are the raw materials — distil and elevate):
{answers}
</coaching_answers>

<user_background>
{user_memories}
</user_background>

<writing_rules>
- Open with something specific about THIS company, not a generic statement.
- Reference the company research to show genuine interest (culture, products, mission).
- Every claim should be backed by a concrete example from the coaching answers or background.
- Avoid: "I am writing to apply", "I am a perfect fit", "passion for", "I believe I would".
- Length: 3 paragraphs total + opening + closing. Fits on one page when formatted.
- Tone: smart, self-assured, human. Not a robot reciting a CV.
</writing_rules>
"""

    user_prompt_template = """\
Write a tailored cover letter for this candidate applying to {role} at {company}.

Use the coaching session answers and background above. Produce structured JSON output with
opening_paragraph, body_paragraphs (list of 2-3 strings), closing_paragraph, and tags.
"""
