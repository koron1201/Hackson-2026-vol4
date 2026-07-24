from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_db_and_tables

import tasks_routes
import game_routes
import ai_routes
import qr_routes

app = FastAPI(title="MorningQuest API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# ルーター登録
app.include_router(tasks_routes.router)
app.include_router(game_routes.router)
app.include_router(ai_routes.router)
app.include_router(qr_routes.router)

@app.get("/")
def root():
    return {"message": "MorningQuest API is running!"}