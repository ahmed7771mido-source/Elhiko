"""
PERFUIM - models/order.py
Order model: create, read, update status.
No tax — prices are as-is.
"""

from typing import Optional
from backend.database.database import get_connection
from backend.models import product as ProductModel


def _row(row, with_items: bool = False, conn=None) -> Optional[dict]:
    if not row:
        return None
    d = dict(row)
    d['customer']  = f"{d.get('sh_first_name','')} {d.get('sh_last_name','')}".strip()
    d['phone']     = d.get('sh_phone', '')
    d['address']   = d.get('sh_address', '')
    d['city']      = d.get('sh_city', '')
    d['region']    = d.get('sh_region', '')
    d['notes']     = d.get('sh_notes', '')
    d['date']      = (d.get('created_at') or '')[:10]
    d['email']     = d.get('sh_email', '')

    def _query(c):
        if with_items:
            items = c.execute(
                "SELECT * FROM order_items WHERE order_id = ?", (d['id'],)
            ).fetchall()
            d['items']       = [dict(i) for i in items]
            d['items_count'] = len(d['items'])
        else:
            d['items_count'] = c.execute(
                "SELECT COALESCE(SUM(qty),0) FROM order_items WHERE order_id = ?",
                (d['id'],)
            ).fetchone()[0]

    if conn:
        _query(conn)
    else:
        with get_connection() as c:
            _query(c)

    return d


# ── Read ────────────────────────────────────────────────────────────────────────

def get_all(status: str = '', user_id: int = 0,
            limit: int = 50, offset: int = 0) -> dict:
    conditions, params = [], []
    if status:
        conditions.append("status = ?")
        params.append(status)
    if user_id:
        conditions.append("user_id = ?")
        params.append(user_id)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    with get_connection() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM orders {where}", params
        ).fetchone()[0]

        rows = conn.execute(
            f"SELECT * FROM orders {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset]
        ).fetchall()

    return {
        'orders': [_row(r) for r in rows],
        'total':  total,
    }


def get_by_id(order_id: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
    return _row(row, with_items=True)


def count() -> int:
    with get_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]


def count_by_status(status: str) -> int:
    with get_connection() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM orders WHERE status = ?", (status,)
        ).fetchone()[0]


def monthly_revenue() -> list:
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT strftime('%m', created_at) AS m, SUM(total) AS rev
            FROM orders
            WHERE status != 'cancelled'
              AND strftime('%Y', created_at) = strftime('%Y', 'now')
            GROUP BY m
        """).fetchall()
    month_map = {r['m']: r['rev'] for r in rows}
    return [round(month_map.get(f'{i:02d}', 0), 2) for i in range(1, 13)]


def total_revenue() -> float:
    with get_connection() as conn:
        return conn.execute(
            "SELECT COALESCE(SUM(total),0) FROM orders WHERE status != 'cancelled'"
        ).fetchone()[0]


# ── Create ──────────────────────────────────────────────────────────────────────

def create(data: dict, user_id: int = None) -> dict:
    sh    = data.get('shipping', {})
    sub   = float(data.get('subtotal', 0))
    disc  = float(data.get('discount_amt', 0))
    ship  = float(data.get('shipping_cost', 0))
    total = round(max(0, sub - disc) + ship, 2)

    # نجمع المنتجات اللي محتاجين نقلل مخزونها بعد الـ commit
    stock_updates = []

    with get_connection() as conn:
        cur = conn.execute("""
            INSERT INTO orders
              (user_id, status, payment_method, subtotal, discount_amt,
               shipping_cost, tax_amt, total,
               sh_first_name, sh_last_name, sh_email, sh_phone,
               sh_address, sh_city, sh_region, sh_zip, sh_notes, coupon_code)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            user_id, 'pending', 'cod',
            sub, disc, ship, 0, total,
            sh.get('first_name', ''), sh.get('last_name', ''),
            sh.get('email', 'guest@perfuim.com'),
            sh.get('phone', ''),
            sh.get('address', ''),
            sh.get('city', ''),
            sh.get('region', ''),
            sh.get('zip', ''),
            sh.get('notes', ''),
            data.get('coupon_code', ''),
        ))
        order_id = cur.lastrowid

        for item in data.get('items', []):
            conn.execute("""
                INSERT INTO order_items (order_id, product_id, name, brand, price, qty, size)
                VALUES (?,?,?,?,?,?,?)
            """, (
                order_id,
                item.get('product_id'),
                item.get('name', ''),
                item.get('brand', ''),
                float(item.get('price', 0)),
                int(item.get('qty', 1)),
                item.get('size', '50ml'),
            ))
            if item.get('product_id'):
                stock_updates.append((item['product_id'], item.get('qty', 1)))

        conn.commit()

        # قراءة الطلب بنفس الـ connection قبل ما يقفل
        row = conn.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        items_rows = conn.execute(
            "SELECT * FROM order_items WHERE order_id = ?", (order_id,)
        ).fetchall()

    # تقليل المخزون بعد الـ commit في connection منفصل
    for pid, qty in stock_updates:
        try:
            ProductModel.decrement_stock(pid, qty)
        except Exception:
            pass  # مش هنوقف الطلب لو فشل تقليل المخزون

    # بناء الـ response
    result = _row(row)
    result['items']       = [dict(i) for i in items_rows]
    result['items_count'] = len(result['items'])
    return result


# ── Update ──────────────────────────────────────────────────────────────────────

def update_status(order_id: int, status: str) -> Optional[dict]:
    valid = {'pending', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'}
    if status not in valid:
        return None
    with get_connection() as conn:
        conn.execute(
            "UPDATE orders SET status=?, updated_at=datetime('now') WHERE id=?",
            (status, order_id)
        )
        conn.commit()
    return get_by_id(order_id)


# ── Delete ──────────────────────────────────────────────────────────────────────

def delete(order_id: int) -> bool:
    """حذف الطلب نهائياً من قاعدة البيانات مع كل عناصره"""
    with get_connection() as conn:
        # order_items بتتحذف تلقائياً بسبب ON DELETE CASCADE
        conn.execute("DELETE FROM orders WHERE id = ?", (order_id,))
        conn.commit()
    return True
