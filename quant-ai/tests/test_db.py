"""Tests for the Supabase access layer (db.py).

No real network calls: the Supabase client constructor is patched at the
boundary. These cover the client factory's configuration handling and the
transactions CRUD, which is exercised against a hand-rolled fake client that
records the PostgREST call chain.
"""
import pytest

import db


class _Resp:
    def __init__(self, data):
        self.data = data


class _Table:
    """Fake PostgREST query builder; records calls, returns canned execute data."""

    def __init__(self, parent):
        self._parent = parent

    def insert(self, row):
        self._parent.calls.append(("insert", row))
        return self

    def select(self, *args):
        self._parent.calls.append(("select", args))
        return self

    def delete(self):
        self._parent.calls.append(("delete", None))
        return self

    def eq(self, col, val):
        self._parent.calls.append(("eq", (col, val)))
        return self

    def order(self, *args, **kwargs):
        return self

    def execute(self):
        if self._parent.raise_on_execute:
            raise self._parent.raise_on_execute
        return _Resp(self._parent.execute_data)


class _FakeClient:
    def __init__(self, execute_data=None, raise_on_execute=None):
        self.execute_data = execute_data
        self.raise_on_execute = raise_on_execute
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return _Table(self)


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


# ---- transactions CRUD ----------------------------------------------------

def test_add_transaction_inserts_uppercased_row_and_returns_data():
    client = _FakeClient(execute_data=[{"id": "t1"}])

    result = db.add_transaction(client, "nvda", "buy", 10, 100.0, "2026-01-01")

    assert result == {"data": [{"id": "t1"}]}
    inserted = next(row for op, row in client.calls if op == "insert")
    assert inserted == {
        "ticker": "NVDA",
        "side": "buy",
        "quantity": 10.0,
        "price_per_share": 100.0,
        "traded_at": "2026-01-01",
    }


def test_add_transaction_rejects_invalid_side_without_touching_db():
    client = _FakeClient()

    result = db.add_transaction(client, "nvda", "hold", 10, 100.0)

    assert "error" in result
    assert client.calls == []  # never reached the database


def test_add_transaction_rejects_nonpositive_quantity():
    client = _FakeClient()

    result = db.add_transaction(client, "nvda", "buy", 0, 100.0)

    assert "error" in result
    assert client.calls == []


def test_add_transaction_returns_error_as_data_on_db_failure():
    client = _FakeClient(raise_on_execute=Exception("insert violates policy"))

    result = db.add_transaction(client, "nvda", "buy", 10, 100.0)

    assert "error" in result
    assert "user_id" not in result


def test_list_transactions_returns_rows():
    rows = [{"id": "t1", "ticker": "NVDA"}, {"id": "t2", "ticker": "AAPL"}]
    client = _FakeClient(execute_data=rows)

    assert db.list_transactions(client) == rows


def test_list_transactions_returns_empty_list_on_failure():
    client = _FakeClient(raise_on_execute=Exception("boom"))

    assert db.list_transactions(client) == []


def test_delete_transaction_filters_by_id():
    client = _FakeClient(execute_data=[{"id": "t1"}])

    result = db.delete_transaction(client, "t1")

    assert "data" in result
    assert ("delete", None) in client.calls
    assert ("eq", ("id", "t1")) in client.calls
