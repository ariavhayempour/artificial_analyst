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


_NOT_AUTHORIZED = (
    "This email is not authorized to sign up. "
    "Ask an admin to add you to the allowlist."
)


def _friendly_auth_error(exc: Exception) -> str:
    """Map raw Supabase auth errors to a user-facing message.

    The invite-only allowlist is enforced by a database trigger; when it blocks a
    sign-up the failure surfaces here, so we translate it into a clear hint.
    """
    msg = str(exc)
    low = msg.lower()
    if (
        "not authorized" in low
        or "allowlist" in low
        or "database error saving new user" in low
    ):
        return _NOT_AUTHORIZED
    return msg or "Authentication failed."


def sign_in(client, email: str, password: str) -> dict:
    """Sign in with email/password. Returns ``{"user_id": ...}`` or ``{"error": ...}``."""
    try:
        resp = client.auth.sign_in_with_password(
            {"email": email, "password": password}
        )
    except Exception as e:
        return {"error": _friendly_auth_error(e)}
    if not getattr(resp, "user", None):
        return {"error": "Invalid email or password."}
    return {"user_id": resp.user.id}


def sign_up(client, email: str, password: str) -> dict:
    """Register a new user. Non-allowlisted emails are rejected by the DB trigger.

    Returns ``{"user_id": ...}`` on success or ``{"error": ...}`` (error-as-data).
    """
    try:
        resp = client.auth.sign_up({"email": email, "password": password})
    except Exception as e:
        return {"error": _friendly_auth_error(e)}
    if not getattr(resp, "user", None):
        return {"error": "Sign-up failed — please try again."}
    return {"user_id": resp.user.id}


def sign_out(client) -> None:
    """Best-effort sign-out; never raises (logging out should always 'work')."""
    try:
        client.auth.sign_out()
    except Exception:
        pass
