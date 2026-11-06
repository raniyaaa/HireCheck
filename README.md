#  HireCheck — AI-Powered Resume Screening ATS

HireCheck is a multi-agent AI system that automatically screens resumes,
scores candidates and generates recruiter-ready insights.

---

##  Features

- **Batch Resume Upload** — Upload multiple PDFs or images at once
- **4 AI Agents** — Parser, JD Matcher, Reference Matcher, Summarizer, Comms Agent
- **Explainable Scores** — Every score comes with detailed reasoning
- **Decision Engine** — Auto Accept / Human Review / Reject
- **Mock Email Generation** — AI-written emails saved to mock_emails/
- **CSV Export** — Download full results table
- **Search & Filter** — By name or decision category

---

##  Project Structure

```
HireCheck/
├── app/
│   ├── main.py          # CLI test runner
│   ├── graph.py         # Pipeline definition
│   └── state.py         # Candidate data container
├── agents/
│   ├── parser_agent.py      # PDF/image text extraction
│   ├── jd_matcher.py        # Score vs Job Description
│   ├── reference_matcher.py # Score vs Ideal Profile
│   ├── summarizer.py        # Generate candidate summary
│   └── comms_agent.py       # Generate emails
├── decision/
│   └── decision.py          # Accept/Review/Reject logic
├── batch/
│   └── batch_processor.py   # Process multiple resumes
├── database/
│   └── db.py                # SQLite operations
├── llm/
│   └── groq_client.py       # Groq AI connection
├── uploads/resumes/         # Uploaded resumes go here
├── exports/                 # CSV exports go here
├── mock_emails/             # Generated emails saved here
├── frontend/                # Next.js UI (replacing Streamlit) — see frontend/README.md
├── streamlit_app.py         # Legacy Streamlit UI (kept until the Next.js UI is live)
├── run.py                   # App launcher
├── .env                     # Your secret config
└── requirements.txt         # Python dependencies
```

---

## ⚙️ Setup Instructions

### Step 1 — Clone / Open Project
Clone the repository and open the `HireCheck/` folder in VS Code.

### Step 2 — Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3 — Install Tesseract OCR (for image resumes)
- **Windows:** Download from [UB Mannheim Tesseract](https://github.com/UB-Mannheim/tesseract/wiki)
- **Mac:** `brew install tesseract`
- **Linux:** `sudo apt install tesseract-ocr`

### Step 4 — Configure Environment Variables
Create a `.env` file in the project root and add your configuration:

```env
GROQ_API_KEY=gsk_your_actual_key_here
```

Get your free API key from [Groq Console](https://console.groq.com).

For local development, configure the required database environment variables as well.

### Step 5 — Run the Application Locally

Start the FastAPI backend and Next.js frontend separately.

**Backend:**
```bash
uvicorn backend.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open your browser at `http://localhost:3000`.

### 🌐 Live Application
Access HireCheck here: [https://hirecheck-kappa.vercel.app](https://hirecheck-kappa.vercel.app)

The application is deployed on Vercel, with a FastAPI backend and TiDB Cloud database.

---

## How It Works

```text
Recruiter uploads resumes + pastes JD + pastes Ideal Profile
                         ↓
              Batch Processor loops through each resume
                         ↓
              Parser Agent — extracts text from PDF/image
                         ↓
              JD Matcher Agent — scores resume vs Job Description (0-10)
                         ↓
              Reference Matcher Agent — scores resume vs Ideal Profile (0-10)
                         ↓
              Summarizer Agent — generates recruiter summary
                         ↓
              Decision Engine — Final Score = JD Score + Ref Score
                         ↓
              > 18 = Accept | 15-18 = Review | < 15 = Reject
                         ↓
              Comms Agent — generates appropriate email
                         ↓
              Candidate results saved to TiDB Cloud database
                         ↓
              Results displayed in the Next.js dashboard
```

---

## Configuration

Configure the following variables in `.env`:

```env
ACCEPT_THRESHOLD=18
REVIEW_THRESHOLD=15
GROQ_MODEL=llama-3.1-8b-instant
```

You can also adjust the decision thresholds live using the sliders in the sidebar.

---

## Mock Emails

Generated emails are saved as `.txt` files in the `mock_emails/` directory during local development.

Each file is named:

`CandidateName_Decision_Timestamp.txt`

On Vercel, temporary files are stored under `/tmp/mock_emails/` because the serverless filesystem is not persistent.

To switch to real Gmail later, update `agents/comms_agent.py` to integrate Python's `smtplib` with your Gmail credentials.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, shadcn/ui |
| Backend | Python, FastAPI |
| AI/LLM | Groq API, openai/gpt-oss-20b |
| Multi-Agent Orchestration | LangGraph |
| PDF Parsing | pdfplumber, PyMuPDF |
| OCR | pytesseract, Tesseract |
| Database | TiDB Cloud (MySQL-compatible) |
| Authentication | JWT |
| Data Export | pandas |
| Configuration | python-dotenv |
| Deployment | Vercel |

