"""
PERFUIM - routes/_helpers.py
Shared utilities: JWT, response helpers, auth decorators.
"""

import os
import json
import hmac
import hashlib
import base64
import time
from functools import wraps
from flask import request, jsonify, g
from backend.models import user as UserModel

JWT_SECRET = os.environ.get('JWT_SECRET', 'perfuim-secret-key-change-in-production')
JWT_EXPIRY  = 60 * 60 * 24 * 7   # 7 days in seconds


# ── JWT (manual HS256, no external lib required) ────────────────────────────────

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def _b64d(s: str) -> bytes:
    pad = '=' * (4 - len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def jwt_encode(payload: dict) -> str:
    header  = _b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())
    payload = {**payload, 'iat': int(time.time()), 'exp': int(time.time()) + JWT_EXPIRY}
    body    = _b64(json.dumps(payload).encode())
    sig     = _b64(hmac.new(JWT_SECRET.encode(), f'{header}.{body}'.encode(), hashlib.sha256).digest())
    return f'{header}.{body}.{sig}'


def jwt_decode(token: str) -> dict | None:
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        header, body, sig = parts
        expected = _b64(hmac.new(
            JWT_SECRET.encode(), f'{header}.{body}'.encode(), hashlib.sha256
        ).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_b64d(body))
        if payload.get('exp', 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# ── Response helpers ────────────────────────────────────────────────────────────

def ok(data: dict = None, message: str = '') -> tuple:
    resp = {'success': True}
    if message:
        resp['message'] = message
    if data is not None:
        resp.update(data)
    return jsonify(resp), 200


def created(data: dict = None) -> tuple:
    resp = {'success': True}
    if data:
        resp.update(data)
    return jsonify(resp), 201


def bad(message: str, status: int = 400) -> tuple:
    return jsonify({'success': False, 'message': message}), status


def not_found(what: str = 'العنصر') -> tuple:
    return bad(f'{what} غير موجود', 404)


def forbidden() -> tuple:
    return bad('غير مصرح لك بهذا الإجراء', 403)


# ── Auth decorators ─────────────────────────────────────────────────────────────

def _get_token() -> str | None:
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:]
    return request.args.get('token')


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _get_token()
        if not token:
            return bad('مطلوب تسجيل الدخول', 401)
        payload = jwt_decode(token)
        if not payload:
            return bad('الجلسة منتهية أو غير صالحة', 401)
        user = UserModel.get_by_id(payload['sub'])
        if not user or user.get('status') != 'active':
            return bad('الحساب غير موجود أو معطّل', 401)
        g.current_user = user
        g.token_payload = payload
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    @wraps(f)
    @require_auth
    def decorated(*args, **kwargs):
        if g.current_user.get('role') != 'admin':
            return forbidden()
        return f(*args, **kwargs)
    return decorated


# ── Pagination helper ───────────────────────────────────────────────────────────

def paginate_args() -> tuple[int, int]:
    """Return (limit, offset) from query params."""
    try:
        page  = max(1, int(request.args.get('page', 1)))
        limit = min(100, max(1, int(request.args.get('limit', 20))))
    except (ValueError, TypeError):
        page, limit = 1, 20
    return limit, (page - 1) * limit
