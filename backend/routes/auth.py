"""
PERFUIM - routes/auth.py
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/reset-password
"""

from flask import Blueprint, request, jsonify, g
import secrets
from backend.models import user as UserModel
from backend.routes._helpers import (
    jwt_encode, jwt_decode, require_auth, bad, ok, created
)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


# ── Login ───────────────────────────────────────────────────────────────────────
@auth_bp.post('/login')
def login():
    data     = request.get_json(silent=True) or {}
    email    = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return bad('البريد الإلكتروني وكلمة المرور مطلوبان')

    user = UserModel.verify_password(email, password)
    if not user:
        return bad('البريد الإلكتروني أو كلمة المرور غير صحيحة', 401)

    if user.get('status') != 'active':
        return bad('تم تعليق هذا الحساب، يرجى التواصل مع الدعم', 403)

    token = jwt_encode({'sub': user['id'], 'role': user['role']})
    return ok({'token': token, 'user': user})


# ── Register ────────────────────────────────────────────────────────────────────
@auth_bp.post('/register')
def register():
    data       = request.get_json(silent=True) or {}
    first_name = (data.get('first_name') or '').strip()
    last_name  = (data.get('last_name')  or '').strip()
    email      = (data.get('email')      or '').strip().lower()
    password   = data.get('password')    or ''
    phone      = (data.get('phone')      or '').strip()
    newsletter = bool(data.get('newsletter', True))

    if not all([first_name, email, password]):
        return bad('الاسم والبريد الإلكتروني وكلمة المرور مطلوبة')
    if len(password) < 8:
        return bad('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    if UserModel.get_by_email(email):
        return bad('هذا البريد الإلكتروني مسجّل بالفعل', 409)

    user  = UserModel.create(first_name, last_name, email, password, phone, newsletter)
    token = jwt_encode({'sub': user['id'], 'role': user['role']})
    return created({'token': token, 'user': user})


# ── Logout (stateless — client drops token) ─────────────────────────────────────
@auth_bp.post('/logout')
def logout():
    return ok({'message': 'تم تسجيل الخروج بنجاح'})


# ── Me ──────────────────────────────────────────────────────────────────────────
@auth_bp.get('/me')
@require_auth
def me():
    return ok(g.current_user)


# ── Request password reset ───────────────────────────────────────────────────────
@auth_bp.post('/reset-password')
def reset_password():
    data  = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    if not email:
        return bad('البريد الإلكتروني مطلوب')
    # Always return success to avoid user enumeration
    # In production: send reset email with signed token
    return ok({'message': 'إذا كان البريد مسجّلاً، سيصلك رابط إعادة التعيين قريباً'})


# ── Change password (authenticated) ─────────────────────────────────────────────
@auth_bp.post('/change-password')
@require_auth
def change_password():
    data         = request.get_json(silent=True) or {}
    new_password = data.get('new_password') or ''
    if len(new_password) < 8:
        return bad('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل')
    UserModel.change_password(g.current_user['id'], new_password)
    return ok({'message': 'تم تغيير كلمة المرور بنجاح'})
