# app/graph.py

# THE LANGGRAPH PIPELINE — Heart of HireCheck
#
# This file builds the full evaluation pipeline using LangGraph.
#
# LangGraph concepts used here:
#
#   StateGraph     → creates a graph that uses CandidateState
#   set_entry_point() → which node runs first
#   compile()      → validates and prepares the graph to run
#   graph.invoke() → runs the full pipeline with an input state
#
# Pipeline flow:
#   START
#     ↓
#   parser_node          ← extracts resume text
#     ↓ (if error → END)
#   jd_matcher_node      ← scores vs Job Description
#     ↓
#   reference_matcher_node ← scores vs Ideal Profile
#     ↓
#   summarizer_node      ← generates summary
#     ↓
#   decision_node        ← Accept / Review / Reject
#     ↓
#   comms_node           ← generates email
#     ↓
#   END


from langgraph.graph import StateGraph, END

from app.state            import CandidateState
from agents.parser_agent      import parser_node
from agents.jd_matcher        import jd_matcher_node
from agents.reference_matcher import reference_matcher_node
from agents.summarizer_agent        import summarizer_node
from agents.comms_agent       import comms_node
from decision.decision        import decision_node


def _route_after_parser(state: CandidateState) -> str:
    """
    Conditional routing function called after parser_node.

    If the parser set an error (bad file, unsupported format)
    → return "end"  (skip all agents, go straight to END)

    If the parser succeeded
    → return "jd_matcher"  (continue normally)
    """
    if state.get("error"):
        return "end"
    return "jd_matcher"


def build_graph():
    """
    Builds and compiles the LangGraph pipeline.

    Returns a compiled graph. Call it like:
        graph = build_graph()
        result = graph.invoke({
            "resume_path": "...",
            "job_description": "...",
            "ideal_candidate_reference": "...",
        })
    """

    # ── Create the graph ──────────────────────────────────────
    # StateGraph(CandidateState) tells LangGraph:
    # "the data flowing between nodes is a CandidateState dict"
    workflow = StateGraph(CandidateState)

    # ── Register all nodes ────────────────────────────────────
    # add_node("name", function)
    # "name" is used when connecting edges
    workflow.add_node("parser",            parser_node)
    workflow.add_node("jd_matcher",        jd_matcher_node)
    workflow.add_node("reference_matcher", reference_matcher_node)
    workflow.add_node("summarizer",        summarizer_node)
    workflow.add_node("decision_agent",    decision_node)
    workflow.add_node("comms",             comms_node)

    # ── Set the starting node ─────────────────────────────────
    workflow.set_entry_point("parser")

    # ── Conditional edge after parser ─────────────────────────
    # After parser runs, call _route_after_parser(state)
    # If it returns "jd_matcher" → go to jd_matcher node
    # If it returns "end"        → go to END (skip everything)
    workflow.add_conditional_edges(
        "parser",            # from this node
        _route_after_parser, # call this function to decide
        {
            "jd_matcher": "jd_matcher",  # key → next node
            "end":        END,           # key → END
        }
    )

    # ── Regular edges ─────────────────────────────────────────
    # These always go in this direction, no conditions
    workflow.add_edge("jd_matcher",        "reference_matcher")
    workflow.add_edge("reference_matcher", "summarizer")
    workflow.add_edge("summarizer",        "decision_agent")
    workflow.add_edge("decision_agent",     "comms")
    workflow.add_edge("comms",             END)

    # ── Compile and return ────────────────────────────────────
    # compile() checks the graph is valid and prepares it
    return workflow.compile()


# Build once at module load — reused for every resume in batch
_graph = None

def get_graph():
    """Returns the compiled graph, building it only once."""
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph