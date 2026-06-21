"""
Shared rate-limiter instance used by all routers and by index.py.

Key function: Clerk user ID decoded from the JWT ``sub`` claim (no signature
re-verification — auth middleware already did the full check).  Falls back to
client IP when the token is absent or malformed so unauthenticated probes are
also rate-limited.
"""

import base64
import json

from fastapi import Request
from slowapi import Limiter


def _user_key(request: Request) -> str:
    try:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            payload_b64 = auth.split(".")[1]
            payload_b64 += "=" * (-len(payload_b64) % 4)
            payload = json.loads(base64.b64decode(payload_b64))
            sub = payload.get("sub")
            if sub:
                return sub
    except Exception:
        pass
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_user_key)
