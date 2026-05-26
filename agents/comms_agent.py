# ============================================================
# agents/comms_agent.py
# ============================================================
# LangGraph NODE 6 — Communication Agent
#
# Reads from state : decision, candidate_name, final_score,
#                    strengths, missing_skills, summary
# Writes to state  : email_content, email_status
#
# Generates a professional email and saves it as a .txt file
# in mock_emails/ folder. Nothing is actually sent.
# ============================================================

import os
from datetime import datetime
from dotenv import load_dotenv
from app.state import CandidateState
from llm.groq_client import get_groq_response

load_dotenv()

MOCK_FOLDER = os.getenv("MOCK_EMAIL_FOLDER", "mock_emails")
os.makedirs(MOCK_FOLDER, exist_ok=True)


SYSTEM_PROMPT = """You are a professional HR coordinator writing recruitment emails.
Rules:
- Warm, professional, respectful tone
- 3-5 paragraphs maximum
- Specific to this candidate's situation
- Start with: Dear [Candidate Name],
- Write ONLY the email body — no Subject line, no To/From headers
"""


def _build_prompt(state: CandidateState) -> str:
    name      = state.get("candidate_name", "Candidate")
    score     = state.get("final_score", 0)
    decision  = state.get("decision", "")
    strengths = ", ".join(state.get("strengths", [])[:3]) or "your qualifications"
    missing   = ", ".join(state.get("missing_skills", [])[:3]) or "certain requirements"
    summary   = state.get("summary", "")

    if decision == "Accept":
        return f"""Write an interview invitation email.
Candidate: {name} | Score: {score}/20 | Top strengths: {strengths}
Summary: {summary}
Include: congratulate shortlisting, mention 1-2 specific impressive points,
invite for interview, ask to confirm availability within 3 days."""

    elif decision == "Human Review":
        return f"""Write an "application under review" holding email.
Candidate: {name} | Score: {score}/20
Summary: {summary}
Include: thank for applying, inform being carefully reviewed,
expected timeline of 1-2 weeks, encourage them to stay in touch."""

    else:  # Reject
        return f"""Write a professional empathetic rejection email.
Candidate: {name} | Score: {score}/20 | Gaps: {missing}
Summary: {summary}
Include: thank sincerely for time, inform not moving forward currently,
give 1-2 specific actionable improvement suggestions based on gaps,
warmly encourage applying again in the future."""


def _save_email(name: str, decision: str, content: str) -> str:
    """Saves email to mock_emails/ as a .txt file. Returns file path."""
    safe  = "".join(c for c in name if c.isalnum() or c == " ").replace(" ", "_")
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path  = os.path.join(MOCK_FOLDER, f"{safe}_{decision}_{stamp}.txt")

    with open(path, "w", encoding="utf-8") as f:
        f.write("=== MOCK EMAIL — Not Actually Sent ===\n")
        f.write(f"To       : {name}\n")
        f.write(f"Decision : {decision}\n")
        f.write(f"Created  : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("=" * 50 + "\n\n")
        f.write(content)

    return path


# ──────────────────────────────────────────────────────────
# LANGGRAPH NODE FUNCTION
# ──────────────────────────────────────────────────────────
def comms_node(state: CandidateState) -> dict:
    """
    LangGraph Node 6: Generates and saves candidate email.

    Reads : decision, candidate_name, final_score,
            strengths, missing_skills, summary
    Returns dict with: email_content, email_status
    """
    if not state.get("decision"):
        return {
            "email_status":  "Skipped — no decision available",
            "email_content": "",
        }

    try:
        body = get_groq_response(SYSTEM_PROMPT, _build_prompt(state), temperature=0.5)
        path = _save_email(
            state.get("candidate_name", "Unknown"),
            state.get("decision", "Unknown"),
            body,
        )
        return {
            "email_content": body,
            "email_status":  f"Saved → {path}",
        }
    except Exception as e:
        return {
            "email_content": "",
            "email_status":  f"Failed: {e}",
        }