import re
from pathlib import Path

POLICY_FILE = Path(__file__).resolve().parent.parent.parent / "policies" / "return_policy.md"

# Authoritative return window rules (days from delivery; 0 means non-returnable)
CATEGORY_RETURN_WINDOWS: dict[str, int] = {
    "electronics": 10,
    "footwear": 14,
    "apparel": 15,
    "home & kitchen": 10,
    "grocery": 0,
}


def get_category_return_window(category: str) -> int:
    """Return allowed return window in days for an item category."""
    normalized = (category or "").strip().lower()
    for key, days in CATEGORY_RETURN_WINDOWS.items():
        if key in normalized or normalized in key:
            return days
    return 10  # sensible default window for unlisted general items


def _load_policy_sections() -> list[dict]:
    if not POLICY_FILE.exists():
        return []
    text = POLICY_FILE.read_text(encoding="utf-8")
    raw_sections = re.split(r"\n(?=##\s+)", text)
    sections = []
    for raw in raw_sections:
        lines = raw.strip().splitlines()
        if not lines:
            continue
        title = lines[0].lstrip("# ").strip()
        body = "\n".join(lines[1:]).strip()
        sections.append({"title": title, "content": body, "full_text": raw.strip()})
    return sections


def search_return_policy(query: str, top_k: int = 2) -> dict:
    """Retrieve matching return/refund policy sections via keyword scoring."""
    sections = _load_policy_sections()
    tokens = {tok for tok in re.findall(r"[a-z0-9]+", (query or "").lower()) if len(tok) > 2}

    scored = []
    for sec in sections:
        haystack = sec["full_text"].lower()
        score = sum(2 if tok in sec["title"].lower() else 1 for tok in tokens if tok in haystack)
        scored.append((score, sec))

    scored.sort(key=lambda item: item[0], reverse=True)
    matched = [sec for score, sec in scored[:top_k] if score > 0]
    if not matched and sections:
        matched = sections[:top_k]

    window_days = get_category_return_window(query)
    return {
        "query": query,
        "return_window_days": window_days,
        "returnable": window_days > 0,
        "auto_refund_limit_inr": 5000,
        "sections": [{"title": m["title"], "content": m["content"]} for m in matched],
    }
