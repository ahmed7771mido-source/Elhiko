"""
PERFUIM - routes/orders.py
"""

from flask import Blueprint, request, g
from backend.models import order as OrderModel
from backend.routes._helpers import (
    ok, created, bad, not_found, require_auth,
    require_admin, paginate_args
)

orders_bp = Blueprint('orders', __name__, url_prefix='/api/orders')


@orders_bp.get('')
@require_auth
def list_orders():
    limit, offset = paginate_args()
    user   = g.current_user
    uid    = 0 if user['role'] == 'admin' else user['id']
    status = request.args.get('status', '')
    result = OrderModel.get_all(status=status, user_id=uid, limit=limit, offset=offset)
    return ok(result)


@orders_bp.get('/<int:order_id>')
@require_auth
def get_order(order_id: int):
    order = OrderModel.get_by_id(order_id)
    if not order:
        return not_found('الطلب')
    if g.current_user['role'] != 'admin' and order.get('user_id') != g.current_user['id']:
        return bad('غير مصرح', 403)
    return ok({'order': order})


@orders_bp.post('')
def create_order():
    data = request.get_json(silent=True) or {}
    if not data.get('items'):
        return bad('لا يوجد منتجات في الطلب')
    if not data.get('shipping', {}).get('phone'):
        return bad('رقم الموبايل مطلوب')

    from backend.routes._helpers import _get_token, jwt_decode
    from backend.models import user as UserModel
    user_id = None
    token   = _get_token()
    if token:
        payload = jwt_decode(token)
        if payload:
            u = UserModel.get_by_id(payload['sub'])
            if u:
                user_id = u['id']

    order = OrderModel.create(data, user_id=user_id)
    return created({'order': order, 'order_id': order['id']})


@orders_bp.patch('/<int:order_id>')
@require_admin
def update_order(order_id: int):
    order = OrderModel.get_by_id(order_id)
    if not order:
        return not_found('الطلب')
    data   = request.get_json(silent=True) or {}
    status = data.get('status')
    if not status:
        return bad('الحالة مطلوبة')
    updated = OrderModel.update_status(order_id, status)
    if not updated:
        return bad('حالة غير صالحة')
    return ok({'order': updated})


@orders_bp.delete('/<int:order_id>')
@require_admin
def delete_order(order_id: int):
    order = OrderModel.get_by_id(order_id)
    if not order:
        return not_found('الطلب')
    OrderModel.delete(order_id)
    return ok(message='done')