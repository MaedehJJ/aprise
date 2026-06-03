import os

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, decode
from jwt.exceptions import PyJWTError

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    try:
        token = credentials.credentials
        jwks_client = PyJWKClient(os.environ["CLERK_JWKS_URL"])
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = decode(token, signing_key.key, algorithms=["RS256"])
        return payload["sub"]
    except PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
