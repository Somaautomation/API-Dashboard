"""AI-powered API test generation module.

Produces positive / negative / boundary / edge-case test cases together with
auto-generated assertions, from an OpenAPI/Swagger endpoint definition.
Provider-agnostic: heuristic generators always run; LLM (if configured) is
layered on top to supply richer edge cases and natural-language failure
analysis.
"""
