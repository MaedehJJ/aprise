import logging
import os
from functools import lru_cache

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, decode
from jwt.exceptions import DecodeError, ExpiredSignatureError, PyJWKClientConnectionError, PyJWKClientError, PyJWTError

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer()


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    """
    Singleton JWKS client. lru_cache is thread-safe in CPython.
    The client caches the fetched public keys internally and handles
    rotation automatically — fetching fresh keys only on a cache miss.

    lifespan=3600 keeps the JWKS response cached for 1 hour before
    Clerk is re-queried, avoiding a network round-trip on every warm
    process invocation.
    """
    return PyJWKClient(os.environ["CLERK_JWKS_URL"], lifespan=3600)


def prewarm_jwks() -> None:
    """Eagerly fetch the JWKS so the first auth request doesn't pay the RTT."""
    try:
        _jwks_client().fetch_data()
        logger.info("JWKS pre-warmed successfully")
    except Exception as exc:
        logger.warning("JWKS pre-warm failed (non-fatal): %s", exc)


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
    except PyJWKClientConnectionError as exc:
        # Network/DNS failure reaching Clerk's JWKS endpoint — not the caller's fault.
        logger.error("JWKS fetch failed (Clerk unreachable): %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable.",
        )
    except PyJWKClientError as exc:
        # Key-ID not found in JWKS (e.g. stale cache after key rotation).
        logger.warning("JWKS key lookup failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable.",
        )
    except (ExpiredSignatureError, DecodeError) as exc:
        logger.warning("JWT validation failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token."
        )
    except PyJWTError as exc:
        logger.warning("JWT error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token."
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected auth error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is temporarily unavailable.",
        )
