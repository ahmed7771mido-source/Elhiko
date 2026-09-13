"""
Elhiko - routes/products.py
"""
from flask import Blueprint, request, g
from backend.models import product as ProductModel
from backend.routes._helpers import ok, created, bad, not_found, require_auth, require_admin, paginate_args

products_bp = Blueprint('products', __name__, url_prefix='/api/products')


@products_bp.get('')
def list_products():
    limit, offset = paginate_args()
    result = ProductModel.get_all(
        category = request.args.get('category',''),
        search   = request.args.get('search',''),
        sort     = request.args.get('sort','default'),
        featured = request.args.get('featured','').lower() in ('1','true'),
        limit    = limit,
        offset   = offset,
    )
    return ok(result)


@products_bp.get('/<int:pid>')
def get_product(pid):
    p = ProductModel.get_by_id(pid)
    if not p: return not_found('المنتج')
    p['demo_reviews'] = ProductModel.get_reviews(pid)
    return ok({'product': p})


@products_bp.post('')
@require_admin
def create_product():
    data = request.get_json(silent=True) or {}
    if not data.get('name') or not data.get('brand') or not data.get('price'):
        return bad('الاسم والدار والسعر مطلوبة')
    return created({'product': ProductModel.create(data)})


@products_bp.put('/<int:pid>')
@require_admin
def update_product(pid):
    if not ProductModel.get_by_id(pid): return not_found('المنتج')
    data = request.get_json(silent=True) or {}
    return ok({'product': ProductModel.update(pid, data)})


@products_bp.delete('/<int:pid>')
@require_admin
def delete_product(pid):
    if not ProductModel.get_by_id(pid): return not_found('المنتج')
    ProductModel.delete(pid)
    return ok(message='تم حذف المنتج')


@products_bp.get('/<int:pid>/reviews')
def get_reviews(pid):
    return ok({'reviews': ProductModel.get_reviews(pid)})


@products_bp.post('/<int:pid>/reviews')
@require_auth
def add_review(pid):
    if not ProductModel.get_by_id(pid): return not_found('المنتج')
    data   = request.get_json(silent=True) or {}
    rating = int(data.get('rating',0))
    text   = (data.get('text') or '').strip()
    if not 1 <= rating <= 5: return bad('التقييم بين 1 و 5')
    if not text: return bad('نص التقييم مطلوب')
    ProductModel.add_review(pid, g.current_user['id'], rating, text)
    return created(message='تم إضافة تقييمك')
