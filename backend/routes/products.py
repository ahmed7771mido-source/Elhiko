"""
PERFUIM - routes/products.py
GET    /api/products
GET    /api/products/<id>
POST   /api/products          (admin)
PUT    /api/products/<id>     (admin)
DELETE /api/products/<id>     (admin)
GET    /api/products/<id>/reviews
POST   /api/products/<id>/reviews  (auth)
"""

from flask import Blueprint, request
from backend.models import product as ProductModel
from backend.routes._helpers import (
    ok, created, bad, not_found, require_auth,
    require_admin, paginate_args
)

products_bp = Blueprint('products', __name__, url_prefix='/api/products')


@products_bp.get('')
def list_products():
    limit, offset = paginate_args()
    result = ProductModel.get_all(
        category = request.args.get('category', ''),
        search   = request.args.get('search', ''),
        sort     = request.args.get('sort', 'default'),
        featured = request.args.get('featured', '').lower() in ('1', 'true'),
        limit    = limit,
        offset   = offset,
    )
    return ok(result)


@products_bp.get('/<int:product_id>')
def get_product(product_id: int):
    product = ProductModel.get_by_id(product_id)
    if not product:
        return not_found('المنتج')
    reviews = ProductModel.get_reviews(product_id)
    product['demo_reviews'] = reviews
    return ok({'product': product})


@products_bp.post('')
@require_admin
def create_product():
    data = request.get_json(silent=True) or {}
    if not data.get('name') or not data.get('brand') or not data.get('price'):
        return bad('الاسم والدار والسعر مطلوبة')
    product = ProductModel.create(data)
    return created({'product': product})


@products_bp.put('/<int:product_id>')
@require_admin
def update_product(product_id: int):
    if not ProductModel.get_by_id(product_id):
        return not_found('المنتج')
    data    = request.get_json(silent=True) or {}
    product = ProductModel.update(product_id, data)
    return ok({'product': product})


@products_bp.delete('/<int:product_id>')
@require_admin
def delete_product(product_id: int):
    if not ProductModel.get_by_id(product_id):
        return not_found('المنتج')
    ProductModel.delete(product_id)
    return ok(message='تم حذف المنتج بنجاح')


@products_bp.get('/<int:product_id>/reviews')
def get_reviews(product_id: int):
    reviews = ProductModel.get_reviews(product_id)
    return ok({'reviews': reviews})


@products_bp.post('/<int:product_id>/reviews')
@require_auth
def add_review(product_id: int):
    from flask import g
    if not ProductModel.get_by_id(product_id):
        return not_found('المنتج')
    data   = request.get_json(silent=True) or {}
    rating = int(data.get('rating', 0))
    text   = (data.get('text') or '').strip()
    if not (1 <= rating <= 5):
        return bad('التقييم يجب أن يكون بين 1 و 5')
    if not text:
        return bad('نص التقييم مطلوب')
    ProductModel.add_review(product_id, g.current_user['id'], rating, text)
    return created(message='تم إضافة تقييمك بنجاح')
