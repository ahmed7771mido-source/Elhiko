"""
PERFUIM - models/user.py
User model: CRUD operations + password hashing.
"""

import hashlib
import secrets
from typing import Optional
from backend.database.database import get_connection


def _hash(password: str, salt: str) -> str:
    return hashlib.sha256((password + salt).encode()).hexdigest()


def _row_to_dict(row) -> Optional[dict]:
    return dict(row) if row else None


# ── Read ────────────────────────────────────────────────────────────────────────

def get_all(limit: int = 100, offset: int = 0) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id,first_name,last_name,email,phone,role,status,newsletter,created_at "
            "FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset)
        ).fetchall()
    return [dict(r) for r in rows]


def get_by_id(user_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id,first_name,last_name,email,phone,role,status,newsletter,created_at "
            "FROM users WHERE id = ?", (user_id,)
        ).fetchone()
    return _row_to_dict(row)


def get_by_email(email: str) -> Optional[dict]:
    """Returns full row including password_hash and salt (for auth)."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)
        ).fetchone()
    return _row_to_dict(row)


def count() -> int:
    with get_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]


# ── Create ──────────────────────────────────────────────────────────────────────

def create(first_name: str, last_name: str, email: str,
           password: str, phone: str = '', newsletter: bool = True) -> dict:
    salt  = secrets.token_hex(16)
    phash = _hash(password, salt)
    with get_connection() as conn:
        cur = conn.execute(
            """INSERT INTO users (first_name, last_name, email, phone,
               password_hash, salt, newsletter)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (first_name, last_name, email, phone, phash, salt, int(newsletter))
        )
        conn.commit()
        return get_by_id(cur.lastrowid)


# ── Update ──────────────────────────────────────────────────────────────────────

def update(user_id: int, **kwargs) -> Optional[dict]:
    allowed = {'first_name', 'last_name', 'phone', 'role', 'status', 'newsletter'}
    fields  = {k: v for k, v in kwargs.items() if k in allowed}
    if not fields:
        return get_by_id(user_id)

    set_clause = ', '.join(f"{k} = ?" for k in fields)
    values     = list(fields.values()) + [user_id]
    with get_connection() as conn:
        conn.execute(
            f"UPDATE users SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
            values
        )
        conn.commit()
    return get_by_id(user_id)


def change_password(user_id: int, new_password: str) -> bool:
    salt  = secrets.token_hex(16)
    phash = _hash(new_password, salt)
    with get_connection() as conn:
        conn.execute(
            "UPDATE users SET password_hash=?, salt=?, updated_at=datetime('now') WHERE id=?",
            (phash, salt, user_id)
        )
        conn.commit()
    return True


# ── Auth ────────────────────────────────────────────────────────────────────────

def verify_password(email: str, password: str) -> Optional[dict]:
    """Returns public user dict if credentials are valid, else None."""
    user = get_by_email(email)
    if not user:
        return None
    if _hash(password, user['salt']) != user['password_hash']:
        return None
    # Return without sensitive fields
    return {k: user[k] for k in ('id','first_name','last_name','email','phone','role','status')}


# ── Delete ──────────────────────────────────────────────────────────────────────

def delete(user_id: int) -> bool:
    with get_connection() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        conn.commit()
    return True
