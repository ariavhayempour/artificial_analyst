"""Tests for the Streamlit app using Streamlit's headless AppTest harness."""
import os
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

APP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app.py")


def _authed(at):
    """Seed an authenticated session so the app renders the dashboard, not login."""
    at.session_state["user_id"] = "u-test"
    return at


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
