from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, Field, field_validator
from sqlmodel import select
from database import get_session
from models import User
from passlib.hash import pbkdf2_sha256
from jose import jwt, JWTError
import os

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv('SECRET_KEY')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 15


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if '@' not in normalized or normalized.startswith('@') or normalized.endswith('@'):
            raise ValueError('Invalid email address')
        return normalized


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=128)

    @field_validator('email')
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if '@' not in normalized or normalized.startswith('@') or normalized.endswith('@'):
            raise ValueError('Invalid email address')
        return normalized


def signing_key() -> str:
    if not SECRET_KEY:
        raise RuntimeError('SECRET_KEY is not configured')
    return SECRET_KEY


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    # simple exp claim
    import time

    to_encode.update({"exp": int(time.time()) + ACCESS_TOKEN_EXPIRE_SECONDS})
    return jwt.encode(to_encode, signing_key(), algorithm=ALGORITHM)


@router.post('/register')
def register(req: RegisterRequest, session=Depends(get_session)):
    # check existing
    statement = select(User).where(User.email == req.email)
    existing = list(session.exec(statement))
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')

    hashed = pbkdf2_sha256.hash(req.password)
    user = User(name=req.name, email=req.email, password_hash=hashed, target_wake_time='07:00', target_bed_time='23:30')
    session.add(user)
    session.commit()
    session.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return {"user": {"id": user.id, "name": user.name, "email": user.email}, "accessToken": token}


@router.post('/login')
def login(req: LoginRequest, session=Depends(get_session)):
    statement = select(User).where(User.email == req.email)
    user = session.exec(statement).first()
    if not user or not user.password_hash or not pbkdf2_sha256.verify(req.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials')

    token = create_access_token({"sub": str(user.id)})
    return {"accessToken": token, "user": {"id": user.id, "name": user.name, "email": user.email}}


@router.get('/me')
def me(request: Request, session=Depends(get_session)):
    auth = request.headers.get('authorization') or request.headers.get('Authorization')
    if not auth or not auth.lower().startswith('bearer '):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing credentials')
    token = auth.split(' ', 1)[1]
    try:
        payload = jwt.decode(token, signing_key(), algorithms=[ALGORITHM])
        user_id = int(payload.get('sub'))
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token')
    statement = select(User).where(User.id == user_id)
    user = session.exec(statement).first()
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return {"id": user.id, "name": user.name, "email": user.email}
