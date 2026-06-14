from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from station_conditions import router as station_router

app = FastAPI(title="RailGuard AI Backend")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(station_router, prefix="/api")
