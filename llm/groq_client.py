# ============================================================
# llm/groq_client.py
# ============================================================
# PURPOSE:
#   Single connection point to the Groq AI API.
#   All agents call get_groq_response() from here.
#   If you ever switch AI providers, you only change THIS file.
# ============================================================

import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()


def get_groq_response(system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
    """
    Sends a prompt to Groq AI and returns the text response.

    Args:
        system_prompt : Tells the AI what role to play.
                        e.g. "You are an expert resume evaluator."
        user_prompt   : The actual task for the AI.
                        e.g. "Evaluate this resume against this JD."
        temperature   : 0.0 = very focused, 1.0 = more creative.
                        We use 0.2-0.4 for consistent scoring.

    Returns:
        str: The AI's response text.
    """
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    model  = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    response = client.chat.completions.create(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        model=model,
        temperature=temperature,
        max_tokens=2048,
    )

    return response.choices[0].message.content.strip()