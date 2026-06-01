"""Tests for the Streamlit app using Streamlit's headless AppTest harness."""
import os
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

APP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app.py")


def test_app_loads_without_error_and_shows_title():
    at = AppTest.from_file(APP).run()

    assert not at.exception
    assert any("Quant AI" in t.value for t in at.title)


def test_app_initializes_session_state():
    at = AppTest.from_file(APP).run()

    assert at.session_state["messages"] == []
    assert at.session_state["history"] == []


def test_chat_input_invokes_agent_and_stores_response():
    at = AppTest.from_file(APP)
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
    at = AppTest.from_file(APP)

    with patch("agent.run_agent", side_effect=RuntimeError("kaboom")):
        at.run()
        at.chat_input[0].set_value("x").run()

    assert not at.exception  # never crashes to a white screen
    assert any("kaboom" in e.value for e in at.error)
