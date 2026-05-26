# decision/decision.py

# LangGraph NODE 5 — Decision Engine
#
# Reads from state : jd_score, reference_score, candidate_name,
#                    jd_strengths, reference_strengths,
#                    jd_missing_skills, jd_weaknesses,
#                    reference_weaknesses
#
# Writes to state  : final_score, decision,
#                    final_recommendation_reason,
#                    strengths, missing_skills
#
# Decision rules (from .env, adjustable via UI sliders):
#   final_score > 18   → Accept
#   final_score 15-18  → Human Review
#   final_score < 15   → Reject


import os
from dotenv import load_dotenv
from app.state import CandidateState

load_dotenv()


def _thresholds():
    """Reads thresholds live from environment (UI sliders update these)."""
    return (
        float(os.environ.get("ACCEPT_THRESHOLD", 18)),
        float(os.environ.get("REVIEW_THRESHOLD", 15)),
    )


def _explain(name, final, decision, jd_s, ref_s,
             strengths, missing, accept_t, review_t) -> str:
    """Generates a plain-English reason for the hiring decision."""
    base = (
        f"{name} scored {final}/20 "
        f"(JD Match: {jd_s}/10, Profile Match: {ref_s}/10). "
    )
    if decision == "Accept":
        msg = base + f"Score exceeds the acceptance threshold of {accept_t}. "
        if strengths:
            msg += f"Key strengths: {', '.join(strengths[:3])}."
    elif decision == "Human Review":
        msg = (
            base +
            f"Score falls in the review band ({review_t}–{accept_t}), "
            "indicating a partial match requiring human judgment. "
        )
        if missing:
            msg += f"Notable gaps: {', '.join(missing[:3])}."
    else:
        msg = base + f"Score is below the minimum threshold of {review_t}. "
        if missing:
            msg += f"Key missing areas: {', '.join(missing[:3])}."
    return msg


# ──────────────────────────────────────────────────────────
# LANGGRAPH NODE FUNCTION
# ──────────────────────────────────────────────────────────
def decision_node(state: CandidateState) -> dict:
    """
    LangGraph Node 5: Calculates final score + makes hiring decision.

    Reads : jd_score, reference_score (+ supporting fields)
    Returns dict with: final_score, decision,
                       final_recommendation_reason,
                       strengths, missing_skills
    """
    accept_t, review_t = _thresholds()

    jd_s  = state.get("jd_score", 0)
    ref_s = state.get("reference_score", 0)
    final = round(jd_s + ref_s, 2)

    if final > accept_t:
        decision = "Accept"
    elif final >= review_t:
        decision = "Human Review"
    else:
        decision = "Reject"

    # Merge strengths and missing skills from both agents
    strengths = list(set(
        state.get("jd_strengths", []) +
        state.get("reference_strengths", [])
    ))
    missing = list(set(
        state.get("jd_missing_skills", []) +
        state.get("jd_weaknesses", []) +
        state.get("reference_weaknesses", [])
    ))

    reason = _explain(
        name      = state.get("candidate_name", "Candidate"),
        final     = final,
        decision  = decision,
        jd_s      = jd_s,
        ref_s     = ref_s,
        strengths = strengths,
        missing   = missing,
        accept_t  = accept_t,
        review_t  = review_t,
    )

    return {
        "final_score":                 final,
        "decision":                    decision,
        "final_recommendation_reason": reason,
        "strengths":                   strengths,
        "missing_skills":              missing,
    }