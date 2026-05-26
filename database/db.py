# ============================================================
# database/db.py
# ============================================================
# PURPOSE:
#   All SQLite database operations for HireCheck.
#   The file 'hirecheck.db' is created automatically in your
#   HireCheck/ root folder when the app first starts.
# ============================================================

import os
import json
import sqlite3
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("DATABASE_URL", "hirecheck.db")


def get_connection():
    """Opens a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Lets us access columns by name
    return conn


def init_db():
    """
    Creates the database file and candidates table if they
    don't already exist. Called once when the app starts.
    """
    conn   = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS candidates (
            id                          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id                  TEXT,
            candidate_name              TEXT,
            resume_path                 TEXT,
            jd_score                    REAL,
            reference_score             REAL,
            final_score                 REAL,
            decision                    TEXT,
            jd_reasons                  TEXT,
            jd_missing_skills           TEXT,
            jd_strengths                TEXT,
            jd_weaknesses               TEXT,
            jd_explanation              TEXT,
            reference_reasons           TEXT,
            reference_strengths         TEXT,
            reference_weaknesses        TEXT,
            reference_explanation       TEXT,
            missing_skills              TEXT,
            strengths                   TEXT,
            summary                     TEXT,
            final_recommendation_reason TEXT,
            email_status                TEXT,
            email_content               TEXT,
            error                       TEXT,
            created_at                  TEXT
        )
    """)

    conn.commit()
    conn.close()


def save_candidate(candidate_dict: dict, session_id: str = "default"):
    """
    Saves one candidate's result to the database.
    Lists are converted to JSON strings for storage.
    """
    conn   = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO candidates (
            session_id, candidate_name, resume_path,
            jd_score, reference_score, final_score, decision,
            jd_reasons, jd_missing_skills, jd_strengths, jd_weaknesses,
            jd_explanation, reference_reasons, reference_strengths,
            reference_weaknesses, reference_explanation,
            missing_skills, strengths, summary,
            final_recommendation_reason, email_status, email_content,
            error, created_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        session_id,
        candidate_dict.get("candidate_name", "Unknown"),
        candidate_dict.get("resume_path", ""),
        candidate_dict.get("jd_score", 0),
        candidate_dict.get("reference_score", 0),
        candidate_dict.get("final_score", 0),
        candidate_dict.get("decision", ""),
        json.dumps(candidate_dict.get("jd_reasons", [])),
        json.dumps(candidate_dict.get("jd_missing_skills", [])),
        json.dumps(candidate_dict.get("jd_strengths", [])),
        json.dumps(candidate_dict.get("jd_weaknesses", [])),
        candidate_dict.get("jd_explanation", ""),
        json.dumps(candidate_dict.get("reference_reasons", [])),
        json.dumps(candidate_dict.get("reference_strengths", [])),
        json.dumps(candidate_dict.get("reference_weaknesses", [])),
        candidate_dict.get("reference_explanation", ""),
        json.dumps(candidate_dict.get("missing_skills", [])),
        json.dumps(candidate_dict.get("strengths", [])),
        candidate_dict.get("summary", ""),
        candidate_dict.get("final_recommendation_reason", ""),
        candidate_dict.get("email_status", "Not Sent"),
        candidate_dict.get("email_content", ""),
        candidate_dict.get("error", ""),
        datetime.now().isoformat(),
    ))

    conn.commit()
    conn.close()


def load_all_candidates(session_id: str = None) -> list:
    """
    Loads candidates from the database.
    If session_id is given, only loads that batch.
    """
    conn   = get_connection()
    cursor = conn.cursor()

    if session_id:
        cursor.execute(
            "SELECT * FROM candidates WHERE session_id=? ORDER BY final_score DESC",
            (session_id,)
        )
    else:
        cursor.execute("SELECT * FROM candidates ORDER BY created_at DESC")

    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        d = dict(row)
        # Convert JSON strings back to Python lists
        for field in ["jd_reasons","jd_missing_skills","jd_strengths","jd_weaknesses",
                      "reference_reasons","reference_strengths","reference_weaknesses",
                      "missing_skills","strengths"]:
            try:
                d[field] = json.loads(d[field]) if d[field] else []
            except Exception:
                d[field] = []
        results.append(d)

    return results


def clear_session(session_id: str):
    """Deletes all candidates belonging to a specific session."""
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM candidates WHERE session_id=?", (session_id,))
    conn.commit()
    conn.close()