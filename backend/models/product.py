"""
PERFUIM - models/product.py
Product model: CRUD + search + review helpers.
"""

import json
from typing import Optional
from backend.database.database import get_connection


def _row(row) -> Optional[dict]:
    if not row:
        return None
    d = dict(row)
    # Parse comma-separated sizes to list
    if isinstance(d.get('sizes'), str):
        d['sizes'] = [s.strip() for s in d['sizes'].split(',') if s.strip()]
    # Parse images JSON
    if isinstance(d.get('images'), str):
        try:
            d['images'] = json.loads(d['images'])
        except (json.JSONDecodeError, TypeError):
            d['images'] = []
    # Attach notes sub-object
    d['notes'] = {
        'top':   d.pop('note_top',   ''),
        'heart': d.pop('note_heart', ''),
        'base':  d.pop('note_base',  ''),
    }
    return d


# ── Read ────────────────────────────────────────────────────────────────────────

def get_all(category: str = '', search: str = '', sort: str = 'default',
            featured: bool = False, limit: int = 50, offset: int = 0) -> dict:
    """Return paginated products with total count."""
    conditions = ["status = 'active'"]
    params: list = []

    if category:
        conditions.append("category = ?")
        params.append(category)
    if search:
        conditions.append("(name LIKE ? OR brand LIKE ?)")
        params += [f'%{search}%', f'%{search}%']
    if featured:
        conditions.append("featured = 1")

    where = "WHERE " + " AND ".join(conditions)

    order_map = {
        'price-asc':  'price ASC',
        'price-desc': 'price DESC',
        'rating':     'rating DESC',
        'newest':     'is_new DESC, created_at DESC',
        'name-asc':   'name ASC',
        'default':    'featured DESC, id DESC',
    }
    order = order_map.get(sort, 'featured DESC, id DESC')

    with get_connection() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM products {where}", params
        ).fetchone()[0]

        rows = conn.execute(
            f"SELECT * FROM products {where} ORDER BY {order} LIMIT ? OFFSET ?",
            params + [limit, offset]
        ).fetchall()

    return {
        'products': [_row(r) for r in rows],
        'total':    total,
        'limit':    limit,
        'offset':   offset,
    }


def get_by_id(product_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    return _row(row)


def count() -> int:
    with get_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM products WHERE status='active'").fetchone()[0]


# ── Create ──────────────────────────────────────────────────────────────────────

def create(data: dict) -> dict:
    sizes  = ','.join(data.get('sizes') or ['50ml'])
    images = json.dumps(data.get('images') or [], ensure_ascii=False)
    notes  = data.get('notes', {})

    with get_connection() as conn:
        cur = conn.execute("""
            INSERT INTO products
              (name, brand, description, price, old_price, category, stock, sizes,
               image, images, note_top, note_heart, note_base, is_new, featured, status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            data['name'], data['brand'],
            data.get('description', ''),
            float(data['price']),
            float(data['old_price']) if data.get('old_price') else None,
            data.get('category', 'unisex'),
            int(data.get('stock', 0)),
            sizes, data.get('image', ''), images,
            notes.get('top', ''), notes.get('heart', ''), notes.get('base', ''),
            int(data.get('is_new', 0)),
            int(data.get('featured', 0)),
            data.get('status', 'active'),
        ))
        conn.commit()
        return get_by_id(cur.lastrowid)


# ── Update ──────────────────────────────────────────────────────────────────────

def update(product_id: int, data: dict) -> Optional[dict]:
    allowed = {
        'name', 'brand', 'description', 'price', 'old_price',
        'category', 'stock', 'image', 'is_new', 'featured', 'status',
    }
    fields = {k: v for k, v in data.items() if k in allowed}

    # Handle nested fields
    if 'sizes' in data:
        fields['sizes'] = ','.join(data['sizes']) if isinstance(data['sizes'], list) else data['sizes']
    if 'images' in data:
        fields['images'] = json.dumps(data['images'], ensure_ascii=False)
    if 'notes' in data:
        notes = data['notes']
        fields['note_top']   = notes.get('top', '')
        fields['note_heart'] = notes.get('heart', '')
        fields['note_base']  = notes.get('base', '')

    if not fields:
        return get_by_id(product_id)

    set_clause = ', '.join(f"{k} = ?" for k in fields)
    values     = list(fields.values()) + [product_id]
    with get_connection() as conn:
        conn.execute(
            f"UPDATE products SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
            values
        )
        conn.commit()
    return get_by_id(product_id)


def decrement_stock(product_id: int, qty: int) -> None:
    with get_connection() as conn:
        conn.execute(
            "UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?",
            (qty, product_id)
        )
        conn.commit()


# ── Delete ──────────────────────────────────────────────────────────────────────

def delete(product_id: int) -> bool:
    with get_connection() as conn:
        conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
    return True


# ── Reviews ─────────────────────────────────────────────────────────────────────

def get_reviews(product_id: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT r.id, r.rating, r.text, r.created_at,
                   u.first_name || ' ' || u.last_name AS name
            FROM reviews r
            JOIN users u ON u.id = r.user_id
            WHERE r.product_id = ?
            ORDER BY r.created_at DESC
        """, (product_id,)).fetchall()
    return [dict(r) for r in rows]


def add_review(product_id: int, user_id: int, rating: int, text: str) -> dict:
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO reviews (product_id, user_id, rating, text) VALUES (?,?,?,?)",
            (product_id, user_id, rating, text)
        )
        # Recalculate average rating
        avg = conn.execute(
            "SELECT AVG(rating), COUNT(*) FROM reviews WHERE product_id = ?",
            (product_id,)
        ).fetchone()
        conn.execute(
            "UPDATE products SET rating=?, reviews_count=?, updated_at=datetime('now') WHERE id=?",
            (round(avg[0] or 0, 1), avg[1], product_id)
        )
        conn.commit()
    return get_by_id(product_id)
