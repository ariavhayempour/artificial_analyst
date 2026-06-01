"""Tests for the Claude agentic loop."""
from unittest.mock import MagicMock, patch

import agent
from agent import run_agent


def _text_block(text):
    b = MagicMock()
    b.type = "text"
    b.text = text
    return b


def _tool_use_block(name, inp, block_id="tool_1"):
    b = MagicMock()
    b.type = "tool_use"
    b.name = name
    b.input = inp
    b.id = block_id
    return b


def _resp(stop_reason, content):
    r = MagicMock()
    r.stop_reason = stop_reason
    r.content = content
    return r


def test_run_agent_returns_text_on_end_turn():
    fake = _resp("end_turn", [_text_block("AAPL analysis here.")])

    with patch("agent.client.messages.create", return_value=fake) as create:
        text, messages = run_agent("Hi")

    assert text == "AAPL analysis here."
    assert messages[0] == {"role": "user", "content": "Hi"}
    assert messages[-1]["role"] == "assistant"
    create.assert_called_once()
    _, kwargs = create.call_args
    assert kwargs["model"] == "claude-opus-4-8"
    assert kwargs["max_tokens"] == 4096
    assert kwargs["system"] == agent.SYSTEM_PROMPT
    assert kwargs["tools"] == agent.TOOLS


def test_run_agent_executes_tool_then_returns_final_text():
    first = _resp("tool_use", [_tool_use_block("get_stock_data", {"ticker": "AAPL"})])
    second = _resp("end_turn", [_text_block("AAPL looks bullish.")])
    fake_tool = MagicMock(return_value={"ticker": "AAPL", "price": 100.0})

    with patch("agent.client.messages.create", side_effect=[first, second]) as create, \
         patch.dict("agent.TOOL_MAP", {"get_stock_data": fake_tool}):
        text, messages = run_agent("Analyze AAPL")

    fake_tool.assert_called_once_with(ticker="AAPL")
    assert text == "AAPL looks bullish."
    assert create.call_count == 2
    # messages: [user, assistant(tool_use), user(tool_result), assistant(text)]
    tool_result_msg = messages[2]
    assert tool_result_msg["role"] == "user"
    block = tool_result_msg["content"][0]
    assert block["type"] == "tool_result"
    assert block["tool_use_id"] == "tool_1"
    assert "100.0" in block["content"]


def test_run_agent_passes_tool_error_as_data():
    first = _resp("tool_use", [_tool_use_block("get_stock_data", {"ticker": "X"})])
    second = _resp("end_turn", [_text_block("done")])
    failing = MagicMock(side_effect=RuntimeError("boom"))

    with patch("agent.client.messages.create", side_effect=[first, second]), \
         patch.dict("agent.TOOL_MAP", {"get_stock_data": failing}):
        _, messages = run_agent("x")

    block = messages[2]["content"][0]
    assert "boom" in block["content"]


def test_system_prompt_and_tools_defined():
    assert "elite quantitative analyst" in agent.SYSTEM_PROMPT
    names = [t["name"] for t in agent.TOOLS]
    assert "get_stock_data" in names
    assert agent.TOOL_MAP["get_stock_data"] is not None


def test_data_tools_require_ticker():
    by_name = {t["name"]: t for t in agent.TOOLS}
    for name in ("get_stock_data", "analyze_technicals", "get_options_chain", "get_market_news"):
        schema = by_name[name]["input_schema"]
        assert "ticker" in schema["properties"]
        assert schema["required"] == ["ticker"]


def test_get_portfolio_registered_without_ticker():
    by_name = {t["name"]: t for t in agent.TOOLS}
    assert "get_portfolio" in by_name
    schema = by_name["get_portfolio"]["input_schema"]
    # The user identifier is injected at dispatch, never exposed to the model.
    assert "ticker" not in schema["properties"]
    assert "user_id" not in schema["properties"]
    assert schema["required"] == []
    assert agent.TOOL_MAP["get_portfolio"] is not None


def test_tool_schemas_expose_their_distinct_parameters():
    by_name = {t["name"]: t for t in agent.TOOLS}
    assert "indicators" in by_name["analyze_technicals"]["input_schema"]["properties"]
    assert "expiration" in by_name["get_options_chain"]["input_schema"]["properties"]
    assert "strike_range_pct" in by_name["get_options_chain"]["input_schema"]["properties"]
    assert "days_back" in by_name["get_market_news"]["input_schema"]["properties"]


def test_tool_map_binds_all_functions():
    from tools import (
        analyze_technicals,
        get_market_news,
        get_options_chain,
        get_portfolio,
        get_stock_data,
    )

    assert agent.TOOL_MAP == {
        "get_stock_data": get_stock_data,
        "analyze_technicals": analyze_technicals,
        "get_options_chain": get_options_chain,
        "get_market_news": get_market_news,
        "get_portfolio": get_portfolio,
    }


def test_get_portfolio_dispatch_injects_user_id_and_ignores_model_input():
    # The model tries to pass a forged user_id; the loop must override it.
    first = _resp("tool_use", [_tool_use_block("get_portfolio", {"user_id": "ATTACKER"})])
    second = _resp("end_turn", [_text_block("Your book is concentrated in NVDA.")])
    spy = MagicMock(return_value={"positions": []})

    with patch("agent.client.messages.create", side_effect=[first, second]), \
         patch.dict("agent.TOOL_MAP", {"get_portfolio": spy}):
        run_agent("How is my portfolio?", user_id="real-user-123")

    spy.assert_called_once_with(user_id="real-user-123")


def test_run_agent_does_not_mutate_default_history():
    fake = _resp("end_turn", [_text_block("ok")])

    with patch("agent.client.messages.create", return_value=fake):
        run_agent("first")
        _, msgs2 = run_agent("second")

    # The default history arg must not accumulate across calls.
    assert msgs2[0] == {"role": "user", "content": "second"}
    assert not any(m.get("content") == "first" for m in msgs2)
