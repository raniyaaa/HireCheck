/** 8-character session id, like str(uuid.uuid4())[:8] in the Streamlit app. */
export function newSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().slice(0, 8)
  }
  // randomUUID needs a secure context (https or localhost); fall back elsewhere.
  return Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
}
