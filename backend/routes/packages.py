"""
PERFUIM - routes/packages.py
GET    /api/packages
GET    /api/packages/<id>
POST   /api/packages         (admin)
PUT    /api/packages/<id>    (admin)
DELETE /api/packages/<id>    (admin)
"""

from flask import Blueprint, request
from backend.models import package as PackageModel
from backend.routes._helpers import (
    ok, created, bad, not_found, require_admin
)

packages_bp = Blueprint('packages', __name__, url_prefix='/api/packages')


@packages_bp.get('')
def list_packages():
    active_only = request.args.get('active', '').lower() in ('1', 'true')
    packages    = PackageModel.get_all(active_only=active_only)
    # Attach subscriber count
    for p in packages:
        p['subscribers'] = PackageModel.subscriber_count(p['id'])
    return ok({'packages': packages})


@packages_bp.get('/<int:package_id>')
def get_package(package_id: int):
    pkg = PackageModel.get_by_id(package_id)
    if not pkg:
        return not_found('الباقة')
    pkg['subscribers'] = PackageModel.subscriber_count(package_id)
    return ok({'package': pkg})


@packages_bp.post('')
@require_admin
def create_package():
    data = request.get_json(silent=True) or {}
    if not data.get('name') or not data.get('price'):
        return bad('اسم الباقة والسعر مطلوبان')
    pkg = PackageModel.create(data)
    return created({'package': pkg})


@packages_bp.put('/<int:package_id>')
@require_admin
def update_package(package_id: int):
    if not PackageModel.get_by_id(package_id):
        return not_found('الباقة')
    data = request.get_json(silent=True) or {}
    pkg  = PackageModel.update(package_id, data)
    return ok({'package': pkg})


@packages_bp.delete('/<int:package_id>')
@require_admin
def delete_package(package_id: int):
    if not PackageModel.get_by_id(package_id):
        return not_found('الباقة')
    PackageModel.delete(package_id)
    return ok(message='تم حذف الباقة بنجاح')
