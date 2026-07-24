import tiktoken

_ENCODING = tiktoken.get_encoding("cl100k_base")


def faq_chunks(qa_pairs: list[dict]) -> list[str]:
    """One chunk per Q&A pair -- each is already a self-contained retrieval unit,
    so a generic token-window split would only fragment a good answer."""
    return [f"Q: {pair['question']}\nA: {pair['answer']}" for pair in qa_pairs]


def token_window_chunks(text: str, max_tokens: int = 450, overlap: int = 50) -> list[str]:
    """Generic chunker for unstructured prose (crawled pages, brochures)."""
    tokens = _ENCODING.encode(text)
    if not tokens:
        return []

    chunks = []
    start = 0
    step = max_tokens - overlap
    while start < len(tokens):
        window = tokens[start : start + max_tokens]
        chunks.append(_ENCODING.decode(window))
        if start + max_tokens >= len(tokens):
            break
        start += step
    return chunks


def count_tokens(text: str) -> int:
    return len(_ENCODING.encode(text))
