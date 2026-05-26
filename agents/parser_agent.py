# agents/parser_agent.py

# LangGraph NODE 1 — Parser
#
# Reads from state : resume_path
# Writes to state  : candidate_name, resume_text


import os
import re
import sys
import io
import pdfplumber
from PIL import Image
from app.state import CandidateState

# ── Tesseract setup ───────────────────────────────────────
try:
    import pytesseract
    if sys.platform == "win32":
        pytesseract.pytesseract.tesseract_cmd = (
            r"C:\Program Files\Tesseract-OCR\tesseract.exe\tesseract.exe"
        )
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False


def _extract_pdf(path: str) -> str:
    """Extracts text from a PDF file page by page."""
    text = ""
    try:
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    text += t + "\n"
    except Exception as e:
        text = f"[PDF ERROR: {e}]"
    return text.strip()


def _extract_image(path: str) -> str:
    """
    Extracts text from an image using OCR.
    Reads file bytes into memory first to avoid
    Windows WinError 5 (Access Denied) file lock issues.
    """
    if not OCR_AVAILABLE:
        return "[OCR NOT AVAILABLE: Install pytesseract + Tesseract]"

    try:
        # Read file into memory → avoids Windows file lock
        with open(path, "rb") as f:
            img_bytes = f.read()

        img  = Image.open(io.BytesIO(img_bytes))
        img  = img.convert("RGB")
        text = pytesseract.image_to_string(img)
        img.close()

        return text.strip() if text.strip() else "[IMAGE ERROR: OCR returned empty]"

    except Exception as e:
        return f"[IMAGE ERROR: {e}]"

def _guess_name(text: str) -> str:
    """
    Tries to find candidate name from the first few lines.
    Handles both:
      - Single word all-caps names  e.g. "RANIYA"
      - Multi word capitalized names e.g. "Giulia Gonzalez"
    """
    if not text:
        return "Unknown Candidate"

    lines = [l.strip() for l in text.split("\n") if l.strip()]

    for line in lines[:8]:
        # Skip contact info lines
        if any(x in line.lower() for x in
               ["@", "phone", "email", "address", "linkedin",
                "github", "http", "objective", "summary", "profile",
                "university", "college", "institute", "school"]):
            continue
        # Skip lines with long numbers
        if re.search(r'\d{4,}', line):
            continue

        words = line.split()

        # Case 1: Single word, all uppercase, at least 3 chars
        # e.g. "RANIYA"
        if len(words) == 1 and words[0].isupper() and len(words[0]) >= 3:
            return line

        # Case 2: 2-5 words, each starting with capital letter
        # e.g. "Giulia Gonzalez" or "GIULIA GONZALEZ"
        if 2 <= len(words) <= 5 and all(
            w[0].isupper() for w in words if w.isalpha()
        ):
            return line

    return lines[0] if lines else "Unknown Candidate"



# ──────────────────────────────────────────────────────────
# LANGGRAPH NODE FUNCTION
# ──────────────────────────────────────────────────────────
def parser_node(state: CandidateState) -> dict:
    """
    LangGraph Node 1: Reads resume file → extracts text + name.

    Reads  : state["resume_path"]
    Returns: candidate_name, resume_text  (or error)
    """
    path = state.get("resume_path", "")

    if not path or not os.path.exists(path):
        return {
            "error":          f"File not found: {path}",
            "resume_text":    "",
            "candidate_name": "Unknown",
        }

    ext = os.path.splitext(path)[1].lower()

    if ext == ".pdf":
        text = _extract_pdf(path)
    elif ext in {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".webp"}:
        text = _extract_image(path)
    else:
        return {
            "error":          f"Unsupported format: {ext}",
            "resume_text":    "",
            "candidate_name": "Unknown",
        }

    if text.startswith("["):
        return {
            "error":          text,
            "resume_text":    "",
            "candidate_name": "Unknown",
        }

    return {
        "candidate_name": _guess_name(text),
        "resume_text":    text,
    }







# # ============================================================
# # agents/parser_agent.py
# # ============================================================
# # LangGraph NODE 1 — Parser
# #
# # Reads from state : resume_path
# # Writes to state  : candidate_name, resume_text
# #                    (or error if file can't be read)
# #
# # Supports:
# #   PDF   → pdfplumber (text-based PDFs)
# #   Image → pytesseract OCR (JPG, PNG, etc.)
# # ============================================================

# import os
# import re
# import sys
# import pdfplumber
# from PIL import Image
# from app.state import CandidateState

# # Try importing pytesseract for OCR
# try:
#     import pytesseract
#     # Windows: update this path if Tesseract installed elsewhere
#     if sys.platform == "win32":
#         pytesseract.pytesseract.tesseract_cmd = (
#             r"C:\Program Files\tesseract.exe\tesseract.exe"
#         )
#     OCR_AVAILABLE = True
# except ImportError:
#     OCR_AVAILABLE = False


# def _extract_pdf(path: str) -> str:
#     """Extracts text from a PDF file page by page."""
#     text = ""
#     try:
#         with pdfplumber.open(path) as pdf:
#             for page in pdf.pages:
#                 t = page.extract_text()
#                 if t:
#                     text += t + "\n"
#     except Exception as e:
#         text = f"[PDF ERROR: {e}]"
#     return text.strip()


# def _extract_image(path: str) -> str:
#     """Extracts text from an image using OCR."""
#     if not OCR_AVAILABLE:
#         return "[OCR NOT AVAILABLE: Install pytesseract + Tesseract]"
#     try:
#         return pytesseract.image_to_string(Image.open(path)).strip()
#     except Exception as e:
#         return f"[IMAGE ERROR: {e}]"


# def _guess_name(text: str) -> str:
#     """
#     Tries to find the candidate name from the first few lines.
#     Names are usually at the top, 2-4 words, all capitalized,
#     no numbers or email-like content.
#     """
#     if not text:
#         return "Unknown Candidate"

#     lines = [l.strip() for l in text.split("\n") if l.strip()]

#     for line in lines[:8]:
#         # Skip contact info lines
#         if any(x in line.lower() for x in
#                ["@","phone","email","address","linkedin",
#                 "github","http","objective","summary","profile"]):
#             continue
#         # Skip lines with long numbers (phone, zip)
#         if re.search(r'\d{4,}', line):
#             continue
#         words = line.split()
#         if 1 < len(words) <= 5 and all(
#             w[0].isupper() for w in words if w.isalpha()
#         ):
#             return line

#     return lines[0] if lines else "Unknown Candidate"


# # ──────────────────────────────────────────────────────────
# # LANGGRAPH NODE FUNCTION
# # ──────────────────────────────────────────────────────────
# def parser_node(state: CandidateState) -> dict:
#     """
#     LangGraph Node 1: Reads resume file → extracts text + name.

#     Reads : state["resume_path"]
#     Returns dict with: candidate_name, resume_text
#                        (or error if something goes wrong)
#     """
#     path = state.get("resume_path", "")

#     if not path or not os.path.exists(path):
#         return {
#             "error":          f"File not found: {path}",
#             "resume_text":    "",
#             "candidate_name": "Unknown",
#         }

#     ext = os.path.splitext(path)[1].lower()

#     if ext == ".pdf":
#         text = _extract_pdf(path)
#     elif ext in {".jpg",".jpeg",".png",".bmp",".tiff",".tif",".webp"}:
#         text = _extract_image(path)
#     else:
#         return {
#             "error":          f"Unsupported format: {ext}",
#             "resume_text":    "",
#             "candidate_name": "Unknown",
#         }

#     if text.startswith("["):
#         return {
#             "error":          text,
#             "resume_text":    "",
#             "candidate_name": "Unknown",
#         }

#     return {
#         "candidate_name": _guess_name(text),
#         "resume_text":    text,
#     }