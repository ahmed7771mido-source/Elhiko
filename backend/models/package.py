"""
PERFUIM - models/package.py
Package / subscription tier model.
"""

import json
from typing import Optional
from backend.database.database import get_connection


def _row(row) -> Optional[dict]:
    if not row:
        return None
    d = dict(row)
    if isinstance(d.get('features'), str):
        try:
            d['features'] = json.loads(d['features'])
        except (json.JSONDecodeError, TypeError):
            d['features'] = []
    return d


# ── Read ────────────────────────────────────────────────────────────────────────

def get_all(active_only: bool = False) -> list[dict]:
    where  = "WHERE status = 'active'" if active_only else ""
    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT * FROM packages {where} ORDER BY price ASC"
        ).fetchall()
    return [_row(r) for r in rows]


def get_by_id(package_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM packages WHERE id = ?", (package_id,)).fetchone()
    return _row(row)


def subscriber_count(package_id: int) -> int:
    with get_connection() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM subscriptions WHERE package_id=? AND status='active'",
            (package_id,)
        ).fetchone()[0]


# ── Create ──────────────────────────────────────────────────────────────────────

def create(data: dict) -> dict:
    features = json.dumps(data.get('features') or [], ensure_ascii=False)
    with get_connection() as conn:
        cur = conn.execute("""
            INSERT INTO packages
              (name, price, count, size, discount, description, features, featured, status)
            VALUES (?,?,?,?,?,?,?,?,?)
        """, (
            data['name'],
            float(data['price']),
            int(data.get('count', 2)),
            data.get('size', '50ml'),
            float(data.get('discount', 0)),
            data.get('description', ''),
            features,
            int(data.get('featured', 0)),
            data.get('status', 'active'),
        ))
        conn.commit()
        return get_by_id(cur.lastrowid)


# ── Update ──────────────────────────────────────────────────────────────────────

def update(package_id: int, data: dict) -> Optional[dict]:
    allowed = {'name', 'price', 'count', 'size', 'discount', 'description', 'featured', 'status'}
    fields  = {k: v for k, v in data.items() if k in allowed}
    if 'features' in data:
        fields['features'] = json.dumps(data['features'], ensure_ascii=False)
    if not fields:
        return get_by_id(package_id)
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    with get_connection() as conn:
        conn.execute(
            f"UPDATE packages SET {set_clause} WHERE id = ?",
            list(fields.values()) + [package_id]
        )
        conn.commit()
    return get_by_id(package_id)


# ── Delete ──────────────────────────────────────────────────────────────────────

def delete(package_id: int) -> bool:
    with get_connection() as conn:
        conn.execute("DELETE FROM packages WHERE id = ?", (package_id,))
        conn.commit()
    return True


# ── Subscriptions ────────────────────────────────────────────────────────────────

def subscribe(user_id: int, package_id: int) -> dict:
    from datetime import date, timedelta
    renews_at = (date.today() + timedelta(days=30)).isoformat()
    with get_connection() as conn:
        # Cancel existing active subscriptions
        conn.execute(
            "UPDATE subscriptions SET status='cancelled' WHERE user_id=? AND status='active'",
            (user_id,)
        )
        conn.execute(
            "INSERT INTO subscriptions (user_id, package_id, renews_at) VALUES (?,?,?)",
            (user_id, package_id, renews_at)
        )
        conn.commit()
    return get_by_id(package_id)


def get_user_subscription(user_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("""
            SELECT s.*, p.name AS package_name, p.price AS package_price
            FROM subscriptions s
            JOIN packages p ON p.id = s.package_id
            WHERE s.user_id = ? AND s.status = 'active'
            ORDER BY s.created_at DESC LIMIT 1
        """, (user_id,)).fetchone()
    return dict(row) if row else None
