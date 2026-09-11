"""
PERFUIM - routes/offers.py
GET    /api/offers
GET    /api/offers/<id>
POST   /api/offers           (admin)
PUT    /api/offers/<id>      (admin)
DELETE /api/offers/<id>      (admin)
POST   /api/offers/validate  (public coupon check)
"""

from flask import Blueprint, request
from backend.models import offer as OfferModel
from backend.routes._helpers import (
    ok, created, bad, not_found, require_admin
)

offers_bp = Blueprint('offers', __name__, url_prefix='/api/offers')


@offers_bp.get('')
def list_offers():
    status = request.args.get('status', '')
    offers = OfferModel.get_all(status=status)
    return ok({'offers': offers})


@offers_bp.get('/<int:offer_id>')
def get_offer(offer_id: int):
    offer = OfferModel.get_by_id(offer_id)
    if not offer:
        return not_found('العرض')
    return ok({'offer': offer})


@offers_bp.post('')
@require_admin
def create_offer():
    data = request.get_json(silent=True) or {}
    if not data.get('name'):
        return bad('اسم العرض مطلوب')
    offer = OfferModel.create(data)
    return created({'offer': offer})


@offers_bp.put('/<int:offer_id>')
@require_admin
def update_offer(offer_id: int):
    if not OfferModel.get_by_id(offer_id):
        return not_found('العرض')
    data  = request.get_json(silent=True) or {}
    offer = OfferModel.update(offer_id, data)
    return ok({'offer': offer})


@offers_bp.delete('/<int:offer_id>')
@require_admin
def delete_offer(offer_id: int):
    if not OfferModel.get_by_id(offer_id):
        return not_found('العرض')
    OfferModel.delete(offer_id)
    return ok(message='تم حذف العرض بنجاح')


@offers_bp.post('/validate')
def validate_coupon():
    """Public endpoint: validate a coupon code against an order total."""
    data        = request.get_json(silent=True) or {}
    code        = (data.get('code') or '').strip()
    order_total = float(data.get('total') or 0)
    if not code:
        return bad('كود الخصم مطلوب')
    result = OfferModel.validate_coupon(code, order_total)
    if not result['valid']:
        return bad(result['message'])
    return ok({'discount': result['discount'], 'message': result['message']})
