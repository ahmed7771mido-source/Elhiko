"""
Elhiko - models/offer.py
Offer/coupon CRUD using SQLite.
"""
from datetime import date
from typing import Optional
from backend.database.database import get_connection


def get_all(status='') -> list:
    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT * FROM offers {'WHERE status=?' if status else ''} ORDER BY created_at DESC",
            [status] if status else []
        ).fetchall()
    return [dict(r) for r in rows]


def get_by_id(oid: int) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM offers WHERE id=?", (oid,)).fetchone()
    return dict(row) if row else None


def get_by_code(code: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM offers WHERE UPPER(code)=UPPER(?) AND status='active'", (code,)
        ).fetchone()
    return dict(row) if row else None


def validate_coupon(code: str, total: float) -> dict:
    o = get_by_code(code)
    if not o: return {'valid':False,'discount':0,'message':'كود الخصم غير صحيح'}
    if o.get('end_date') and o['end_date'] < date.today().isoformat():
        return {'valid':False,'discount':0,'message':'انتهت صلاحية الكود'}
    if o.get('max_uses') and o.get('used_count',0) >= o['max_uses']:
        return {'valid':False,'discount':0,'message':'تم استنفاد الحد الأقصى'}
    if total < (o.get('min_order') or 0):
        return {'valid':False,'discount':0,'message':f"الحد الأدنى {o['min_order']} ج.م"}
    disc = 0.0
    if o['type']=='percent': disc = round(total*float(o['value'])/100,2)
    elif o['type']=='fixed': disc = min(float(o['value']),total)
    return {'valid':True,'discount':disc,'message':o['name']}


def create(data: dict) -> dict:
    with get_connection() as conn:
        cur = conn.execute("""
            INSERT INTO offers(name,type,value,code,description,min_order,max_uses,
                start_date,end_date,featured,status,original_price,final_price,image)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            data['name'], data.get('type','percent'), float(data.get('value',0)),
            (data.get('code') or '').upper() or None,
            data.get('description',''), float(data.get('min_order',0)),
            int(data['max_uses']) if data.get('max_uses') else None,
            data.get('start_date'), data.get('end_date'),
            int(data.get('featured',0)), data.get('status','active'),
            float(data.get('original_price',0)), float(data.get('final_price',0)),
            data.get('image',''),
        ))
        conn.commit()
    return get_by_id(cur.lastrowid)


def update(oid: int, data: dict) -> Optional[dict]:
    allowed = {'name','type','value','code','description','min_order','max_uses',
               'start_date','end_date','featured','status','original_price','final_price','image'}
    fields = {k:v for k,v in data.items() if k in allowed}
    if 'code' in fields and fields['code']:
        fields['code'] = fields['code'].upper()
    if not fields: return get_by_id(oid)
    with get_connection() as conn:
        conn.execute(
            f"UPDATE offers SET {', '.join(f'{k}=?' for k in fields)} WHERE id=?",
            list(fields.values())+[oid]
        )
        conn.commit()
    return get_by_id(oid)


def increment_usage(oid: int):
    with get_connection() as conn:
        conn.execute("UPDATE offers SET used_count=used_count+1 WHERE id=?", (oid,))
        conn.commit()


def delete(oid: int) -> bool:
    with get_connection() as conn:
        conn.execute("DELETE FROM offers WHERE id=?", (oid,))
        conn.commit()
    return True
