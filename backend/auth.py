#the JWT Engine
# backend/auth.py
# ============================================================
# PURPOSE:
#   The authentication engine for HireCheck.
#
#   Handles:
#     1. Password hashing & verification (using bcrypt)
#     2. JWT token creation (login gives you a token)
#     3. JWT token verification (every protected request checks this)
#
#   THINK OF IT LIKE THIS:
#     - hash_password()    → turns "mypassword" into gibberish for storage
#     - verify_password()  → checks if entered password matches the hash
#     - create_token()     → makes the "pass" you get after logging in
#     - decode_token()     → reads the pass to find out who you are
# ============================================================
''' how jwt is generated:
User logs in
      ↓
Backend verifies username/password
      ↓
Create Payload
      ↓
Create Header
      ↓
Generate Signature using:
(Header + Payload + SECRET_KEY)
      ↓
Combine:
Header.Payload.Signature
      ↓
JWT Token
      ↓
Send JWT to user  - and 
Every protected API call then includes:
Authorization: Bearer <jwt>
'''

import os
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# ── Settings (from .env) ───────────────────────────────────
SECRET_KEY  = os.getenv("SECRET_KEY", "fallback_secret_change_me")
ALGORITHM   = os.getenv("ALGORITHM", "HS256")
EXPIRE_MINS = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

# This object knows how to hash and verify using bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

#password functions
def hash_password(plain_password: str) -> str:
    """
    Converts a plain text password into a secure bcrypt hash.

    Example:
        hash_password("raniya123")
        → "$2b$12$Kx8Qm9vL3jH7n..."

    This hash is what gets SAVED to the database.
    The original password is never stored anywhere.
    """
    return pwd_context.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Checks if a plain password matches a stored hash.

    Used during LOGIN:
        User types: "raniya123"
        We compare it against the hash stored in the database.

    Returns True if they match, False otherwise.
    """
    return pwd_context.verify(plain_password, hashed_password)


#jwt token functions
def create_access_token(data: dict) -> str:
    to_encode = data.copy()

    # Set expiration time
    expire = datetime.utcnow() + timedelta(minutes=EXPIRE_MINS)
    to_encode.update({"exp": expire})

    # Sign and encode the token using our SECRET_KEY
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> dict | None:
    """
    Reads and verifies a JWT token.

    Returns the decoded data (e.g. {"sub": "raniya", "role": "admin"})
    if the token is valid and not expired.

    Returns None if the token is invalid, tampered with, or expired.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        # Token is invalid, expired, or tampered with
        return None
    
'''Nb:
verify_password()
    → Used during login to check credentials

decode_access_token()
    → Used on later API requests to verify the JWT and identify the user
'''

