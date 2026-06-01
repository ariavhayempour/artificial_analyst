"""Shared test fixtures."""
import os
import sys

import pytest

# Make the project modules (tools.py, agent.py) importable.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Give the Anthropic/Finnhub clients dummy keys so module import succeeds in
# tests. No real network calls are made — the SDK clients are constructed but
# every API call is mocked at the boundary.
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("FINNHUB_API_KEY", "test-key")


@pytest.fixture(autouse=True)
def clear_tool_cache():
    """Clear the diskcache before each test so memoized results never leak
    across tests (each test patches the data source differently)."""
    import tools
    tools.cache.clear()
    yield
    tools.cache.clear()
