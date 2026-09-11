"""
Vercel serverless entry point.
All requests go through this file.
"""
import sys
import os

# Add project root to path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

# Set VERCEL env only when actually running on Vercel
# (Vercel sets VERCEL=1 automatically in production)

from backend.app import app

# Vercel needs the app object at module level
