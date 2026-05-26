# batch/batch_processor.py

# PURPOSE:
#   Processes multiple resumes by running each one through
#   the LangGraph pipeline via graph.invoke().
#
#   For EACH resume:
#     1. Save uploaded file to disk
#     2. Build initial state dict
#     3. Call graph.invoke(state) → LangGraph runs all 6 nodes
#     4. Save final state to database
#     5. Return result
#
#   The progress_callback parameter lets FastAPI (and Streamlit)
#   know which resume is being processed right now.


import os
from typing import List, Callable, Optional
from dotenv import load_dotenv

from app.state   import state_to_dict
from app.graph   import get_graph
from database.db import save_candidate

load_dotenv()

UPLOAD_FOLDER     = os.getenv("UPLOAD_FOLDER", "uploads/resumes")
SUPPORTED_FORMATS = {".pdf",".jpg",".jpeg",".png",".bmp",".tiff",".tif",".webp"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def is_supported(filename: str) -> bool:
    return os.path.splitext(filename)[1].lower() in SUPPORTED_FORMATS


def save_upload(uploaded_file, folder: str) -> str:
    """
    Saves a Streamlit UploadedFile to disk.
    Returns the saved file path.
    """
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, uploaded_file.name)
    with open(path, "wb") as f:
        f.write(uploaded_file.getbuffer())
    return path


def save_upload_bytes(filename: str, data: bytes, folder: str) -> str:
    """
    Saves raw bytes (from FastAPI UploadFile) to disk.
    Returns the saved file path.
    """
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, filename)
    with open(path, "wb") as f:
        f.write(data)
    return path


def process_single(
    file_path: str,
    job_description: str,
    ideal_candidate_reference: str,
    session_id: str,
) -> dict:
    """
    Runs the full LangGraph pipeline for ONE resume file.

    Steps:
      1. Build initial state with the 3 required inputs
      2. Call graph.invoke() — LangGraph runs all nodes
      3. Save result to database
      4. Return final state as dict

    Args:
        file_path                 : Path to resume file on disk
        job_description           : JD text
        ideal_candidate_reference : Ideal profile text
        session_id                : Groups batch results in DB

    Returns:
        Final state dict with all evaluation fields filled.
    """
    initial_state = {
        "resume_path":               file_path,
        "job_description":           job_description,
        "ideal_candidate_reference": ideal_candidate_reference,
    }

    graph = get_graph()

    try:
        # ── This single line runs the entire pipeline ──────────
        # LangGraph calls: parser → jd_matcher → reference_matcher
        #                → summarizer → decision → comms → END
        final_state = graph.invoke(initial_state)
    except Exception as e:
        final_state = {
            "resume_path":    file_path,
            "candidate_name": os.path.basename(file_path),
            "error":          str(e),
            "decision":       "Error",
            "final_score":    0,
            "jd_score":       0,
            "reference_score": 0,
            "email_status":   "Not Sent",
            "email_content":  "",
        }

    save_candidate(state_to_dict(final_state), session_id=session_id)
    return state_to_dict(final_state)


def process_batch(
    uploaded_files: list,
    job_description: str,
    ideal_candidate_reference: str,
    session_id: str,
    progress_callback: Optional[Callable] = None,
) -> List[dict]:
    """
    Processes multiple Streamlit UploadedFile objects.

    Args:
        uploaded_files            : List of Streamlit UploadedFile objects
        job_description           : JD text
        ideal_candidate_reference : Ideal profile text
        session_id                : Batch identifier
        progress_callback         : Optional fn(current, total, message)
                                    called after each resume to update UI

    Returns:
        List of result dicts (one per processed resume)
    """
    results = []
    total   = len(uploaded_files)

    for i, f in enumerate(uploaded_files):
        if not is_supported(f.name):
            if progress_callback:
                progress_callback(i + 1, total, f"⚠️ Skipped: {f.name}")
            continue

        if progress_callback:
            progress_callback(i + 1, total, f"Processing: {f.name}")

        path   = save_upload(f, UPLOAD_FOLDER)
        result = process_single(
            file_path=path,
            job_description=job_description,
            ideal_candidate_reference=ideal_candidate_reference,
            session_id=session_id,
        )
        results.append(result)

    return results