"""
Elhiko - app.py
Flask entry point using SQLite.
"""
import os
import sys

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

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def create_app() -> Flask:
    app = Flask(__name__, static_folder=BASE, static_url_path='')
    app.config['SECRET_KEY']       = os.environ.get('JWT_SECRET', 'elhiko-secret')
    app.config['JSON_AS_ASCII']    = False
    app.config['JSONIFY_MIMETYPE'] = 'application/json; charset=utf-8'

    CORS(app, resources={r'/api/*': {'origins': '*'}})

    for bp in (auth_bp, products_bp, orders_bp, users_bp, offers_bp, packages_bp, admin_bp):
        app.register_blueprint(bp)

    with app.app_context():
        init_db()

    PAGES = {
        '/':                     'index.html',
        '/products.html':        'products.html',
        '/product-details.html': 'product-details.html',
        '/cart.html':            'cart.html',
        '/checkout.html':        'checkout.html',
        '/login.html':           'login.html',
        '/register.html':        'register.html',
    }

    def _make(fname):
        def view(): return send_from_directory(os.path.join(BASE,'frontend'), fname)
        view.__name__ = f'page_{fname.replace(".","_")}'
        return view

    for route, fname in PAGES.items():
        app.add_url_rule(route, view_func=_make(fname))

    @app.route('/frontend/<path:f>')
    def frontend_files(f): return send_from_directory(os.path.join(BASE,'frontend'), f)

    @app.route('/admin/')
    @app.route('/admin/<path:f>')
    def admin_files(f='index.html'): return send_from_directory(os.path.join(BASE,'admin'), f)

    @app.route('/css/<path:f>')
    def css_files(f): return send_from_directory(os.path.join(BASE,'css'), f)

    @app.route('/js/<path:f>')
    def js_files(f): return send_from_directory(os.path.join(BASE,'js'), f)

    @app.route('/images/<path:f>')
    def image_files(f): return send_from_directory(os.path.join(BASE,'images'), f)

    @app.errorhandler(404)
    def not_found(e):
        try: return send_from_directory(os.path.join(BASE,'frontend'), 'index.html')
        except: return jsonify({'success':False,'message':'Not found'}), 404

    @app.errorhandler(500)
    def server_error(e): return jsonify({'success':False,'message':'Server error'}), 500

    @app.get('/api/health')
    def health(): return jsonify({'status':'ok','app':'Elhiko','db':'sqlite'})

    return app


app = create_app()

if __name__ == '__main__':
    port  = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV','development') == 'development'
    print(f'\n  Elhiko running at http://localhost:{port}\n')
    app.run(host='0.0.0.0', port=port, debug=debug)
