"""
PERFUIM - routes/users.py
GET    /api/users/me
PUT    /api/users/me
GET    /api/users/me/orders
GET    /api/users/me/wishlist
POST   /api/users/me/wishlist/<product_id>
DELETE /api/users/me/wishlist/<product_id>
GET    /api/users/me/subscription
POST   /api/users/me/subscription/<package_id>
"""

from flask import Blueprint, request, g
from backend.models import user as UserModel, order as OrderModel, package as PackageModel
from backend.routes._helpers import ok, bad, not_found, require_auth
from backend.database.database import get_connection

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


# ── Profile ──────────────────────────────────────────────────────────────────────
@users_bp.get('/me')
@require_auth
def get_me():
    return ok({'user': g.current_user})


@users_bp.put('/me')
@require_auth
def update_me():
    data = request.get_json(silent=True) or {}
    # Prevent role escalation from this endpoint
    data.pop('role', None)
    data.pop('status', None)
    user = UserModel.update(g.current_user['id'], **data)
    return ok({'user': user})


# ── Orders ───────────────────────────────────────────────────────────────────────
@users_bp.get('/me/orders')
@require_auth
def my_orders():
    result = OrderModel.get_all(user_id=g.current_user['id'], limit=50)
    return ok(result)


# ── Wishlist ─────────────────────────────────────────────────────────────────────
@users_bp.get('/me/wishlist')
@require_auth
def get_wishlist():
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT p.id, p.name, p.brand, p.price, p.old_price,
                   p.image, p.rating, p.reviews_count
            FROM wishlist w
            JOIN products p ON p.id = w.product_id
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC
        """, (g.current_user['id'],)).fetchall()
    return ok({'products': [dict(r) for r in rows]})


@users_bp.post('/me/wishlist/<int:product_id>')
@require_auth
def add_to_wishlist(product_id: int):
    try:
        with get_connection() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?,?)",
                (g.current_user['id'], product_id)
            )
            conn.commit()
    except Exception:
        return bad('فشل الإضافة إلى المفضلة')
    return ok(message='تمت الإضافة إلى المفضلة')


@users_bp.delete('/me/wishlist/<int:product_id>')
@require_auth
def remove_from_wishlist(product_id: int):
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM wishlist WHERE user_id=? AND product_id=?",
            (g.current_user['id'], product_id)
        )
        conn.commit()
    return ok(message='تمت الإزالة من المفضلة')


# ── Subscription ─────────────────────────────────────────────────────────────────
@users_bp.get('/me/subscription')
@require_auth
def get_subscription():
    sub = PackageModel.get_user_subscription(g.current_user['id'])
    return ok({'subscription': sub})


@users_bp.post('/me/subscription/<int:package_id>')
@require_auth
def subscribe(package_id: int):
    pkg = PackageModel.get_by_id(package_id)
    if not pkg or pkg.get('status') != 'active':
        return not_found('الباقة')
    PackageModel.subscribe(g.current_user['id'], package_id)
    return ok({'package': pkg}, message='تم الاشتراك في الباقة بنجاح')
