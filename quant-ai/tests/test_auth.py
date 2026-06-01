"""Tests for the auth helpers in db.py.

The Supabase client is a hand-rolled fake injected into each helper — no network,
no patching. We verify the returned data (error-as-data), not internal calls.
"""
from types import SimpleNamespace

import db


def _client(*, auth):
    return SimpleNamespace(auth=auth)


def _resp_with_user(user_id):
    return SimpleNamespace(user=SimpleNamespace(id=user_id))


class _Auth:
    """Fake Supabase auth namespace; methods return canned values or raise."""

    def __init__(self, *, signin=None, signup=None, error=None):
        self._signin = signin
        self._signup = signup
        self._error = error
        self.signed_out = False

    def sign_in_with_password(self, creds):
        if self._error:
            raise self._error
        return self._signin

    def sign_up(self, creds):
        if self._error:
            raise self._error
        return self._signup

    def sign_out(self):
        self.signed_out = True


# ---- sign_in --------------------------------------------------------------

def test_sign_in_returns_user_id_on_success():
    client = _client(auth=_Auth(signin=_resp_with_user("user-1")))

    result = db.sign_in(client, "me@example.com", "pw")

    assert result == {"user_id": "user-1"}


def test_sign_in_returns_error_on_bad_credentials():
    client = _client(auth=_Auth(error=Exception("Invalid login credentials")))

    result = db.sign_in(client, "me@example.com", "wrong")

    assert "error" in result
    assert "user_id" not in result


# ---- sign_up --------------------------------------------------------------

def test_sign_up_returns_user_id_on_success():
    client = _client(auth=_Auth(signup=_resp_with_user("user-2")))

    result = db.sign_up(client, "new@example.com", "pw")

    assert result == {"user_id": "user-2"}


def test_sign_up_maps_allowlist_rejection_to_friendly_error():
    # The DB trigger raises this when an email is not on the allowlist.
    client = _client(auth=_Auth(error=Exception("Email x is not authorized to sign up")))

    result = db.sign_up(client, "stranger@example.com", "pw")

    assert "error" in result
    assert "authorized" in result["error"].lower()


def test_sign_up_returns_error_when_no_user_created():
    client = _client(auth=_Auth(signup=SimpleNamespace(user=None)))

    result = db.sign_up(client, "new@example.com", "pw")

    assert "error" in result


# ---- sign_out -------------------------------------------------------------

def test_sign_out_calls_client_and_never_raises():
    auth = _Auth()
    client = _client(auth=auth)

    db.sign_out(client)  # must not raise

    assert auth.signed_out is True
