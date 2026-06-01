"""Tests for the Streamlit app using Streamlit's headless AppTest harness."""
import os
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

APP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app.py")


def _authed(at):
    """Seed an authenticated session so the app renders the dashboard, not login."""
    at.session_state["user_id"] = "u-test"
    return at


def _by_key(widgets, key):
    """Find a widget by its key (labels can collide across tabs/sidebar)."""
    return next(w for w in widgets if w.key == key)


def _buy(ticker="NVDA", qty=10, price=100.0, traded_at="2026-01-01", id="t1"):
    return {
        "id": id,
        "ticker": ticker,
        "side": "buy",
        "quantity": qty,
        "price_per_share": price,
        "traded_at": traded_at,
    }


def _sell(ticker="NVDA", qty=4, price=130.0, traded_at="2026-02-01", id="t2"):
    return {
        "id": id,
        "ticker": ticker,
        "side": "sell",
        "quantity": qty,
        "price_per_share": price,
        "traded_at": traded_at,
    }


# ---- auth gate ------------------------------------------------------------

def test_unauthenticated_user_sees_login_not_dashboard():
    at = AppTest.from_file(APP).run()

    assert not at.exception
    assert "user_id" not in at.session_state
    # No chat surface before sign-in...
    assert len(at.chat_input) == 0
    # ...but a sign-in button is offered.
    assert any("Sign in" in b.label for b in at.button)


def test_successful_sign_in_sets_session_and_shows_dashboard():
    at = AppTest.from_file(APP)

    with patch("db.get_client", return_value=object()), \
         patch("db.sign_in", return_value={"user_id": "u-1"}) as si:
        at.run()
        at.text_input[0].set_value("me@example.com")  # login email
        at.text_input[1].set_value("pw")              # login password
        at.button[0].click().run()                    # Sign in

    si.assert_called_once()
    assert at.session_state["user_id"] == "u-1"
    # Dashboard now renders: the chat surface is present.
    assert len(at.chat_input) == 1


def test_non_allowlisted_signup_shows_friendly_error():
    at = AppTest.from_file(APP)

    err = {"error": "This email is not authorized to sign up. Ask an admin..."}
    with patch("db.get_client", return_value=object()), \
         patch("db.sign_up", return_value=err):
        at.run()
        at.text_input[2].set_value("stranger@example.com")  # signup email
        at.text_input[3].set_value("pw")                    # signup password
        at.button[1].click().run()                          # Create account

    assert "user_id" not in at.session_state
    assert any("authorized" in e.value.lower() for e in at.error)


def test_logout_clears_session_and_returns_to_login():
    at = _authed(AppTest.from_file(APP))

    with patch("agent.run_agent", return_value=("resp", [{"role": "assistant", "content": "ctx"}])), \
         patch("db.sign_out") as so:
        at.run()
        at.chat_input[0].set_value("hi").run()
        assert at.session_state["messages"]            # populated
        at.sidebar.button[2].click().run()             # Log out

    so.assert_called_once()
    assert "user_id" not in at.session_state
    assert "messages" not in at.session_state


# ---- dashboard (authenticated) -------------------------------------------

def test_app_loads_without_error_and_shows_title():
    at = _authed(AppTest.from_file(APP)).run()

    assert not at.exception
    assert any("Quant AI" in t.value for t in at.title)


def test_app_initializes_session_state():
    at = _authed(AppTest.from_file(APP)).run()

    assert at.session_state["messages"] == []
    assert at.session_state["history"] == []


def test_chat_input_invokes_agent_and_stores_response():
    at = _authed(AppTest.from_file(APP))
    updated_history = [{"role": "assistant", "content": "ctx"}]

    with patch("agent.run_agent", return_value=("**Buy AAPL**", updated_history)) as ra:
        at.run()
        at.chat_input[0].set_value("Analyze AAPL").run()

    ra.assert_called_once()
    # user prompt + assistant response both recorded for display
    assert {"role": "user", "content": "Analyze AAPL"} in at.session_state["messages"]
    assert any(
        m["role"] == "assistant" and "Buy AAPL" in m["content"]
        for m in at.session_state["messages"]
    )
    # agent's updated history is threaded back into session state
    assert at.session_state["history"] == updated_history


def test_chat_input_shows_friendly_error_on_agent_failure():
    at = _authed(AppTest.from_file(APP))

    with patch("agent.run_agent", side_effect=RuntimeError("kaboom")):
        at.run()
        at.chat_input[0].set_value("x").run()

    assert not at.exception  # never crashes to a white screen
    assert any("kaboom" in e.value for e in at.error)


# ---- theming + sidebar quick-analysis -------------------------------------

EXPECTED_MODES = [
    "Full breakdown",
    "Best options play right now",
    "Technical analysis only",
    "Earnings setup & IV risk",
    "Compare to closest peers",
]


def test_dark_theme_css_injected():
    at = AppTest.from_file(APP).run()  # CSS is injected before the auth gate
    assert any("#0a0f1e" in md.value for md in at.markdown)


def test_sidebar_offers_the_five_analysis_modes():
    at = _authed(AppTest.from_file(APP)).run()
    assert at.sidebar.selectbox[0].options == EXPECTED_MODES


def test_run_button_sends_mode_prompt_to_agent():
    at = _authed(AppTest.from_file(APP))

    with patch("agent.run_agent", return_value=("**verdict**", [])) as ra:
        at.run()
        at.sidebar.text_input[0].set_value("nvda")
        at.sidebar.button[0].click().run()  # Run (mode defaults to Full breakdown)

    ra.assert_called_once()
    sent_prompt = ra.call_args.args[0]
    assert "NVDA" in sent_prompt                       # ticker uppercased into prompt
    assert "complete analysis of NVDA" in sent_prompt  # the Full breakdown template
    assert any(
        m["role"] == "assistant" and "verdict" in m["content"]
        for m in at.session_state["messages"]
    )


def test_run_button_is_noop_when_ticker_empty():
    at = _authed(AppTest.from_file(APP))

    with patch("agent.run_agent") as ra:
        at.run()
        at.sidebar.button[0].click().run()  # Run with no ticker

    ra.assert_not_called()
    assert at.session_state["messages"] == []


def test_clear_button_resets_chat_and_history():
    at = _authed(AppTest.from_file(APP))

    with patch("agent.run_agent", return_value=("resp", [{"role": "assistant", "content": "ctx"}])):
        at.run()
        at.chat_input[0].set_value("hi").run()
        assert at.session_state["messages"]  # populated
        at.sidebar.button[1].click().run()    # Clear

    assert at.session_state["messages"] == []
    assert at.session_state["history"] == []


# ---- positions dashboard --------------------------------------------------

def test_add_transaction_form_submits_to_db():
    at = _authed(AppTest.from_file(APP))

    with patch("db.list_transactions", return_value=[]), \
         patch("db.add_transaction", return_value={"data": [{"id": "t1"}]}) as add:
        at.run()
        _by_key(at.text_input, "tx_ticker").set_value("nvda")
        _by_key(at.number_input, "tx_qty").set_value(10.0)
        _by_key(at.number_input, "tx_price").set_value(100.0)
        _by_key(at.button, "add_tx").click().run()

    add.assert_called_once()
    _sb, ticker, side, qty, price, _date = add.call_args.args
    assert (ticker, side, qty, price) == ("nvda", "buy", 10.0, 100.0)


def test_positions_tab_shows_live_pnl_and_totals():
    at = _authed(AppTest.from_file(APP))

    with patch("db.list_transactions", return_value=[_buy()]), \
         patch("tools.get_stock_data", return_value={"ticker": "NVDA", "price": 120.0}) as gsd:
        at.run()

    gsd.assert_called()  # live price was fetched for the held ticker
    metrics = " ".join(m.value for m in at.metric)
    assert "1,200.00" in metrics   # 10 shares * $120 market value
    assert "200.00" in metrics     # unrealized P&L = 1200 - 1000
    holdings = at.dataframe[0].value
    assert "NVDA" in list(holdings["Ticker"])


def test_positions_tab_degrades_gracefully_on_price_failure():
    at = _authed(AppTest.from_file(APP))

    with patch("db.list_transactions", return_value=[_buy()]), \
         patch("tools.get_stock_data", return_value={"ticker": "NVDA", "error": "rate limited"}):
        at.run()

    assert not at.exception          # no crash when the quote is unavailable
    holdings = at.dataframe[0].value
    assert "NVDA" in list(holdings["Ticker"])
    assert "—" in list(holdings["Price"])  # price shown as a placeholder


def test_positions_tab_empty_state_when_no_holdings():
    at = _authed(AppTest.from_file(APP))

    with patch("db.list_transactions", return_value=[]):
        at.run()

    assert not at.exception
    assert any("No open positions" in i.value for i in at.info)


# ---- realized tab + trade history -----------------------------------------

def test_realized_tab_shows_total_realized_pnl():
    at = _authed(AppTest.from_file(APP))

    with patch("db.list_transactions", return_value=[_buy(), _sell()]), \
         patch("tools.get_stock_data", return_value={"ticker": "NVDA", "error": "skip"}):
        at.run()

    # Only the Realized tab produces a $120.00 figure (positions totals are $0 here).
    assert any("120.00" in m.value for m in at.metric)


def test_trade_history_delete_removes_transaction():
    at = _authed(AppTest.from_file(APP))

    with patch("db.list_transactions", return_value=[_buy(), _sell()]), \
         patch("tools.get_stock_data", return_value={"ticker": "NVDA", "error": "skip"}), \
         patch("db.delete_transaction", return_value={"data": []}) as dele:
        at.run()
        _by_key(at.button, "del_t2").click().run()

    dele.assert_called_once()
    assert dele.call_args.args[1] == "t2"


def test_realized_tab_empty_state_when_no_trades():
    at = _authed(AppTest.from_file(APP))

    with patch("db.list_transactions", return_value=[]):
        at.run()

    assert not at.exception
    assert any("No trades yet" in i.value for i in at.info)
