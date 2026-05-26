# ============================================================
# agents/summarizer.py
# ============================================================
# LangGraph NODE 4 — Summarizer Agent
#
# Reads from state : resume_text
# Writes to state  : summary
#
# Generates a 2-4 sentence plain-English summary of the
# candidate for the recruiter to read quickly.
#
# Example output:
# "Candidate demonstrates strong Python and ML skills with
#  solid project experience. Lacks cloud deployment exposure."
# ============================================================

from app.state import CandidateState
from llm.groq_client import get_groq_response


SYSTEM_PROMPT = """You are a professional HR recruiter writing candidate summaries
for a hiring manager. Rules:
- Maximum 3 sentences
- Third person ("Candidate demonstrates...")
- Professional and factual tone
- Mention the strongest qualities AND any significant gaps
- Plain paragraph only — no bullet points, no labels like "Summary:"
"""


# ──────────────────────────────────────────────────────────
# LANGGRAPH NODE FUNCTION
# ──────────────────────────────────────────────────────────
def summarizer_node(state: CandidateState) -> dict:
    """
    LangGraph Node 4: Generates recruiter-friendly candidate summary.

    Reads : state["resume_text"]
    Returns dict with: summary
    """
    if state.get("error") or not state.get("resume_text"):
        return {"summary": "Summary unavailable — resume parsing failed."}

    user_prompt = f"""
Write a concise recruiter summary for this candidate.

=== RESUME ===
{state.get("resume_text", "")[:3000]}

3 sentences max. Cover key qualifications and any notable gaps.
"""
    try:
        summary = get_groq_response(SYSTEM_PROMPT, user_prompt, temperature=0.4)
    except Exception as e:
        summary = f"Summary generation failed: {e}"

    return {"summary": summary}