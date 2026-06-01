"""Supabase access layer: client factory (auth + transaction CRUD land here later).

Data operations run under the signed-in user's JWT so Postgres row-level security
is the real boundary. The client factory raises a clear, actionable error when
configuration is missing rather than failing with an obscure traceback.
"""
import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(override=True)  # .env is the source of truth, even over stale shell vars


def get_client() -> Client:
    """Build a Supabase client from environment configuration.

    Reads ``SUPABASE_URL`` and ``SUPABASE_ANON_KEY`` at call time (not import) so
    tests and runtime config changes are honored. Raises ``RuntimeError`` naming
    the missing keys if either is absent.
    """
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env "
            "(copy .env.example to .env and fill in your Supabase project values)."
        )
    return create_client(url, key)
