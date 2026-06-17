"""
Company research service using Tavily Search.

Uses the official langchain-tavily package (NOT the deprecated
langchain_community.tools.tavily_search). Triggered once during JD creation;
result is stored in jd.company_research and injected into coaching prompts.

Fails gracefully when TAVILY_API_KEY is absent — research is enrichment,
not a hard requirement for the core flow.
"""
import logging
import os

logger = logging.getLogger(__name__)

# Max characters of raw Tavily content to forward to the prompt.
_SNIPPET_MAX_CHARS = 400
_SNIPPETS_TO_USE = 3


class CompanyResearchService:

    def research(self, company_name: str, role_title: str) -> str:
        """
        Searches for publicly available information about a company using Tavily
        and returns a plain-text summary (2-4 sentences) suitable for injection
        into coaching prompts.

        Returns empty string if:
          - TAVILY_API_KEY is not set
          - Tavily returns no useful results
          - Any error occurs (all errors are swallowed — research is best-effort)
        """
        if not os.environ.get("TAVILY_API_KEY"):
            logger.info("TAVILY_API_KEY not set — skipping company research for '%s'", company_name)
            return ""

        try:
            from langchain_tavily import TavilySearch  # lazy import — optional dependency

            tool = TavilySearch(
                max_results=_SNIPPETS_TO_USE,
                search_depth="basic",    # fast + cheap; advanced costs 2 credits
                include_answer=True,     # Tavily's own AI summary — no second LLM call
                topic="general",
            )

            query = f"{company_name} engineering culture tech stack product 2026"
            logger.info("Running Tavily research for company='%s'", company_name)
            result = tool.invoke({"query": query})

            # Prefer Tavily's pre-built AI answer — it's already a concise summary.
            if isinstance(result, dict) and result.get("answer"):
                summary = result["answer"].strip()
                logger.info("Company research complete for '%s' (Tavily answer)", company_name)
                return summary

            # Fallback: stitch top snippets together.
            snippets = []
            raw_results = result.get("results", []) if isinstance(result, dict) else []
            for r in raw_results[:_SNIPPETS_TO_USE]:
                content = (r.get("content") or "").strip()
                if content:
                    snippets.append(content[:_SNIPPET_MAX_CHARS])

            if not snippets:
                logger.info("No Tavily results for '%s'", company_name)
                return ""

            summary = " ".join(snippets)
            logger.info("Company research complete for '%s' (snippet fallback)", company_name)
            return summary

        except ImportError:
            logger.warning(
                "langchain-tavily not installed — run `pip install langchain-tavily`. "
                "Skipping company research."
            )
            return ""
        except Exception:
            logger.warning(
                "Company research failed for '%s' — continuing without it",
                company_name,
                exc_info=True,
            )
            return ""
