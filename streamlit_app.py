# ============================================================
# streamlit_app.py
# ============================================================
# The HireCheck recruiter UI.
#
# Flow:
#   1. Recruiter fills sidebar (JD + ideal profile + thresholds)
#   2. Recruiter uploads resumes + clicks Process
#   3. Streamlit sends files to FastAPI via HTTP POST /process
#   4. FastAPI runs LangGraph pipeline, returns JSON results
#   5. Streamlit displays results table + expandable panels
#   6. Recruiter can search, filter, and export CSV
#
# HOW TO RUN:
#   streamlit run streamlit_app.py
# ============================================================

import os
import uuid
import time
import httpx
import pandas as pd
import streamlit as st
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# ─────────────────────────────────────────────────────────
# PAGE CONFIG
# ─────────────────────────────────────────────────────────
st.set_page_config(
    page_title  = "HireCheck",
    page_icon   = "🔍",
    layout      = "wide",
    initial_sidebar_state = "expanded",
)

# ─────────────────────────────────────────────────────────
# CSS
# ─────────────────────────────────────────────────────────
st.markdown("""
<style>
.main .block-container { padding-top: 1.5rem; padding-bottom: 2rem; }

.badge-accept { background:#dcfce7; color:#166534; padding:4px 12px;
                border-radius:20px; font-weight:700; font-size:13px; }
.badge-review { background:#fef9c3; color:#854d0e; padding:4px 12px;
                border-radius:20px; font-weight:700; font-size:13px; }
.badge-reject { background:#fee2e2; color:#991b1b; padding:4px 12px;
                border-radius:20px; font-weight:700; font-size:13px; }
.badge-error  { background:#f3f4f6; color:#374151; padding:4px 12px;
                border-radius:20px; font-weight:700; font-size:13px; }

.metric-box { background:white; border-radius:10px; padding:16px;
              text-align:center; box-shadow:0 1px 4px rgba(0,0,0,0.1); }
.metric-num { font-size:32px; font-weight:800; }
.metric-lbl { font-size:13px; color:#6b7280; margin-top:4px; }

#MainMenu { visibility:hidden; }
footer    { visibility:hidden; }
</style>
""", unsafe_allow_html=True)


# ─────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────
def badge(decision: str) -> str:
    cls = {
        "Accept":       "badge-accept",
        "Human Review": "badge-review",
        "Reject":       "badge-reject",
    }.get(decision, "badge-error")
    return f'<span class="{cls}">{decision}</span>'


def score_color(score: float, max_v: float = 20) -> str:
    pct = (score / max_v) * 100
    if pct >= 80: return "#16a34a"
    if pct >= 60: return "#ca8a04"
    return "#dc2626"


def to_csv(data: list) -> bytes:
    rows = [{
        "Name":            c.get("candidate_name",""),
        "JD Score":        c.get("jd_score", 0),
        "Ref Score":       c.get("reference_score", 0),
        "Final Score":     c.get("final_score", 0),
        "Decision":        c.get("decision",""),
        "Summary":         c.get("summary",""),
        "Strengths":       ", ".join(c.get("strengths",[])),
        "Missing Skills":  ", ".join(c.get("missing_skills",[])),
        "JD Explanation":  c.get("jd_explanation",""),
        "Ref Explanation": c.get("reference_explanation",""),
        "Email Status":    c.get("email_status",""),
    } for c in data]
    return pd.DataFrame(rows).to_csv(index=False).encode("utf-8")


def check_backend() -> bool:
    """Returns True if FastAPI backend is reachable."""
    try:
        r = httpx.get(f"{BACKEND_URL}/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


# ─────────────────────────────────────────────────────────
# SESSION STATE
# ─────────────────────────────────────────────────────────
if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())[:8]
if "results"    not in st.session_state:
    st.session_state.results    = []
if "processed"  not in st.session_state:
    st.session_state.processed  = False


# ─────────────────────────────────────────────────────────
# SIDEBAR
# ─────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🔍 HireCheck ATS")
    st.caption("AI-Powered Resume Screening")

    # Backend status indicator
    if check_backend():
        st.success("✅ Backend connected")
    else:
        st.error("❌ Backend offline — run: uvicorn backend.main:app --reload --port 8000")

    st.divider()

    st.subheader(" Job Description")
    jd_input = st.text_area(
        "Paste the full Job Description",
        height=180,
        placeholder="e.g. We are looking for a Python developer with 3+ years experience in FastAPI, PostgreSQL, and Docker...",
        key="jd",
    )

    st.divider()

    st.subheader(" Ideal Candidate Profile")
    ref_input = st.text_area(
        "Describe your ideal candidate",
        height=150,
        placeholder="e.g. Strong problem-solver, experience leading teams, portfolio of shipped products...",
        key="ref",
    )

    st.divider()

    st.subheader("⚙️ Decision Thresholds")
    accept_t = st.slider("Accept if score above", 15, 20, 18)
    review_t = st.slider("Review if score above", 10, int(accept_t), 15)
    st.caption(f"🟢 Accept >**{accept_t}**  🟡 Review **{review_t}–{accept_t}**  🔴 Reject <**{review_t}**")

    st.divider()

    if st.button("🔄 New Session", use_container_width=True):
        st.session_state.session_id = str(uuid.uuid4())[:8]
        st.session_state.results    = []
        st.session_state.processed  = False
        st.rerun()

    st.caption(f"Session: `{st.session_state.session_id}`")


# ─────────────────────────────────────────────────────────
# MAIN AREA — HEADER
# ─────────────────────────────────────────────────────────
st.title("HireCheck — AI Resume Screening")
# st.caption("Powered by LangGraph + Groq llama-3.1-8b-instant")
st.divider()

# ─────────────────────────────────────────────────────────
# UPLOAD + PROCESS
# ─────────────────────────────────────────────────────────
st.subheader(" Upload Resumes")

uploaded = st.file_uploader(
    "Upload PDF or image resumes (multiple files supported)",
    type=["pdf","jpg","jpeg","png","bmp","tiff","tif"],
    accept_multiple_files=True,
    help="Supported: PDF, JPG, JPEG, PNG, BMP, TIFF",
)

if uploaded:
    st.success(f"✅ {len(uploaded)} file(s) ready")
    cols = st.columns(min(len(uploaded), 4))
    for i, f in enumerate(uploaded):
        cols[i % 4].caption(f"📄 {f.name}")

st.write("")

can_process = (
    bool(uploaded) and
    bool(jd_input.strip()) and
    bool(ref_input.strip()) and
    check_backend()
)

process_btn = st.button(
    "▶ Process Resumes",
    type="primary",
    disabled=not can_process,
    use_container_width=False,
)

if not jd_input.strip():
    st.warning("⬅ Please add a Job Description in the sidebar")
elif not ref_input.strip():
    st.warning("⬅ Please add an Ideal Candidate Profile in the sidebar")
elif not check_backend():
    st.error("⬅ Start the FastAPI backend first (see sidebar)")

# ─────────────────────────────────────────────────────────
# PROCESSING
# ─────────────────────────────────────────────────────────
if process_btn and uploaded:
    st.divider()
    st.subheader(" Processing...")

    progress = st.progress(0)
    status   = st.empty()

    status.info("📤 Sending resumes to backend...")
    progress.progress(10)

    try:
        # Build multipart form data for FastAPI
        files_payload = [
            ("files", (f.name, f.getvalue(), "application/octet-stream"))
            for f in uploaded
        ]
        data_payload = {
            "job_description":  jd_input,
            "ideal_reference":  ref_input,
            "session_id":       st.session_state.session_id,
            "accept_threshold": str(accept_t),
            "review_threshold": str(review_t),
        }

        progress.progress(30)
        status.info(" LangGraph Pipeline running — AI agents evaluating resumes...")

        # Send to FastAPI
        response = httpx.post(
            f"{BACKEND_URL}/process",
            files=files_payload,
            data=data_payload,
            timeout=300,  # 5 min timeout for large batches
        )

        progress.progress(90)

        if response.status_code == 200:
            data = response.json()
            st.session_state.results   = data.get("results", [])
            st.session_state.processed = True

            skipped = data.get("skipped", [])
            n       = data.get("processed", 0)

            progress.progress(100)
            status.success(f" Done! {n} resume(s) processed.")
            if skipped:
                st.warning(f"⚠️ Skipped (unsupported format): {', '.join(skipped)}")
        else:
            status.error(f"❌ Backend error: {response.text}")

    except httpx.TimeoutException:
        status.error("❌ Request timed out. Try fewer resumes or check backend.")
    except Exception as e:
        status.error(f"❌ Error: {e}")


# ─────────────────────────────────────────────────────────
# RESULTS
# ─────────────────────────────────────────────────────────
if st.session_state.processed and st.session_state.results:
    results = st.session_state.results
    st.divider()

    # ── Summary metrics ──────────────────────────────────
    total    = len(results)
    accepted = sum(1 for r in results if r.get("decision") == "Accept")
    review   = sum(1 for r in results if r.get("decision") == "Human Review")
    rejected = sum(1 for r in results if r.get("decision") == "Reject")

    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(f"""<div class="metric-box">
            <div class="metric-num">{total}</div>
            <div class="metric-lbl">📋 Total</div></div>""",
            unsafe_allow_html=True)
    with c2:
        st.markdown(f"""<div class="metric-box">
            <div class="metric-num" style="color:#16a34a">{accepted}</div>
            <div class="metric-lbl">✅ Accepted</div></div>""",
            unsafe_allow_html=True)
    with c3:
        st.markdown(f"""<div class="metric-box">
            <div class="metric-num" style="color:#ca8a04">{review}</div>
            <div class="metric-lbl">🔍 Under Review</div></div>""",
            unsafe_allow_html=True)
    with c4:
        st.markdown(f"""<div class="metric-box">
            <div class="metric-num" style="color:#dc2626">{rejected}</div>
            <div class="metric-lbl">❌ Rejected</div></div>""",
            unsafe_allow_html=True)

    st.divider()

    # ── Search + filter ──────────────────────────────────
    st.subheader("📊 Candidate Results")
    fc1, fc2 = st.columns([2, 1])
    with fc1:
        search = st.text_input("🔎 Search by name", placeholder="Type to search...")
    with fc2:
        filt = st.selectbox("Filter by Decision", ["All","Accept","Human Review","Reject"])

    filtered = results
    if search:
        filtered = [r for r in filtered
                    if search.lower() in r.get("candidate_name","").lower()]
    if filt != "All":
        filtered = [r for r in filtered if r.get("decision") == filt]

    st.caption(f"Showing **{len(filtered)}** of **{total}** candidates")
    st.write("")

    # ── Table header ─────────────────────────────────────
    h1,h2,h3,h4,h5 = st.columns([3,1.5,1.5,1.5,2])
    h1.markdown("**Candidate**")
    h2.markdown("**JD Score**")
    h3.markdown("**Ref Score**")
    h4.markdown("**Final**")
    h5.markdown("**Decision**")
    st.markdown("---")

    # ── Candidate rows ────────────────────────────────────
    for idx, c in enumerate(filtered):
        name    = c.get("candidate_name","Unknown")
        jd_s    = c.get("jd_score", 0)
        ref_s   = c.get("reference_score", 0)
        final_s = c.get("final_score", 0)
        dec     = c.get("decision","Unknown")

        r1,r2,r3,r4,r5 = st.columns([3,1.5,1.5,1.5,2])
        r1.markdown(f"**{name}**")
        r2.markdown(
            f"<span style='color:{score_color(jd_s,10)};font-weight:700'>{jd_s}/10</span>",
            unsafe_allow_html=True)
        r3.markdown(
            f"<span style='color:{score_color(ref_s,10)};font-weight:700'>{ref_s}/10</span>",
            unsafe_allow_html=True)
        r4.markdown(
            f"<span style='color:{score_color(final_s,20)};font-weight:700;font-size:16px'>{final_s}/20</span>",
            unsafe_allow_html=True)
        r5.markdown(badge(dec), unsafe_allow_html=True)

        # ── Expandable detail panel ───────────────────────
        with st.expander(f"🔍 Full Analysis — {name}"):
            t1, t2, t3, t4 = st.tabs(
                ["📋 Overview", "🤖 JD Analysis", "🎯 Profile Analysis", "📧 Email"]
            )

            # TAB 1 — Overview
            with t1:
                oc1, oc2 = st.columns(2)
                with oc1:
                    st.markdown("**📝 AI Summary**")
                    st.info(c.get("summary","No summary available."))

                    st.markdown("**✅ Key Strengths**")
                    for s in c.get("strengths",[])[:5]:
                        st.markdown(f"✅ {s}")
                    if not c.get("strengths"):
                        st.caption("None identified")

                with oc2:
                    st.markdown("**📊 Score Breakdown**")
                    st.metric("JD Match",      f"{jd_s}/10")
                    st.metric("Profile Match", f"{ref_s}/10")
                    st.metric("Final Score",   f"{final_s}/20")

                    st.markdown("**❌ Missing Skills**")
                    for m in c.get("missing_skills",[])[:5]:
                        st.markdown(f"❌ {m}")
                    if not c.get("missing_skills"):
                        st.caption("No major gaps")

                st.markdown("**🎯 Final Recommendation**")
                rec = c.get("final_recommendation_reason","")
                if dec == "Accept":       st.success(rec)
                elif dec == "Human Review": st.warning(rec)
                else:                      st.error(rec)

            # TAB 2 — JD Analysis
            with t2:
                st.markdown(f"**JD Match Score: {jd_s}/10**")
                st.progress(int(jd_s * 10))
                jc1, jc2 = st.columns(2)
                with jc1:
                    st.markdown("**✅ Strengths vs JD**")
                    for s in c.get("jd_strengths",[]):
                        st.markdown(f"• {s}")
                    st.markdown("**❌ Missing Skills**")
                    for m in c.get("jd_missing_skills",[]):
                        st.markdown(f"• {m}")
                with jc2:
                    st.markdown("**⚠️ Weaknesses vs JD**")
                    for w in c.get("jd_weaknesses",[]):
                        st.markdown(f"• {w}")
                    st.markdown("**📌 Match Reasons**")
                    for r in c.get("jd_reasons",[]):
                        st.markdown(f"• {r}")
                st.markdown("**📖 JD Match Explanation**")
                st.write(c.get("jd_explanation",""))

            # TAB 3 — Profile Analysis
            with t3:
                st.markdown(f"**Profile Match Score: {ref_s}/10**")
                st.progress(int(ref_s * 10))
                rc1, rc2 = st.columns(2)
                with rc1:
                    st.markdown("**✅ Strengths vs Profile**")
                    for s in c.get("reference_strengths",[]):
                        st.markdown(f"• {s}")
                    st.markdown("**📌 Match Reasons**")
                    for r in c.get("reference_reasons",[]):
                        st.markdown(f"• {r}")
                with rc2:
                    st.markdown("**⚠️ Weaknesses vs Profile**")
                    for w in c.get("reference_weaknesses",[]):
                        st.markdown(f"• {w}")
                st.markdown("**📖 Profile Match Explanation**")
                st.write(c.get("reference_explanation",""))

            # TAB 4 — Email
            with t4:
                st.markdown("**📧 Generated Email**")
                st.info(f"Status: {c.get('email_status','Not Sent')}")
                if c.get("email_content"):
                    st.text_area(
                        "Email content (mock — not actually sent)",
                        value=c.get("email_content",""),
                        height=280,
                        key=f"email_{idx}",
                    )
                else:
                    st.caption("No email generated.")

        st.markdown("---")

    # ── Export ────────────────────────────────────────────
    st.divider()
    st.subheader("📥 Export")
    ec1, ec2 = st.columns(2)
    with ec1:
        st.download_button(
            "⬇️ Download CSV",
            data=to_csv(filtered),
            file_name=f"hirecheck_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv",
            use_container_width=True,
        )
    with ec2:
        st.caption(f"Exporting {len(filtered)} candidate(s) with full analysis")

elif not st.session_state.processed:
    st.markdown("""
    <div style='text-align:center;padding:80px 20px;color:#9ca3af'>
        <div style='font-size:72px'>📄</div>
        <h3 style='color:#6b7280'>Ready to Screen Resumes</h3>
        <p style='font-size:16px'>1. Paste a <b>Job Description</b> in the sidebar</p>
        <p style='font-size:16px'>2. Describe your <b>Ideal Candidate</b> in the sidebar</p>
        <p style='font-size:16px'>3. Upload <b>PDF or image resumes</b> above</p>
        <p style='font-size:16px'>4. Click <b>▶ Process Resumes</b></p>
    </div>
    """, unsafe_allow_html=True)