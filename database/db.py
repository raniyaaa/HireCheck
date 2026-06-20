# database/db.py

# PURPOSE:
#   All SQLite database operations for HireCheck.
#   The file 'hirecheck.db' is created automatically in your
#   HireCheck/ root folder when the app first starts.


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
    #this table stores info about candidates whose resumes were analyzed
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
    #this table stores the login information
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            username    TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL,
            role        TEXT NOT NULL DEFAULT 'recruiter',
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT
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

def create_user(username: str, hashed_password: str, role: str = "recruiter"):
    """
    Saves a new user to the database.
    Password must already be hashed before calling this.
    Returns True if created, False if username already exists.
    """
    conn   = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO users (username, password, role, is_active, created_at)
            VALUES (?, ?, ?, 1, ?)
        """, (username, hashed_password, role, datetime.now().isoformat()))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        # UNIQUE constraint failed → username already exists
        return False
    finally:
        conn.close()

def get_user(username: str) -> dict | None:
    """
    Fetches a user by username.
    Returns a dict with user data, or None if not found.
    """
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_users() -> list:
    """Returns all users (for admin panel)."""
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, role, is_active, created_at FROM users")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_user(username: str):
    """Deletes a user by username."""
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE username = ?", (username,))
    conn.commit()
    conn.close()

def get_all_sessions() -> list:
    """
    Returns a summary of every session ever processed —
    grouped by session_id, showing who ran it, when, and how many candidates.
    Used by the admin dashboard.
    """
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            session_id,
            COUNT(*) as candidate_count,
            SUM(CASE WHEN decision = 'Accept' THEN 1 ELSE 0 END) as accepted,
            SUM(CASE WHEN decision = 'Human Review' THEN 1 ELSE 0 END) as review,
            SUM(CASE WHEN decision = 'Reject' THEN 1 ELSE 0 END) as rejected,
            MIN(created_at) as started_at,
            MAX(created_at) as last_updated
        FROM candidates
        GROUP BY session_id
        ORDER BY started_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_system_stats() -> dict:
    """
    Returns overall system-wide statistics.
    Used by the admin analytics panel.
    """
    conn   = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as total FROM candidates")
    total_candidates = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(DISTINCT session_id) as total FROM candidates")
    total_sessions = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM users")
    total_users = cursor.fetchone()["total"]

    cursor.execute("SELECT COUNT(*) as total FROM users WHERE is_active = 1")
    active_users = cursor.fetchone()["total"]

    cursor.execute("""
        SELECT decision, COUNT(*) as count
        FROM candidates
        GROUP BY decision
    """)
    decision_breakdown = {row["decision"]: row["count"] for row in cursor.fetchall()}

    cursor.execute("SELECT AVG(final_score) as avg_score FROM candidates WHERE final_score > 0")
    avg_row   = cursor.fetchone()
    avg_score = round(avg_row["avg_score"], 2) if avg_row["avg_score"] else 0

    conn.close()

    return {
        "total_candidates":    total_candidates,
        "total_sessions":      total_sessions,
        "total_users":         total_users,
        "active_users":        active_users,
        "decision_breakdown":  decision_breakdown,
        "avg_final_score":     avg_score,
    }

def set_user_active(username: str, is_active: bool):
    """Enables or disables a user account."""
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET is_active = ? WHERE username = ?",
        (1 if is_active else 0, username)
    )
    conn.commit()
    conn.close()

def update_user_role(username: str, new_role: str):
    """Changes a user's role (recruiter <-> admin)."""
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET role = ? WHERE username = ?",
        (new_role, username)
    )
    conn.commit()
    conn.close()
