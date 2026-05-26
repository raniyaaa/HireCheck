# ============================================================
# agents/jd_matcher.py
# ============================================================
# LangGraph NODE 2 — JD Matcher Agent
#
# Reads from state : resume_text, job_description
# Writes to state  : jd_score, jd_reasons, jd_missing_skills,
#                    jd_strengths, jd_weaknesses, jd_explanation
#
# Asks AI to compare resume vs job description and return
# a structured JSON score with full reasoning.
# ============================================================

import json
import re
from app.state import CandidateState
from llm.groq_client import get_groq_response


SYSTEM_PROMPT = """You are an expert technical recruiter evaluating resumes.
Compare the candidate resume against the job description.

Respond ONLY with a valid JSON object. No markdown, no extra text outside JSON.

Required format:
{
  "score": <integer 0-10>,
  "strengths": ["point 1", "point 2"],
  "weaknesses": ["point 1", "point 2"],
  "missing_skills": ["skill 1", "skill 2"],
  "reasons": ["reason 1", "reason 2"],
  "explanation": "2-3 sentence overall summary of the match."
}

Scoring guide:
9-10 = Exceptional match
7-8  = Strong match
5-6  = Partial match
3-4  = Weak match
0-2  = Poor match"""


def _safe_parse(text: str) -> dict:
    """Parses AI JSON response safely. Returns defaults if parsing fails."""
    try:
        clean = re.sub(r"```json|```", "", text).strip()
        return json.loads(clean)
    except Exception:
        return {
            "score": 0,
            "strengths": [],
            "weaknesses": ["Could not parse AI response"],
            "missing_skills": [],
            "reasons": ["AI returned invalid JSON"],
            "explanation": "JD evaluation failed due to a response parsing error.",
        }


# ──────────────────────────────────────────────────────────
# LANGGRAPH NODE FUNCTION
# ──────────────────────────────────────────────────────────
def jd_matcher_node(state: CandidateState) -> dict:
    """
    LangGraph Node 2: Scores resume vs Job Description.

    Reads : state["resume_text"], state["job_description"]
    Returns dict with: jd_score, jd_strengths, jd_weaknesses,
                       jd_missing_skills, jd_reasons, jd_explanation
    """
    # Skip if previous node had an error
    if state.get("error") or not state.get("resume_text"):
        return {
            "jd_score":          0,
            "jd_explanation":    "Skipped — resume parsing failed.",
            "jd_reasons":        [],
            "jd_missing_skills": [],
            "jd_strengths":      [],
            "jd_weaknesses":     [],
        }

    user_prompt = f"""
=== JOB DESCRIPTION ===
{state.get("job_description", "")}

=== CANDIDATE RESUME ===
{state.get("resume_text", "")}

Evaluate the match. Return ONLY the JSON object, nothing else.
"""
    try:
        raw    = get_groq_response(SYSTEM_PROMPT, user_prompt, temperature=0.2)
        result = _safe_parse(raw)
    except Exception as e:
        result = {
            "score": 0, "strengths": [], "weaknesses": [],
            "missing_skills": [], "reasons": [str(e)],
            "explanation": f"JD matching failed: {e}",
        }

    return {
        "jd_score":          max(0.0, min(10.0, float(result.get("score", 0)))),
        "jd_strengths":      result.get("strengths", []),
        "jd_weaknesses":     result.get("weaknesses", []),
        "jd_missing_skills": result.get("missing_skills", []),
        "jd_reasons":        result.get("reasons", []),
        "jd_explanation":    result.get("explanation", ""),
    }