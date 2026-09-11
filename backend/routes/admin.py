"""
PERFUIM - routes/admin.py
GET  /api/admin/stats
GET  /api/admin/users
GET  /api/admin/users/<id>
PUT  /api/admin/users/<id>
PATCH /api/admin/users/<id>
DELETE /api/admin/users/<id>
"""

from flask import Blueprint, request
from backend.models import (
    user    as UserModel,
    product as ProductModel,
    order   as OrderModel,
    offer   as OfferModel,
)
from backend.routes._helpers import (
    ok, bad, not_found, forbidden, require_admin, paginate_args
)

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


# ── Dashboard stats ──────────────────────────────────────────────────────────────
@admin_bp.get('/stats')
@require_admin
def dashboard_stats():
    revenue       = OrderModel.total_revenue()
    orders_total  = OrderModel.count()
    users_total   = UserModel.count()
    products_total= ProductModel.count()
    pending       = OrderModel.count_by_status('pending')
    monthly       = OrderModel.monthly_revenue()

    # Recent orders (last 5)
    recent = OrderModel.get_all(limit=5)['orders']
    recent_out = [
        {
            'id':     f'ORD-{o["id"]:03d}',
            'name':   f'{o.get("sh_first_name","")} {o.get("sh_last_name","")} '.strip(),
            'total':  o['total'],
            'status': o['status'],
            'date':   (o.get('created_at') or '')[:10],
        }
        for o in recent
    ]

    return ok({
        'revenue':         round(revenue, 2),
        'revenue_change':  12.4,   # placeholder — could calculate vs last month
        'orders':          orders_total,
        'orders_change':   8.2,
        'users':           users_total,
        'users_change':    5.6,
        'products':        products_total,
        'pending_orders':  pending,
        'monthly_sales':   monthly,
        'recent_orders':   recent_out,
        'top_products':    _top_products(),
    })


def _top_products() -> list:
    """Return top 5 products by order quantity."""
    from backend.database.database import get_connection
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT p.name, p.brand, SUM(oi.qty) AS total_sold
            FROM order_items oi
            JOIN products p ON p.id = oi.product_id
            GROUP BY oi.product_id
            ORDER BY total_sold DESC
            LIMIT 5
        """).fetchall()
    if rows:
        return [{'name': r['name'], 'brand': r['brand'], 'sales': r['total_sold']} for r in rows]
    # Fallback demo data
    return [
        {'name': 'Bleu de Chanel', 'brand': 'Chanel',   'sales': 42},
        {'name': 'Sauvage EDP',    'brand': 'Dior',     'sales': 38},
        {'name': 'Oud Wood',       'brand': 'Tom Ford', 'sales': 31},
        {'name': 'Black Opium',    'brand': 'YSL',      'sales': 28},
        {'name': 'Aventus',        'brand': 'Creed',    'sales': 19},
    ]


# ── User management ──────────────────────────────────────────────────────────────
@admin_bp.get('/users')
@require_admin
def list_users():
    limit, offset = paginate_args()
    users = UserModel.get_all(limit=limit, offset=offset)
    return ok({'users': users, 'total': UserModel.count()})


@admin_bp.get('/users/<int:user_id>')
@require_admin
def get_user(user_id: int):
    user = UserModel.get_by_id(user_id)
    if not user:
        return not_found('المستخدم')
    orders = OrderModel.get_all(user_id=user_id, limit=20)
    user['orders'] = orders['orders']
    return ok({'user': user})


@admin_bp.put('/users/<int:user_id>')
@require_admin
def update_user(user_id: int):
    if not UserModel.get_by_id(user_id):
        return not_found('المستخدم')
    data = request.get_json(silent=True) or {}
    user = UserModel.update(user_id, **data)
    return ok({'user': user})


@admin_bp.patch('/users/<int:user_id>')
@require_admin
def patch_user(user_id: int):
    """Partial update — mainly for toggling status."""
    if not UserModel.get_by_id(user_id):
        return not_found('المستخدم')
    data = request.get_json(silent=True) or {}
    user = UserModel.update(user_id, **data)
    return ok({'user': user})


@admin_bp.delete('/users/<int:user_id>')
@require_admin
def delete_user(user_id: int):
    from flask import g
    if user_id == g.current_user['id']:
        return bad('لا يمكنك حذف حسابك الخاص')
    if not UserModel.get_by_id(user_id):
        return not_found('المستخدم')
    UserModel.delete(user_id)
    return ok(message='تم حذف المستخدم بنجاح')
