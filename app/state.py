# ============================================================
# app/state.py
# ============================================================
# PURPOSE:
#   LangGraph State definition.
#   This TypedDict is the shared data container that flows
#   through every node in the pipeline.
#
#   'total=False' means every field is optional — nodes only
#   need to return the keys they actually updated.
# ============================================================

from typing import TypedDict, List, Optional


class CandidateState(TypedDict, total=False):

    # ── Inputs (set before graph starts) ──────────────────────
    resume_path:               str   # File path on disk
    job_description:           str   # JD pasted by recruiter
    ideal_candidate_reference: str   # Ideal profile pasted by recruiter

    # ── Parser node output ────────────────────────────────────
    candidate_name:            str   # Extracted from resume
    resume_text:               str   # Full text extracted from file

    # ── JD Matcher node output ────────────────────────────────
    jd_score:                  float
    jd_reasons:                List[str]
    jd_missing_skills:         List[str]
    jd_strengths:              List[str]
    jd_weaknesses:             List[str]
    jd_explanation:            str

    # ── Reference Matcher node output ─────────────────────────
    reference_score:           float
    reference_reasons:         List[str]
    reference_strengths:       List[str]
    reference_weaknesses:      List[str]
    reference_explanation:     str

    # ── Summarizer node output ────────────────────────────────
    summary:                   str

    # ── Decision node output ──────────────────────────────────
    final_score:               float
    decision:                  str   # "Accept" | "Human Review" | "Reject"
    final_recommendation_reason: str
    strengths:                 List[str]   # Combined from both agents
    missing_skills:            List[str]   # Combined from both agents

    # ── Comms node output ─────────────────────────────────────
    email_status:              str
    email_content:             str

    # ── Error tracking ────────────────────────────────────────
    error:                     Optional[str]


def state_to_dict(state: CandidateState) -> dict:
    """
    Converts the LangGraph state to a plain Python dict.
    Used when saving to database or returning from FastAPI.
    Provides safe defaults for any missing keys.
    """
    return {
        "candidate_name":               state.get("candidate_name", "Unknown"),
        "resume_path":                  state.get("resume_path", ""),
        "jd_score":                     state.get("jd_score", 0),
        "reference_score":              state.get("reference_score", 0),
        "final_score":                  state.get("final_score", 0),
        "decision":                     state.get("decision", ""),
        "jd_reasons":                   state.get("jd_reasons", []),
        "jd_missing_skills":            state.get("jd_missing_skills", []),
        "jd_strengths":                 state.get("jd_strengths", []),
        "jd_weaknesses":                state.get("jd_weaknesses", []),
        "jd_explanation":               state.get("jd_explanation", ""),
        "reference_reasons":            state.get("reference_reasons", []),
        "reference_strengths":          state.get("reference_strengths", []),
        "reference_weaknesses":         state.get("reference_weaknesses", []),
        "reference_explanation":        state.get("reference_explanation", ""),
        "missing_skills":               state.get("missing_skills", []),
        "strengths":                    state.get("strengths", []),
        "summary":                      state.get("summary", ""),
        "final_recommendation_reason":  state.get("final_recommendation_reason", ""),
        "email_status":                 state.get("email_status", "Not Sent"),
        "email_content":                state.get("email_content", ""),
        "error":                        state.get("error", None),
    }