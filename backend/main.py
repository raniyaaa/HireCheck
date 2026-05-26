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

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database.db          import init_db, load_all_candidates, clear_session
from batch.batch_processor import save_upload_bytes, process_single, is_supported

load_dotenv()

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads/resumes")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ── Create FastAPI app ────────────────────────────────────
app = FastAPI(
    title="HireCheck ATS API",
    description="AI-powered resume screening backend",
    version="1.0.0",
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

# ── Initialize database on startup ───────────────────────
@app.on_event("startup")
def startup():
    init_db()
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(os.getenv("MOCK_EMAIL_FOLDER", "mock_emails"), exist_ok=True)
    os.makedirs(os.getenv("EXPORT_FOLDER", "exports"), exist_ok=True)
    print("✅ HireCheck FastAPI server started")


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
):
    """
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
        "processed":  processed,
        "skipped":    skipped,
        "results":    results,
    }


# ── ENDPOINT 3: Load results ──────────────────────────────
@app.get("/results/{session_id}")
def get_results(session_id: str):
    """
    Loads all candidate results for a given session from the database.
    Used by Streamlit to reload results after processing.
    """
    candidates = load_all_candidates(session_id=session_id)
    return {"session_id": session_id, "results": candidates}


# ── ENDPOINT 4: Clear session ─────────────────────────────
@app.delete("/session/{session_id}")
def delete_session(session_id: str):
    """Clears all results for a session from the database."""
    clear_session(session_id)
    return {"message": f"Session {session_id} cleared"}