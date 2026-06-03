import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

if os.getenv("VERCEL") is None:
    load_dotenv(Path(__file__).parent.parent / ".env.local")

from fastapi import FastAPI, Depends
from routers.auth import get_current_user

app = FastAPI()


@app.get("/api/health")
def read_root():
    return {"status": "ok"}


@app.get("/api/me")
async def me(user_id: str = Depends(get_current_user)):
    return {"user_id": user_id}
