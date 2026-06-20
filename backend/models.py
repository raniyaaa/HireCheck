# backend/models.py
# ============================================================
# PURPOSE:
#   Pydantic models define the EXACT shape of data that
#   flows in and out of our auth endpoints.
#
#   FastAPI uses these to:
#     - Automatically validate incoming requests
#     - Auto-generate API documentation (/docs page)
#     - Reject bad data with clear error messages
# ============================================================

from pydantic import BaseModel, Field

class UserSignup(BaseModel):
    """Data required to create a new account."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    role: str = Field(default="recruiter")  # "admin" or "recruiter"

class UserLogin(BaseModel):
    """Data required to log in."""
    username: str
    password: str

class TokenResponse(BaseModel):
    """What we send back after successful login."""
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str