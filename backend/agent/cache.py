import hashlib
import json
import os
import re
import threading
from copy import deepcopy
from typing import Optional

from cachetools import TTLCache

CACHE_ENABLED = os.environ.get("LLM_CACHE_ENABLED", "true").lower() == "true"
CACHE_TTL_SECONDS = int(os.environ.get("LLM_CACHE_TTL", "3600"))   # 1 ghanta
CACHE_MAX_ITEMS = int(os.environ.get("LLM_CACHE_MAX", "500"))


_cache: TTLCache = TTLCache(maxsize=CACHE_MAX_ITEMS, ttl=CACHE_TTL_SECONDS)

_lock = threading.Lock()

_stats = {"hits": 0, "misses": 0}


def _normalize_query(query: str) -> str:
    return re.sub(r"\s+", " ", query or "").strip()


def make_key(
    user_id: str,
    query: str,
    connected: list[str],
    current_date: str,
    model_name: str,
    system_prompt: str,
) -> str:
    """
    Ek fixed-length hash banata hai. Inme se kuch bhi badla to key badal jayegi
    aur purana answer use nahi hoga.
    """
    payload = {
        "user_id": user_id,                
        "query": _normalize_query(query),
        "connected": sorted(connected),     
        "date": current_date,              
        "model": model_name,
        "prompt": hashlib.sha256(system_prompt.encode()).hexdigest(), 
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode()).hexdigest()


def get_cached(key: str) -> Optional[dict]:
    if not CACHE_ENABLED:
        return None
    with _lock:
        value = _cache.get(key)
        if value is None:
            _stats["misses"] += 1
            return None
        _stats["hits"] += 1

        return deepcopy(value)


def set_cached(key: str, value: dict) -> None:
    if not CACHE_ENABLED:
        return
    with _lock:
        _cache[key] = deepcopy(value)


def cache_stats() -> dict:
    with _lock:
        return {**_stats, "size": len(_cache)}


def clear_cache() -> None:
    with _lock:
        _cache.clear()