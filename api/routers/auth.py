import logging
import os
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, decode
from jwt.exceptions import PyJWTError

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer()


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    """
    Singleton JWKS client. lru_cache is thread-safe in CPython.
    The client caches the fetched public keys internally and handles
    rotation automatically — fetching fresh keys only on a cache miss.
    """
    return PyJWKClient(os.environ["CLERK_JWKS_URL"])


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    token = credentials.credentials
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token)
        payload = decode(token, signing_key.key, algorithms=["RS256"])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token payload missing 'sub' claim.",
            )
        return sub
    except PyJWTError as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token."
        )
    except HTTPException:
        raise
    except Exception as exc:
        # Covers JWKS fetch failures, network timeouts, etc.
        logger.error("Auth service error (JWKS fetch or decode): %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable.",
        )
