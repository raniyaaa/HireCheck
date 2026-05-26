# 🔍 HireCheck — AI-Powered Resume Screening ATS

HireCheck is a multi-agent AI system that automatically screens resumes,
scores candidates and generates recruiter-ready insights.

---

## ✨ Features

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
├── streamlit_app.py         # Main Streamlit UI
├── run.py                   # App launcher
├── .env                     # Your secret config
└── requirements.txt         # Python dependencies
```

---

## ⚙️ Setup Instructions

### Step 1 — Clone / Open Project
Open the `HireCheck/` folder in VS Code.

### Step 2 — Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3 — Install Tesseract OCR (for image resumes)
- **Windows:** Download from https://github.com/UB-Mannheim/tesseract/wiki
- **Mac:** `brew install tesseract`
- **Linux:** `sudo apt install tesseract-ocr`

### Step 4 — Set Your Groq API Key
Open `.env` and replace `your_groq_api_key_here`:
```
GROQ_API_KEY=gsk_your_actual_key_here
```
Get your free key from: https://console.groq.com

### Step 5 — Run the App
```bash
python run.py
```

Open your browser at: **http://localhost:8501**

---

## 🧠 How It Works

```
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
     Comms Agent — generates appropriate email (saved to mock_emails/)
                        ↓
          Saved to SQLite database + displayed in UI
```

---

## 🎛️ Configuration

Edit `.env` to change:
```
ACCEPT_THRESHOLD=18     # Score above this = Accept
REVIEW_THRESHOLD=15     # Score above this = Review
GROQ_MODEL=llama-3.1-8b-instant
```

You can also adjust thresholds live using the sliders in the sidebar.

---

## 📧 Mock Emails

All emails are saved as `.txt` files in `mock_emails/`.
Each file is named: `CandidateName_Decision_Timestamp.txt`

To switch to real Gmail later, update `agents/comms_agent.py` to use
Python's `smtplib` with your Gmail credentials.

---

## 📦 Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| UI          | Streamlit                         |
| AI/LLM      | Groq (llama-3.1-8b-instant)       |
| PDF Parsing | pdfplumber, PyMuPDF                |
| OCR         | pytesseract + Tesseract            |
| Database    | SQLite (via SQLAlchemy)            |
| Data Export | pandas                             |
| Config      | python-dotenv                      |
