# ============================================================
# run.py
# ============================================================
# Starts BOTH servers with one command:
#   python run.py
#
# What it does:
#   1. Checks your .env is configured
#   2. Creates required folders
#   3. Starts FastAPI on port 8000 (in background thread)
#   4. Starts Streamlit on port 8501 (in foreground)
#
# After running, open: http://localhost:8501
# ============================================================

import os
import sys
import time
import threading
import subprocess
from dotenv import load_dotenv

load_dotenv()


def check_env():
    key = os.getenv("GROQ_API_KEY", "")
    if not key or key == "your_groq_api_key_here":
        print("❌ GROQ_API_KEY not set in .env")
        print("   → Get yours at https://console.groq.com")
        sys.exit(1)
    print("✅ GROQ_API_KEY found")


def create_folders():
    for folder in ["uploads/resumes", "exports", "mock_emails"]:
        os.makedirs(folder, exist_ok=True)
        print(f"✅ Folder ready: {folder}/")


def start_fastapi():
    """Starts FastAPI server in a background thread."""
    subprocess.run([
        sys.executable, "-m", "uvicorn",
        "backend.main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload",
    ])


def start_streamlit():
    """Starts Streamlit in the main thread."""
    subprocess.run([
        sys.executable, "-m", "streamlit", "run",
        "streamlit_app.py",
        "--server.port", "8501",
        "--browser.gatherUsageStats", "false",
    ])


if __name__ == "__main__":
    print("\n🔍 HireCheck ATS — Starting\n")
    check_env()
    create_folders()

    print("\n🚀 Starting FastAPI backend on http://localhost:8000")
    api_thread = threading.Thread(target=start_fastapi, daemon=True)
    api_thread.start()

    print("⏳ Waiting for backend to start...")
    time.sleep(3)

    print(" Starting Streamlit UI on http://localhost:8501\n")
    start_streamlit()