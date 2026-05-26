# agents/reference_matcher.py

# LangGraph NODE 3 — Reference Matcher Agent
#
# Reads from state : resume_text, ideal_candidate_reference
# Writes to state  : reference_score, reference_reasons,
#                    reference_strengths, reference_weaknesses,
#                    reference_explanation
#
# Focuses on soft skills, leadership, teamwork, projects —
# things the JD Matcher doesn't cover.


import json
import re
from app.state import CandidateState
from llm.groq_client import get_groq_response


SYSTEM_PROMPT = """You are a senior HR professional evaluating holistic candidate fit.
Focus ONLY on: soft skills, leadership, teamwork, communication, project quality,
initiative, problem-solving, and cultural alignment.
Do NOT focus on technical skills — that is handled separately.

Respond ONLY with a valid JSON object. No markdown, no extra text.

Required format:
{
  "score": <integer 0-10>,
  "strengths": ["point 1", "point 2"],
  "weaknesses": ["point 1", "point 2"],
  "reasons": ["reason 1", "reason 2"],
  "explanation": "2-3 sentence overall summary."
}

Scoring guide:
9-10 = Exceptional fit with ideal profile
7-8  = Strong fit
5-6  = Moderate fit
3-4  = Weak fit
0-2  = Poor fit"""


def _safe_parse(text: str) -> dict:
    try:
        clean = re.sub(r"```json|```", "", text).strip()
        return json.loads(clean)
    except Exception:
        return {
            "score": 0,
            "strengths": [],
            "weaknesses": ["Could not parse AI response"],
            "reasons": ["AI returned invalid JSON"],
            "explanation": "Reference evaluation failed due to parsing error.",
        }


# ──────────────────────────────────────────────────────────
# LANGGRAPH NODE FUNCTION
# ──────────────────────────────────────────────────────────
def reference_matcher_node(state: CandidateState) -> dict:
    """
    LangGraph Node 3: Scores resume vs Ideal Candidate Profile.

    Reads : state["resume_text"], state["ideal_candidate_reference"]
    Returns dict with: reference_score, reference_strengths,
                       reference_weaknesses, reference_reasons,
                       reference_explanation
    """
    if state.get("error") or not state.get("resume_text"):
        return {
            "reference_score":       0,
            "reference_explanation": "Skipped — resume parsing failed.",
            "reference_reasons":     [],
            "reference_strengths":   [],
            "reference_weaknesses":  [],
        }

    user_prompt = f"""
=== IDEAL CANDIDATE PROFILE ===
{state.get("ideal_candidate_reference", "")}

=== CANDIDATE RESUME ===
{state.get("resume_text", "")}

Evaluate the fit. Return ONLY the JSON object, nothing else.
"""
    try:
        raw    = get_groq_response(SYSTEM_PROMPT, user_prompt, temperature=0.2)
        result = _safe_parse(raw)
    except Exception as e:
        result = {
            "score": 0, "strengths": [], "weaknesses": [],
            "reasons": [str(e)], "explanation": f"Reference matching failed: {e}",
        }

    return {
        "reference_score":       max(0.0, min(10.0, float(result.get("score", 0)))),
        "reference_strengths":   result.get("strengths", []),
        "reference_weaknesses":  result.get("weaknesses", []),
        "reference_reasons":     result.get("reasons", []),
        "reference_explanation": result.get("explanation", ""),
    }