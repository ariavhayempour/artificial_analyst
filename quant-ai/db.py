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


# ---------------------------------------------------------------------------
# Transactions CRUD. All run under the signed-in user's JWT; the table's
# user_id default (auth.uid()) + RLS keep each user scoped to their own rows.
# ---------------------------------------------------------------------------

def add_transaction(
    client,
    ticker: str,
    side: str,
    quantity,
    price_per_share,
    traded_at: str = None,
) -> dict:
    """Insert a buy/sell. Validates inputs client-side, then relies on RLS + DB
    checks. Returns ``{"data": [...]}`` or ``{"error": ...}`` (error-as-data)."""
    side = (side or "").lower()
    if side not in ("buy", "sell"):
        return {"error": "side must be 'buy' or 'sell'"}
    if not (ticker or "").strip():
        return {"error": "ticker is required"}
    try:
        quantity = float(quantity)
        price_per_share = float(price_per_share)
    except (TypeError, ValueError):
        return {"error": "quantity and price must be numbers"}
    if quantity <= 0:
        return {"error": "quantity must be greater than 0"}
    if price_per_share < 0:
        return {"error": "price must be 0 or greater"}

    row = {
        "ticker": ticker.upper().strip(),
        "side": side,
        "quantity": quantity,
        "price_per_share": price_per_share,
    }
    if traded_at:
        row["traded_at"] = traded_at
    try:
        resp = client.table("transactions").insert(row).execute()
        return {"data": resp.data}
    except Exception as e:
        return {"error": str(e)}


def list_transactions(client) -> list:
    """All of the signed-in user's transactions, oldest first. ``[]`` on failure."""
    try:
        resp = client.table("transactions").select("*").order("traded_at").execute()
        return resp.data or []
    except Exception:
        return []


def delete_transaction(client, transaction_id: str) -> dict:
    """Delete one of the user's transactions by id. Error-as-data on failure."""
    try:
        resp = (
            client.table("transactions").delete().eq("id", transaction_id).execute()
        )
        return {"data": resp.data}
    except Exception as e:
        return {"error": str(e)}
