import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

if os.getenv("VERCEL") is None:
    load_dotenv(Path(__file__).parent.parent / ".env.local")

from fastapi import FastAPI, Depends
from routers.auth import get_current_user
from routers.profile import router as profile_router
from routers.memory import router as memory_router

app = FastAPI()

app.include_router(profile_router)
app.include_router(memory_router)


@app.get("/api/health")
def read_root():
    return {"status": "ok"}


@app.get("/api/me")
async def me(user_id: str = Depends(get_current_user)):
    return {"user_id": user_id}
