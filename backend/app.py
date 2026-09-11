"""
PERFUIM - app.py
Flask application entry point.

Usage:
    python backend/app.py            # development
    flask --app backend.app run      # flask CLI

Environment variables:
    JWT_SECRET   - Secret key for JWT signing (change in production!)
    PORT         - Port to listen on (default 5000)
    FLASK_ENV    - 'development' | 'production'
"""

import os
import sys

# Make sure the project root is on the path so 'backend.*' imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from backend.database.database import init_db
from backend.routes.auth      import auth_bp
from backend.routes.products  import products_bp
from backend.routes.orders    import orders_bp
from backend.routes.users     import users_bp
from backend.routes.offers    import offers_bp
from backend.routes.packages  import packages_bp
from backend.routes.admin     import admin_bp


# ── Factory ─────────────────────────────────────────────────────────────────────
def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder  = os.path.join(os.path.dirname(os.path.dirname(__file__))),
        static_url_path= '',
    )

    # ── Config ──────────────────────────────────────────────────────────────────
    app.config['SECRET_KEY']       = os.environ.get('JWT_SECRET', 'perfuim-dev-secret')
    app.config['JSON_AS_ASCII']    = False
    app.config['JSONIFY_MIMETYPE'] = 'application/json; charset=utf-8'

    # ── CORS ────────────────────────────────────────────────────────────────────
    CORS(app, resources={r'/api/*': {'origins': '*'}})

    # ── Blueprints ───────────────────────────────────────────────────────────────
    for bp in (auth_bp, products_bp, orders_bp, users_bp,
               offers_bp, packages_bp, admin_bp):
        app.register_blueprint(bp)

    # ── Database init ────────────────────────────────────────────────────────────
    with app.app_context():
        init_db()

    # ── Static file serving ──────────────────────────────────────────────────────
    BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    @app.route('/')
    def index():
        return send_from_directory(os.path.join(BASE, 'frontend'), 'index.html')

    # ── روابط مباشرة لصفحات الفرونتند بدون /frontend/ في الـ URL ──────────────
    @app.route('/products.html')
    def products_page():
        return send_from_directory(os.path.join(BASE, 'frontend'), 'products.html')

    @app.route('/product-details.html')
    def product_details_page():
        return send_from_directory(os.path.join(BASE, 'frontend'), 'product-details.html')

    @app.route('/cart.html')
    def cart_page():
        return send_from_directory(os.path.join(BASE, 'frontend'), 'cart.html')

    @app.route('/checkout.html')
    def checkout_page():
        return send_from_directory(os.path.join(BASE, 'frontend'), 'checkout.html')

    @app.route('/login.html')
    def login_page():
        return send_from_directory(os.path.join(BASE, 'frontend'), 'login.html')

    @app.route('/register.html')
    def register_page():
        return send_from_directory(os.path.join(BASE, 'frontend'), 'register.html')

    @app.route('/frontend/<path:filename>')
    def frontend_files(filename):
        return send_from_directory(os.path.join(BASE, 'frontend'), filename)

    @app.route('/admin/')
    @app.route('/admin/<path:filename>')
    def admin_files(filename='index.html'):
        return send_from_directory(os.path.join(BASE, 'admin'), filename)

    @app.route('/css/<path:filename>')
    def css_files(filename):
        return send_from_directory(os.path.join(BASE, 'css'), filename)

    @app.route('/js/<path:filename>')
    def js_files(filename):
        return send_from_directory(os.path.join(BASE, 'js'), filename)

    @app.route('/images/<path:filename>')
    def image_files(filename):
        return send_from_directory(os.path.join(BASE, 'images'), filename)

    # ── Error handlers ───────────────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'success': False, 'message': 'المسار غير موجود'}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({'success': False, 'message': 'الطريقة غير مسموح بها'}), 405

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'success': False, 'message': 'خطأ داخلي في الخادم'}), 500

    # ── Health check ─────────────────────────────────────────────────────────────
    @app.get('/api/health')
    def health():
        return jsonify({'status': 'ok', 'app': 'PERFUIM', 'version': '1.0.0'})

    return app


# ── Run ──────────────────────────────────────────────────────────────────────────
app = create_app()

if __name__ == '__main__':
    port  = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    print(f"\n  PERFUIM Store running at http://localhost:{port}\n")
    app.run(host='0.0.0.0', port=port, debug=debug)
