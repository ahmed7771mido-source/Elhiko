"""
PERFUIM - models/offer.py
Offer / coupon model.
"""

from typing import Optional
from backend.database.database import get_connection


def _row(row) -> Optional[dict]:
    return dict(row) if row else None


# ── Read ────────────────────────────────────────────────────────────────────────

def get_all(status: str = '') -> list[dict]:
    where  = "WHERE status = ?" if status else ""
    params = [status] if status else []
    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT * FROM offers {where} ORDER BY created_at DESC", params
        ).fetchall()
    return [dict(r) for r in rows]


def get_by_id(offer_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM offers WHERE id = ?", (offer_id,)).fetchone()
    return _row(row)


def get_by_code(code: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM offers WHERE UPPER(code) = UPPER(?) AND status = 'active'",
            (code,)
        ).fetchone()
    return _row(row)


# ── Validate coupon ─────────────────────────────────────────────────────────────

def validate_coupon(code: str, order_total: float) -> dict:
    """
    Returns {'valid': bool, 'discount': float, 'message': str}.
    """
    offer = get_by_code(code)
    if not offer:
        return {'valid': False, 'discount': 0, 'message': 'كود الخصم غير صحيح أو منتهي الصلاحية'}

    if offer['end_date'] and offer['end_date'] < _today():
        return {'valid': False, 'discount': 0, 'message': 'انتهت صلاحية كود الخصم'}

    if offer['max_uses'] and offer['used_count'] >= offer['max_uses']:
        return {'valid': False, 'discount': 0, 'message': 'تم استنفاد الحد الأقصى لاستخدام هذا الكود'}

    if order_total < (offer['min_order'] or 0):
        return {
            'valid': False, 'discount': 0,
            'message': f"يجب أن يكون مجموع الطلب {offer['min_order']} ريال على الأقل"
        }

    discount = 0.0
    if offer['type'] == 'percent':
        discount = round(order_total * offer['value'] / 100, 2)
    elif offer['type'] == 'fixed':
        discount = min(float(offer['value']), order_total)

    return {'valid': True, 'discount': discount, 'message': offer['name']}


# ── Create ──────────────────────────────────────────────────────────────────────

def create(data: dict) -> dict:
    with get_connection() as conn:
        cur = conn.execute("""
            INSERT INTO offers
              (name, type, value, code, description, min_order, max_uses,
               start_date, end_date, featured, status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        """, (
            data['name'],
            data.get('type', 'percent'),
            float(data.get('value', 0)),
            (data.get('code') or '').upper() or None,
            data.get('description', ''),
            float(data.get('min_order', 0)),
            int(data['max_uses']) if data.get('max_uses') else None,
            data.get('start_date'),
            data.get('end_date'),
            int(data.get('featured', 0)),
            data.get('status', 'active'),
        ))
        conn.commit()
        return get_by_id(cur.lastrowid)


# ── Update ──────────────────────────────────────────────────────────────────────

def update(offer_id: int, data: dict) -> Optional[dict]:
    allowed = {'name','type','value','code','description','min_order',
               'max_uses','start_date','end_date','featured','status'}
    fields  = {k: v for k, v in data.items() if k in allowed}
    if 'code' in fields and fields['code']:
        fields['code'] = fields['code'].upper()
    if not fields:
        return get_by_id(offer_id)
    set_clause = ', '.join(f"{k} = ?" for k in fields)
    with get_connection() as conn:
        conn.execute(
            f"UPDATE offers SET {set_clause} WHERE id = ?",
            list(fields.values()) + [offer_id]
        )
        conn.commit()
    return get_by_id(offer_id)


def increment_usage(offer_id: int) -> None:
    with get_connection() as conn:
        conn.execute("UPDATE offers SET used_count = used_count + 1 WHERE id = ?", (offer_id,))
        conn.commit()


# ── Delete ──────────────────────────────────────────────────────────────────────

def delete(offer_id: int) -> bool:
    with get_connection() as conn:
        conn.execute("DELETE FROM offers WHERE id = ?", (offer_id,))
        conn.commit()
    return True


# ── Helper ──────────────────────────────────────────────────────────────────────

def _today() -> str:
    from datetime import date
    return date.today().isoformat()
