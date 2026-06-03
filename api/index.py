from fastapi import FastAPI
from fastapi import Depends

from routers.auth import get_current_user

app = FastAPI()
from dotenv import load_dotenv

from dotenv import load_dotenv
from pathlib import Path
import os

if os.getenv("VERCEL") is None:
    load_dotenv(Path(__file__).parent.parent / ".env")


@app.get("/api/health")
def read_root():
    return {"status": "ok"}


@app.get("/api/me")
async def me(user_id: str = Depends(get_current_user)):
    return {"user_id": user_id}
