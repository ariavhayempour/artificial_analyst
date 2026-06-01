"""Tests for the Supabase access layer (db.py).

No real network calls: the Supabase client constructor is patched at the
boundary. These cover the client factory's configuration handling.
"""
import pytest

import db


def test_get_client_raises_clear_error_when_env_missing(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)

    with pytest.raises(RuntimeError) as exc:
        db.get_client()

    # The error must name the missing config so the user knows what to fix.
    assert "SUPABASE_URL" in str(exc.value)
    assert "SUPABASE_ANON_KEY" in str(exc.value)


def test_get_client_raises_when_only_url_set(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://demo.supabase.co")
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)

    with pytest.raises(RuntimeError):
        db.get_client()


def test_get_client_builds_client_from_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://demo.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key-123")
    sentinel = object()
    captured = {}

    def fake_create_client(url, key):
        captured["url"] = url
        captured["key"] = key
        return sentinel

    monkeypatch.setattr(db, "create_client", fake_create_client)

    client = db.get_client()

    assert client is sentinel
    assert captured == {"url": "https://demo.supabase.co", "key": "anon-key-123"}
