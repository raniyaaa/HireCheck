# ============================================================
# streamlit_app.py
# ============================================================
# The HireCheck recruiter UI.
#   1. User sees login/signup page first
#   2. On successful login → JWT token stored in session_state
#   3. All API calls now include: Authorization: Bearer <token>
#   4. If token expires/invalid → user is logged out automatically
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
# st.write("BACKEND_URL =", BACKEND_URL)

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
.metric-num { font-size:32px; font-weight:800; color:black; }
.metric-lbl { font-size:13px; color:#6b7280; margin-top:4px; }

#MainMenu { visibility:hidden; }
footer    { visibility:hidden; }
</style>
""", unsafe_allow_html=True)

# ─────────────────────────────────────────────────────────
# AUTH HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────

def auth_headers() -> dict:
    """
    Returns the Authorization header using the stored JWT token.
    Attached to every protected API call.
    """
    token = st.session_state.get("token", "")
    return {"Authorization": f"Bearer {token}"}

def login_request(username: str, password: str) -> dict | None:
    """Calls /auth/login. Returns response dict or None on failure."""
    try:
        r = httpx.post(
            f"{BACKEND_URL}/auth/login",
            json={"username": username, "password": password},
            timeout=10,
        )
        if r.status_code == 200:
            return r.json()
        else:
            st.session_state["auth_error"] = r.json().get("detail", "Login failed")
            return None
    except Exception as e:
        st.session_state["auth_error"] = f"Connection error: {e}"
        return None


def signup_request(username: str, password: str, role: str) -> dict | None:
    """Calls /auth/signup. Returns response dict or None on failure."""
    try:
        r = httpx.post(
            f"{BACKEND_URL}/auth/signup",
            json={"username": username, "password": password, "role": role},
            timeout=10,
        )
        if r.status_code == 200:
            return r.json()
        else:
            st.session_state["auth_error"] = r.json().get("detail", "Signup failed")
            return None
    except Exception as e:
        st.session_state["auth_error"] = f"Connection error: {e}"
        return None

def is_logged_in() -> bool:
    """Checks if a token exists in session state."""
    return bool(st.session_state.get("token"))

def logout():
    """Clears all auth data from session state."""
    for key in ["token", "username", "role"]:
        st.session_state.pop(key, None)


def check_backend() -> bool:
    try:
        r = httpx.get(f"{BACKEND_URL}/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False
    
# ─────────────────────────────────────────────────────────
# SESSION STATE DEFAULTS
# ─────────────────────────────────────────────────────────
if "session_id" not in st.session_state:
    st.session_state.session_id = str(uuid.uuid4())[:8]
if "results"    not in st.session_state:
    st.session_state.results    = []
if "processed"  not in st.session_state:
    st.session_state.processed  = False
if "auth_error" not in st.session_state:
    st.session_state.auth_error = ""

# ═══════════════════════════════════════════════════════════
# LOGIN / SIGNUP PAGE
# Shown ONLY if user is not logged in.
# Everything below this block is the actual app (after login).
# ═══════════════════════════════════════════════════════════
if not is_logged_in():
    st.markdown("<br><br>", unsafe_allow_html=True)
    col1, col2, col3 = st.columns([1, 1.2, 1])

    with col2:
        st.markdown("## 🔍 HireCheck ATS")
        st.caption("AI-Powered Resume Screening Platform")

        if not check_backend():
            st.error("❌ Backend not reachable. Start it with:\n\n`uvicorn backend.main:app --reload --port 8000`")
            st.stop()

        tab_login, tab_signup = st.tabs(["Login", "Sign Up"])

        # ── LOGIN TAB ──────────────────────────────────────
        with tab_login:
            with st.form("login_form"):
                login_user = st.text_input("Username", key="login_username")
                login_pass = st.text_input("Password", type="password", key="login_password")
                submitted  = st.form_submit_button("Log In", use_container_width=True, type="primary")

                if submitted:
                    if not login_user or not login_pass:
                        st.warning("Please enter both username and password")
                    else:
                        result = login_request(login_user, login_pass)
                        if result:
                            st.session_state["token"]    = result["access_token"]
                            st.session_state["username"] = result["username"]
                            st.session_state["role"]      = result["role"]
                            st.success(f"Welcome back, {result['username']}!")
                            st.rerun()

            if st.session_state.auth_error:
                st.error(st.session_state.auth_error)
                st.session_state.auth_error = ""

        # ── SIGNUP TAB ─────────────────────────────────────
        with tab_signup:
            with st.form("signup_form"):
                signup_user = st.text_input("Choose a username", key="signup_username")
                signup_pass = st.text_input(
                    "Choose a password", type="password", key="signup_password",
                    help="Minimum 6 characters",
                )
                signup_role = st.selectbox("Account type", ["recruiter", "admin"], key="signup_role")
                submitted2  = st.form_submit_button("Create Account", use_container_width=True, type="primary")

                if submitted2:
                    if not signup_user or not signup_pass:
                        st.warning("Please fill in all fields")
                    elif len(signup_pass) < 6:
                        st.warning("Password must be at least 6 characters")
                    else:
                        result = signup_request(signup_user, signup_pass, signup_role)
                        if result:
                            st.session_state["token"]    = result["access_token"]
                            st.session_state["username"] = result["username"]
                            st.session_state["role"]      = result["role"]
                            st.success(f"Account created! Welcome, {result['username']}!")
                            st.rerun()

            if st.session_state.auth_error:
                st.error(st.session_state.auth_error)
                st.session_state.auth_error = ""

    st.stop()   # 🛑 Stops execution here — nothing below runs until logged in

# ─────────────────────────────────────────────────────────
# HELPERS(only reachable after login)
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

# ─────────────────────────────────────────────────────────
# ADMIN API HELPERS
# ─────────────────────────────────────────────────────────

def admin_get(endpoint: str) -> dict | None:
    """Generic GET request to an admin endpoint, with auth header attached."""
    try:
        r = httpx.get(f"{BACKEND_URL}{endpoint}", headers=auth_headers(), timeout=15)
        if r.status_code == 200:
            return r.json()
        elif r.status_code == 403:
            st.error("🚫 Admin access required")
            return None
        else:
            st.error(f"Error: {r.text}")
            return None
    except Exception as e:
        st.error(f"Connection error: {e}")
        return None

def admin_toggle_user_active(username: str, activate: bool) -> bool:
    """Enables/disables a user account."""
    try:
        r = httpx.post(
            f"{BACKEND_URL}/admin/users/{username}/toggle-active",
            params={"activate": activate},
            headers=auth_headers(),
            timeout=10,
        )
        if r.status_code == 200:
            return True
        else:
            st.error(r.json().get("detail", "Failed to update user"))
            return False
    except Exception as e:
        st.error(f"Connection error: {e}")
        return False
    
def admin_delete_session_request(session_id: str) -> bool:
    """Deletes a session as admin."""
    try:
        r = httpx.delete(f"{BACKEND_URL}/admin/session/{session_id}", headers=auth_headers(), timeout=10)
        return r.status_code == 200
    except Exception as e:
        st.error(f"Connection error: {e}")
        return False


# def check_backend() -> bool:
#     """Returns True if FastAPI backend is reachable."""
#     try:
#         r = httpx.get(f"{BACKEND_URL}/health", timeout=3)
#         return r.status_code == 200
#     except Exception:
#         return False


# # ─────────────────────────────────────────────────────────
# # SESSION STATE
# # ─────────────────────────────────────────────────────────
# if "session_id" not in st.session_state:
#     st.session_state.session_id = str(uuid.uuid4())[:8]
# if "results"    not in st.session_state:
#     st.session_state.results    = []
# if "processed"  not in st.session_state:
#     st.session_state.processed  = False


# ─────────────────────────────────────────────────────────
# SIDEBAR
# ─────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## 🔍 HireCheck ATS")

    # ── User info + logout ──────────────────────────────
    st.success(f"👤 **{st.session_state.username}** ({st.session_state.role})")
    if st.button(" Logout ", use_container_width=True):
        logout()
        st.rerun()

    st.divider()

    if check_backend():
        st.success("✅ Backend connected")
    else:
        st.error("❌ Backend offline")

    st.divider()

    st.subheader("📋 Job Description")
    jd_input = st.text_area("Paste the full Job Description", height=180, key="jd")

    st.divider()

    st.subheader("🎯 Ideal Candidate Profile")
    ref_input = st.text_area("Describe your ideal candidate", height=150, key="ref")

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

    status.info(" Sending resumes to backend...")
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


        response = httpx.post(
            f"{BACKEND_URL}/process",
            files=files_payload,
            data=data_payload,
            headers=auth_headers(),
            timeout=300,
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
        elif response.status_code == 401:
            status.error("🔒 Session expired. Please log in again.")
            logout()
            st.rerun()
        else:
            status.error(f"❌ Backend error: {response.text}")

    except httpx.TimeoutException:
        status.error(" Request timed out. Try fewer resumes or check backend.")
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
        search = st.text_input(" Search by name", placeholder="Type to search...")
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
                ["📋 Overview", " JD Analysis", " Profile Analysis", "📧 Email"]
            )

            # TAB 1 — Overview
            with t1:
                oc1, oc2 = st.columns(2)
                with oc1:
                    st.markdown("**AI Summary**")
                    st.info(c.get("summary","No summary available."))

                    st.markdown("**Key Strengths**")
                    for s in c.get("strengths",[])[:5]:
                        st.markdown(f"✅ {s}")
                    if not c.get("strengths"):
                        st.caption("None identified")

                with oc2:
                    st.markdown("**📊 Score Breakdown**")
                    st.metric("JD Match",      f"{jd_s}/10")
                    st.metric("Profile Match", f"{ref_s}/10")
                    st.metric("Final Score",   f"{final_s}/20")

                    st.markdown("**Missing Skills**")
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
    st.subheader(" Export")
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
# ═══════════════════════════════════════════════════════════
# ADMIN PANEL — only visible to admin role
# ═══════════════════════════════════════════════════════════
if st.session_state.role == "admin":
    st.divider()
    st.header(" Admin Panel")

    admin_tab1, admin_tab2, admin_tab3 = st.tabs(
        ["📊 System Overview", " All Sessions", "👥 Manage Users"]
    )

    # ── TAB 1: SYSTEM OVERVIEW ────────────────────────────
    with admin_tab1:
        stats = admin_get("/admin/stats")

        if stats:
            s1, s2, s3, s4 = st.columns(4)
            with s1:
                st.markdown(f'<div class="metric-box"><div class="metric-num">{stats["total_candidates"]}</div><div class="metric-lbl"> Total Candidates</div></div>', unsafe_allow_html=True)
            with s2:
                st.markdown(f'<div class="metric-box"><div class="metric-num">{stats["total_sessions"]}</div><div class="metric-lbl"> Total Sessions</div></div>', unsafe_allow_html=True)
            with s3:
                st.markdown(f'<div class="metric-box"><div class="metric-num">{stats["total_users"]}</div><div class="metric-lbl"> Total Users</div></div>', unsafe_allow_html=True)
            with s4:
                st.markdown(f'<div class="metric-box"><div class="metric-num">{stats["avg_final_score"]}</div><div class="metric-lbl"> Avg Final Score</div></div>', unsafe_allow_html=True)

            st.write("")
            st.subheader("Decision Breakdown (All Time)")

            breakdown = stats.get("decision_breakdown", {})
            if breakdown:
                bc1, bc2, bc3 = st.columns(3)
                with bc1:
                    st.metric("✅ Accept", breakdown.get("Accept", 0))
                with bc2:
                    st.metric("🔍 Human Review", breakdown.get("Human Review", 0))
                with bc3:
                    st.metric("❌ Reject", breakdown.get("Reject", 0))
            else:
                st.caption("No candidates processed yet.")

            st.write("")
            st.caption(f"👤 Active users: {stats['active_users']} / {stats['total_users']}")

    # ── TAB 2: ALL SESSIONS ────────────────────────────────
    with admin_tab2:
        st.caption("View and manage every resume-screening session across all recruiters.")

        sessions_data = admin_get("/admin/sessions")

        if sessions_data and sessions_data.get("sessions"):
            sessions = sessions_data["sessions"]

            sh1, sh2, sh3, sh4, sh5, sh6 = st.columns([2, 1, 1, 1, 1, 1.5])
            sh1.markdown("**Session ID**")
            sh2.markdown("**Candidates**")
            sh3.markdown("**Accept**")
            sh4.markdown("**Review**")
            sh5.markdown("**Reject**")
            sh6.markdown("**Action**")
            st.markdown("---")

            for sess in sessions:
                sc1, sc2, sc3, sc4, sc5, sc6 = st.columns([2, 1, 1, 1, 1, 1.5])
                sc1.markdown(f"`{sess['session_id']}`")
                sc2.markdown(str(sess["candidate_count"]))
                sc3.markdown(f"🟢 {sess['accepted']}")
                sc4.markdown(f"🟡 {sess['review']}")
                sc5.markdown(f"🔴 {sess['rejected']}")

                if sc6.button("🗑️ Delete", key=f"del_{sess['session_id']}"):
                    if admin_delete_session_request(sess["session_id"]):
                        st.success(f"Deleted session {sess['session_id']}")
                        st.rerun()

                st.caption(f"Started: {sess['started_at']}  |  Last updated: {sess['last_updated']}")
                st.markdown("---")
        else:
            st.info("No sessions found yet.")

    # ── TAB 3: MANAGE USERS ────────────────────────────────
    with admin_tab3:
        st.caption("View all registered users. Enable/disable accounts as needed.")

        users_data = admin_get("/admin/users")

        if users_data and users_data.get("users"):
            users = users_data["users"]

            uh1, uh2, uh3, uh4, uh5 = st.columns([2, 1.5, 1, 1.5, 1.5])
            uh1.markdown("**Username**")
            uh2.markdown("**Role**")
            uh3.markdown("**Status**")
            uh4.markdown("**Joined**")
            uh5.markdown("**Action**")
            st.markdown("---")

            for u in users:
                uc1, uc2, uc3, uc4, uc5 = st.columns([2, 1.5, 1, 1.5, 1.5])

                is_self = u["username"] == st.session_state.username

                uc1.markdown(f"**{u['username']}**" + (" *(you)*" if is_self else ""))
                uc2.markdown("🛠️ Admin" if u["role"] == "admin" else "👤 Recruiter")

                if u["is_active"]:
                    uc3.markdown("🟢 Active")
                else:
                    uc3.markdown("🔴 Disabled")

                uc4.caption(u["created_at"][:10])  # just the date part

                if is_self:
                    uc5.caption("—")
                else:
                    if u["is_active"]:
                        if uc5.button("🚫 Disable", key=f"disable_{u['username']}"):
                            if admin_toggle_user_active(u["username"], activate=False):
                                st.success(f"Disabled {u['username']}")
                                st.rerun()
                    else:
                        if uc5.button("✅ Enable", key=f"enable_{u['username']}"):
                            if admin_toggle_user_active(u["username"], activate=True):
                                st.success(f"Enabled {u['username']}")
                                st.rerun()

                st.markdown("---")
        else:
            st.info("No users found.")

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

