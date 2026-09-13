"""
Elhiko - models/user.py
User CRUD + password hashing using SQLite.
"""
import hashlib, secrets
from typing import Optional
from backend.database.database import get_connection


def _hash(pw: str, salt: str) -> str:
    return hashlib.sha256((pw+salt).encode()).hexdigest()


def get_all(limit=100, offset=0) -> list:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id,first_name,last_name,email,phone,role,status,newsletter,created_at "
            "FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?", (limit,offset)
        ).fetchall()
    return [dict(r) for r in rows]


def get_by_id(uid: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id,first_name,last_name,email,phone,role,status,newsletter,created_at "
            "FROM users WHERE id=?", (uid,)
        ).fetchone()
    return dict(row) if row else None


def get_by_email(email: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    return dict(row) if row else None


def count() -> int:
    with get_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def create(first_name, last_name, email, password, phone='', newsletter=True) -> dict:
    salt = secrets.token_hex(16)
    with get_connection() as conn:
        cur = conn.execute("""
            INSERT INTO users(first_name,last_name,email,phone,password_hash,salt,newsletter)
            VALUES(?,?,?,?,?,?,?)
        """, (first_name,last_name,email,phone,_hash(password,salt),salt,int(newsletter)))
        conn.commit()
    return get_by_id(cur.lastrowid)


def update(uid: int, **kwargs) -> Optional[dict]:
    allowed = {'first_name','last_name','phone','role','status','newsletter'}
    fields  = {k:v for k,v in kwargs.items() if k in allowed}
    if not fields: return get_by_id(uid)
    with get_connection() as conn:
        conn.execute(
            f"UPDATE users SET {', '.join(f'{k}=?' for k in fields)}, updated_at=datetime('now') WHERE id=?",
            list(fields.values())+[uid]
        )
        conn.commit()
    return get_by_id(uid)


def change_password(uid: int, new_pw: str) -> bool:
    salt = secrets.token_hex(16)
    with get_connection() as conn:
        conn.execute("UPDATE users SET password_hash=?,salt=?,updated_at=datetime('now') WHERE id=?",
                     (_hash(new_pw,salt),salt,uid))
        conn.commit()
    return True


def verify_password(email: str, password: str) -> Optional[dict]:
    user = get_by_email(email)
    if not user: return None
    if _hash(password, user['salt']) != user['password_hash']: return None
    return {k:user[k] for k in ('id','first_name','last_name','email','phone','role','status')}


def delete(uid: int) -> bool:
    with get_connection() as conn:
        conn.execute("DELETE FROM users WHERE id=?", (uid,))
        conn.commit()
    return True
