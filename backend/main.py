# backend/main.py

# FastAPI Backend Server for HireCheck ATS
#
# This server sits between the Streamlit UI and the LangGraph
# pipeline. It exposes HTTP API endpoints that Streamlit calls.
#
# Architecture:
#   Streamlit → HTTP POST /process → FastAPI → LangGraph → DB
#   Streamlit ← JSON results       ← FastAPI ← DB
#
# Endpoints:
#   GET  /health                → check server is alive
#   POST /process               → process uploaded resumes
#   GET  /results/{session_id}  → load results from database
#   DELETE /session/{session_id}→ clear a session from database
#
# HOW TO RUN (in a separate terminal):
#   uvicorn backend.main:app --reload --port 8000


import os
import uuid
import shutil
from typing import List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from dotenv import load_dotenv

from database.db import (
    init_db, load_all_candidates, clear_session, create_user, get_user,
    get_all_users, get_all_sessions, get_system_stats, set_user_active,
    update_user_role
)
from batch.batch_processor import save_upload_bytes, process_single, is_supported
from backend.auth import (
    hash_password, verify_password,
    create_access_token, decode_access_token
)
from backend.models import UserSignup, UserLogin, TokenResponse

load_dotenv()

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads/resumes")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ── Create FastAPI app ────────────────────────────────────
app = FastAPI(
    title="HireCheck ATS API",
    description="AI-powered resume screening backend",
    version="2.0.0",
)

# ── Allow Streamlit to call this API ─────────────────────
# CORS = Cross-Origin Resource Sharing
# Without this, the browser blocks Streamlit from calling FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # In production, restrict to your domain
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── OAuth2 scheme ──────────────────────────────────────────
# This tells FastAPI how to find the token in incoming requests
# (it looks for: Authorization: Bearer <token>)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# ── Initialize database on startup ───────────────────────
@app.on_event("startup")
def startup():
    init_db()
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(os.getenv("MOCK_EMAIL_FOLDER", "mock_emails"), exist_ok=True)
    os.makedirs(os.getenv("EXPORT_FOLDER", "exports"), exist_ok=True)
    print("✅ HireCheck FastAPI server started")

# ──────────────────────────────────────────────────────────
# AUTH DEPENDENCIES
# These are functions that FastAPI runs BEFORE your endpoint
# to check if the request is allowed through.
# ──────────────────────────────────────────────────────────
def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    DEPENDENCY: Protects any route that needs a logged-in user.

    How it works:
      1. FastAPI extracts the token from the Authorization header
      2. We decode it using decode_access_token()
      3. If valid → return the user info (username, role)
      4. If invalid/expired → raise 401 Unauthorized

    Usage in an endpoint:
        @app.get("/something")
        def my_route(current_user: dict = Depends(get_current_user)):
            # current_user = {"sub": "raniya", "role": "admin"}
            ...
    """
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please log in again.",
        )

    username = payload.get("sub")
    user = get_user(username)
    if user is None or not user["is_active"]:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return {"username": user["username"], "role": user["role"]}

def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """
    DEPENDENCY: Protects routes that ONLY admins can access.

    Builds on top of get_current_user() — first checks you're logged in,
    THEN checks your role is "admin".
    """
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required for this action.",
        )
    return current_user

# AUTH ENDPOINTS
@app.post("/auth/signup", response_model=TokenResponse)
def signup(user_data: UserSignup):
    """
    Creates a new user account.

    Steps:
      1. Hash the password (never store plain text)
      2. Save user to database
      3. Immediately log them in (return a token)
    """
    # Check if username already taken
    existing = get_user(user_data.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Hash password before storing
    hashed = hash_password(user_data.password)

    # Save to database
    success = create_user(user_data.username, hashed, user_data.role)
    if not success:
        raise HTTPException(status_code=400, detail="Could not create user")

    # Auto-login: create a token immediately after signup
    token = create_access_token({"sub": user_data.username, "role": user_data.role})

    return TokenResponse(
        access_token=token,
        role=user_data.role,
        username=user_data.username,
    )


@app.post("/auth/login", response_model=TokenResponse)
def login(user_data: UserLogin):
    """
    Logs in an existing user.

    Steps:
      1. Find user in database by username
      2. Verify password matches the stored hash
      3. If correct → generate and return a JWT token
      4. If wrong → reject with 401 Unauthorized
    """
    user = get_user(user_data.username)

    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    if not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")

    if not user["is_active"]:
        raise HTTPException(status_code=401, detail="Account is disabled")

    token = create_access_token({"sub": user["username"], "role": user["role"]})

    return TokenResponse(
        access_token=token,
        role=user["role"],
        username=user["username"],
    )

# ── ENDPOINT 1: Health check ─────────────────────────────
@app.get("/health")
def health_check():
    """
    Simple check to confirm the server is running.
    Streamlit calls this first to verify backend is alive.
    """
    return {"status": "ok", "message": "HireCheck API is running"}


# ── ENDPOINT 2: Process resumes ──────────────────────────
@app.post("/process")
async def process_resumes(
    files: List[UploadFile] = File(...),
    job_description: str    = Form(...),
    ideal_reference: str    = Form(...),
    session_id: str         = Form(None),
    accept_threshold: float = Form(18),
    review_threshold: float = Form(15),
    current_user: dict      = Depends(get_current_user),   # PROTECTED
):
    
    """
    Processes resumes through the LangGraph pipeline.
    Requires a valid JWT token — must be logged in
    Main endpoint: receives uploaded resume files + recruiter inputs,
    runs the LangGraph pipeline for each resume,
    and returns all evaluation results as JSON.

    Parameters (sent as multipart form data):
        files            : One or more resume files (PDF/image)
        job_description  : JD text
        ideal_reference  : Ideal candidate profile text
        session_id       : Optional batch ID (auto-generated if not provided)
        accept_threshold : Score above which candidate is Accepted (default 18)
        review_threshold : Score above which candidate goes to Review (default 15)

    Returns:
        JSON with session_id and list of candidate results
    """
    # Generate session ID if not provided
    if not session_id:
        session_id = str(uuid.uuid4())[:8]

    # Update thresholds in environment so decision_node reads them
    os.environ["ACCEPT_THRESHOLD"] = str(accept_threshold)
    os.environ["REVIEW_THRESHOLD"] = str(review_threshold)

    # Validate inputs
    if not job_description.strip():
        raise HTTPException(status_code=400, detail="Job description is required")
    if not ideal_reference.strip():
        raise HTTPException(status_code=400, detail="Ideal candidate reference is required")
    if not files:
        raise HTTPException(status_code=400, detail="At least one resume file is required")

    results      = []
    skipped      = []
    processed    = 0

    for upload_file in files:
        filename = upload_file.filename

        # Skip unsupported files
        if not is_supported(filename):
            skipped.append(filename)
            continue

        # Read file bytes and save to disk
        file_bytes = await upload_file.read()
        file_path  = save_upload_bytes(filename, file_bytes, UPLOAD_FOLDER)

        # Run LangGraph pipeline for this resume
        try:
            result = process_single(
                file_path=file_path,
                job_description=job_description,
                ideal_candidate_reference=ideal_reference,
                session_id=session_id,
            )
            results.append(result)
            processed += 1
        except Exception as e:
            results.append({
                "candidate_name": filename,
                "error":          str(e),
                "decision":       "Error",
                "final_score":    0,
                "jd_score":       0,
                "reference_score": 0,
                "email_status":   "Not Sent",
            })

    return {
        "session_id": session_id,
        "processed_by":   current_user["username"],   # track who ran this batch
        "processed":  processed,
        "skipped":    skipped,
        "results":    results,
    }


# ── ENDPOINT 3: Load results ──────────────────────────────
@app.get("/results/{session_id}")
def get_results(
    session_id: str,
    current_user: dict = Depends(get_current_user) #PROTECTED
):
    """
    Loads all candidate results for a given session from the database.
    Used by Streamlit to reload results after processing.
    """
    candidates = load_all_candidates(session_id=session_id)
    return {"session_id": session_id, "results": candidates}


# ── ENDPOINT 4: Clear session ─────────────────────────────
@app.delete("/session/{session_id}")
def delete_session(
    session_id: str,
    current_user: dict = Depends(require_admin),   # 🔒 ADMIN ONLY
):
    """Clears all results for a session from the database."""
    clear_session(session_id)
    return {"message": f"Session {session_id} cleared by {current_user['username']}"}

@app.get("/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Returns info about the currently logged-in user. Useful for Streamlit to verify token validity."""
    return current_user


# ──────────────────────────────────────────────────────────
# ADMIN-ONLY ENDPOINTS
# All protected with require_admin — only admin role can access
# ──────────────────────────────────────────────────────────

@app.get("/admin/sessions")
def admin_get_all_sessions(current_user: dict = Depends(require_admin)):
    """
    🔒 ADMIN ONLY — Returns a summary of every session from every user.
    Recruiters can only see their own session via /results/{id}.
    Admin sees everything here.
    """
    sessions = get_all_sessions()
    return {"sessions": sessions}

@app.get("/admin/stats")
def admin_get_stats(current_user: dict = Depends(require_admin)):
    """
    🔒 ADMIN ONLY — System-wide analytics:
    total candidates processed, accept/reject rates, user counts, etc.
    """
    stats = get_system_stats()
    return stats

@app.get("/admin/users")
def admin_get_users(current_user: dict = Depends(require_admin)):
    """🔒 ADMIN ONLY — Lists all registered users and their roles/status."""
    users = get_all_users()
    return {"users": users}

@app.post("/admin/users/{username}/toggle-active")
def admin_toggle_user(
    username: str,
    activate: bool,
    current_user: dict = Depends(require_admin),
):
    """
    🔒 ADMIN ONLY — Enable or disable a user account.
    Disabled users cannot log in (checked in /auth/login).
    """
    if username == current_user["username"]:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")

    set_user_active(username, activate)
    status_word = "activated" if activate else "deactivated"
    return {"message": f"User '{username}' has been {status_word}"}

@app.delete("/admin/session/{session_id}")
def admin_delete_session(
    session_id: str,
    current_user: dict = Depends(require_admin),
):
    """🔒 ADMIN ONLY — Deletes any session, regardless of who created it."""
    clear_session(session_id)
    return {"message": f"Session '{session_id}' deleted by admin '{current_user['username']}'"}