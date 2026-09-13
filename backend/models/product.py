"""
Elhiko - models/product.py
Product CRUD using SQLite.
"""
import json
from typing import Optional
from backend.database.database import get_connection


def _row(row) -> Optional[dict]:
    if not row:
        return None
    d = dict(row)
    if isinstance(d.get('sizes'), str):
        d['sizes'] = [s.strip() for s in d['sizes'].split(',') if s.strip()]
    if isinstance(d.get('images'), str):
        try:    d['images'] = json.loads(d['images'])
        except: d['images'] = []
    d['notes'] = {
        'top':   d.pop('note_top',   ''),
        'heart': d.pop('note_heart', ''),
        'base':  d.pop('note_base',  ''),
    }
    return d


def get_all(category='', search='', sort='default',
            featured=False, limit=50, offset=0) -> dict:
    conds  = ["status = 'active'"]
    params = []
    if category:
        conds.append("category = ?"); params.append(category)
    if search:
        conds.append("(name LIKE ? OR brand LIKE ?)"); params += [f'%{search}%']*2
    if featured:
        conds.append("featured = 1")

    where = "WHERE " + " AND ".join(conds)
    order = {
        'price-asc':'price ASC','price-desc':'price DESC',
        'rating':'rating DESC','newest':'is_new DESC, created_at DESC',
        'name-asc':'name ASC','default':'featured DESC, id DESC',
    }.get(sort, 'featured DESC, id DESC')

    with get_connection() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM products {where}", params).fetchone()[0]
        rows  = conn.execute(f"SELECT * FROM products {where} ORDER BY {order} LIMIT ? OFFSET ?",
                             params + [limit, offset]).fetchall()
    return {'products': [_row(r) for r in rows], 'total': total, 'limit': limit, 'offset': offset}


def get_by_id(pid: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
    return _row(row)


def count() -> int:
    with get_connection() as conn:
        return conn.execute("SELECT COUNT(*) FROM products WHERE status='active'").fetchone()[0]


def create(data: dict) -> dict:
    sizes  = ','.join(data.get('sizes') or ['50ml'])
    images = json.dumps(data.get('images') or [], ensure_ascii=False)
    notes  = data.get('notes') or {}
    with get_connection() as conn:
        cur = conn.execute("""
            INSERT INTO products
              (name,brand,description,price,old_price,category,stock,sizes,
               image,images,note_top,note_heart,note_base,is_new,featured,status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            data['name'], data['brand'], data.get('description',''),
            float(data['price']),
            float(data['old_price']) if data.get('old_price') else None,
            data.get('category','unisex'), int(data.get('stock',0)),
            sizes, data.get('image',''), images,
            notes.get('top',''), notes.get('heart',''), notes.get('base',''),
            int(data.get('is_new',0)), int(data.get('featured',0)),
            data.get('status','active'),
        ))
        conn.commit()
        return get_by_id(cur.lastrowid)


def update(pid: int, data: dict) -> Optional[dict]:
    allowed = {'name','brand','description','price','old_price',
               'category','stock','image','is_new','featured','status'}
    fields  = {k:v for k,v in data.items() if k in allowed}
    if 'sizes'  in data: fields['sizes']  = ','.join(data['sizes']) if isinstance(data['sizes'],list) else data['sizes']
    if 'images' in data: fields['images'] = json.dumps(data['images'],ensure_ascii=False)
    if 'notes'  in data:
        n=data['notes']; fields['note_top']=n.get('top',''); fields['note_heart']=n.get('heart',''); fields['note_base']=n.get('base','')
    if not fields: return get_by_id(pid)
    set_clause = ', '.join(f"{k}=?" for k in fields)
    with get_connection() as conn:
        conn.execute(f"UPDATE products SET {set_clause}, updated_at=datetime('now') WHERE id=?",
                     list(fields.values())+[pid])
        conn.commit()
    return get_by_id(pid)


def decrement_stock(pid: int, qty: int):
    with get_connection() as conn:
        conn.execute("UPDATE products SET stock=MAX(0,stock-?) WHERE id=?", (qty,pid))
        conn.commit()


def delete(pid: int) -> bool:
    with get_connection() as conn:
        conn.execute("DELETE FROM products WHERE id=?", (pid,))
        conn.commit()
    return True


def get_reviews(pid: int) -> list:
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT r.id,r.rating,r.text,r.created_at,
                   u.first_name||' '||u.last_name AS name
            FROM reviews r JOIN users u ON u.id=r.user_id
            WHERE r.product_id=? ORDER BY r.created_at DESC
        """, (pid,)).fetchall()
    return [dict(r) for r in rows]


def add_review(pid: int, uid: int, rating: int, text: str) -> dict:
    with get_connection() as conn:
        conn.execute("INSERT INTO reviews(product_id,user_id,rating,text) VALUES(?,?,?,?)",
                     (pid,uid,rating,text))
        avg = conn.execute("SELECT AVG(rating),COUNT(*) FROM reviews WHERE product_id=?", (pid,)).fetchone()
        conn.execute("UPDATE products SET rating=?,reviews_count=?,updated_at=datetime('now') WHERE id=?",
                     (round(avg[0] or 0,1), avg[1], pid))
        conn.commit()
    return get_by_id(pid)
