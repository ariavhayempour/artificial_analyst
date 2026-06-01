# HOW TO RUN
# 1. cd quant-ai
# 2. source venv/bin/activate  (or venv\Scripts\activate on Windows)
# 3. cp .env.example .env      (then fill in your API keys)
# 4. pip install -r requirements.txt
# 5. streamlit run app.py
# Opens at http://localhost:8501
"""Streamlit UI for the Quant AI assistant.

A dark-themed chat surface with a sidebar of one-click analysis modes. Both the
sidebar Run button and the free-text chat input simply append a user message;
a single response step then answers any trailing, unanswered user message — so
the two entry points share one code path.
"""
import streamlit as st

from agent import run_agent

st.set_page_config(
    page_title="Quant AI",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    .stApp {
        background-color: #0a0f1e;
        color: #e2e8f0;
    }
    [data-testid="stSidebar"] {
        background-color: #111827;
        border-right: 1px solid #1e293b;
    }
    .stChatMessage {
        background: #131929 !important;
        border-radius: 8px;
    }
    .stTextInput > div > input {
        background: #1e2d4f;
        color: #e2e8f0;
        border-color: #334155;
    }
    .stSelectbox > div > div {
        background: #1e2d4f;
        color: #e2e8f0;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# --- session state ---------------------------------------------------------
if "messages" not in st.session_state:
    st.session_state.messages = []      # display list: {role, content}
if "history" not in st.session_state:
    st.session_state.history = []       # agent conversation history

# --- header ----------------------------------------------------------------
st.title("📈 Quant AI")
st.caption("Claude-powered quantitative analysis · US equities & options · real-time market data")

PROMPTS = {
    "Full breakdown":
        "Give me a complete analysis of {t}. Fetch current price, run technical analysis, "
        "pull fundamentals and recent news, then give me your top recommendation with a "
        "specific entry price, price target, stop-loss, and risk/reward ratio.",

    "Best options play right now":
        "What is the best options trade on {t} right now? Fetch the options chain and check "
        "current implied volatility. Recommend a specific strategy with exact strike(s), "
        "expiration date, estimated debit or credit, maximum loss, and your reasoning.",

    "Technical analysis only":
        "Run a full technical analysis on {t}. I want RSI, MACD, Bollinger Bands, all key "
        "SMA levels, and the most important support and resistance zones. Tell me whether "
        "the technical picture is bullish, bearish, or neutral and what level to watch.",

    "Earnings setup & IV risk":
        "Analyze {t} as an earnings trade. When is the next earnings date? What is the "
        "implied volatility situation right now? What options strategy makes the most sense "
        "given current IV, and what is the IV crush risk after earnings?",

    "Compare to closest peers":
        "Compare {t} to its 3 closest publicly traded competitors. Fetch data on {t} and "
        "compare P/E, forward P/E, PEG ratio, revenue growth, and earnings growth. "
        "Is {t} cheap or expensive relative to the group? Which would you buy?",
}

# --- sidebar: quick analysis ----------------------------------------------
with st.sidebar:
    st.header("Quick analysis")
    ticker = st.text_input("Ticker", placeholder="e.g. NVDA").upper().strip()
    mode = st.selectbox("Analysis type", list(PROMPTS.keys()))

    if st.button("▶  Run", use_container_width=True):
        if ticker:
            st.session_state.messages.append(
                {"role": "user", "content": PROMPTS[mode].format(t=ticker)}
            )
            st.rerun()

    st.divider()

    if st.button("🗑  Clear chat", use_container_width=True):
        st.session_state.messages = []
        st.session_state.history = []
        st.rerun()

# --- chat history ----------------------------------------------------------
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# --- free-text input -------------------------------------------------------
if prompt := st.chat_input("Ask about any stock or options trade..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

# --- answer any trailing, unanswered user message --------------------------
# Shared by both the Run button and the chat input: if the last message is from
# the user and has no assistant reply yet, run the agent now.
if st.session_state.messages and st.session_state.messages[-1]["role"] == "user":
    pending = st.session_state.messages[-1]["content"]
    with st.chat_message("assistant"):
        try:
            with st.spinner("Fetching market data & analyzing..."):
                response_text, st.session_state.history = run_agent(
                    pending, st.session_state.history
                )
            st.markdown(response_text)
            st.session_state.messages.append(
                {"role": "assistant", "content": response_text}
            )
        except Exception as e:
            st.error(f"Analysis failed: {e}")
