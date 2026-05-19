from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncio
from app.core.config import settings
from app.api.v1 import router
from app.db.init_db import init_db
from app.utils.scheduler import scheduler_loop

app = FastAPI(title=settings.APP_NAME)

if settings.STORAGE_MODE == "local":
    app.mount("/media", StaticFiles(directory="media"), name="media")
else:
    from app.api.v1.media import router as media_router
    app.include_router(media_router, prefix="/media", tags=["media"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()
    if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
        asyncio.create_task(scheduler_loop())


app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
