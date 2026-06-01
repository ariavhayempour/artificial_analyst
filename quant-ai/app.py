# HOW TO RUN
# 1. cd quant-ai
# 2. source venv/bin/activate  (or venv\Scripts\activate on Windows)
# 3. cp .env.example .env      (then fill in your API + Supabase keys)
# 4. pip install -r requirements.txt
# 5. apply supabase/migrations/0001_init.sql to your Supabase project and seed
#    your email into the allowlist table
# 6. streamlit run app.py
# Opens at http://localhost:8501
"""Streamlit UI for the Quant AI trading terminal.

Access is gated by Supabase email/password auth behind an invite-only allowlist.
Once signed in, a Schwab-style dashboard is shown across three tabs: Positions
(holdings with live P&L + an add-transaction form), Realized, and Chat (the
portfolio-aware agent). Both the sidebar Run button and the chat input append a
user message; a single response step answers any trailing, unanswered message.
"""
import pandas as pd
import streamlit as st

import db
import portfolio
from agent import run_agent
from tools import get_stock_data

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

# --- authentication gate ---------------------------------------------------
# Until a user is signed in, show ONLY the login / signup form. The signed-in
# user_id and the authed Supabase client (carrying the user JWT, for RLS-scoped
# data ops) live in session state.
if "user_id" not in st.session_state:
    st.title("📈 Quant AI")
    st.caption("Sign in to your trading terminal")

    tab_in, tab_up = st.tabs(["Sign in", "Sign up"])

    with tab_in:
        email = st.text_input("Email", key="login_email")
        password = st.text_input("Password", type="password", key="login_pw")
        if st.button("Sign in", use_container_width=True):
            try:
                client = db.get_client()
            except RuntimeError as e:
                st.error(str(e))
            else:
                result = db.sign_in(client, email, password)
                if "error" in result:
                    st.error(result["error"])
                else:
                    st.session_state.user_id = result["user_id"]
                    st.session_state.sb = client
                    st.rerun()

    with tab_up:
        su_email = st.text_input("Email", key="signup_email")
        su_password = st.text_input("Password", type="password", key="signup_pw")
        st.caption("Sign-up is invite-only — your email must be on the allowlist.")
        if st.button("Create account", use_container_width=True):
            try:
                client = db.get_client()
            except RuntimeError as e:
                st.error(str(e))
            else:
                result = db.sign_up(client, su_email, su_password)
                if "error" in result:
                    st.error(result["error"])
                else:
                    st.success("Account created — switch to the Sign in tab to log in.")

    st.stop()

# --- session state (authenticated) -----------------------------------------
if "messages" not in st.session_state:
    st.session_state.messages = []      # display list: {role, content}
if "history" not in st.session_state:
    st.session_state.history = []       # agent conversation history

SB = st.session_state["sb"] if "sb" in st.session_state else None

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

    if st.button("🔒  Log out", use_container_width=True):
        db.sign_out(st.session_state.get("sb"))
        for key in ("user_id", "sb", "messages", "history"):
            st.session_state.pop(key, None)
        st.rerun()


def _live_price(ticker: str):
    """Current price for a ticker, or None if the data fetch failed."""
    data = get_stock_data(ticker)
    if isinstance(data, dict) and "error" not in data and data.get("price") is not None:
        return float(data["price"])
    return None


def render_positions(sb):
    # --- add transaction ---------------------------------------------------
    st.subheader("Add transaction")
    cols = st.columns([2, 1, 1, 1, 2])
    cols[0].text_input("Ticker", key="tx_ticker", placeholder="e.g. NVDA")
    cols[1].selectbox("Side", ["buy", "sell"], key="tx_side")
    cols[2].number_input("Quantity", min_value=0.0, step=1.0, key="tx_qty")
    cols[3].number_input("Price / share", min_value=0.0, step=1.0, key="tx_price")
    cols[4].date_input("Trade date", key="tx_date")

    if st.button("➕  Add transaction", key="add_tx"):
        res = db.add_transaction(
            sb,
            st.session_state.tx_ticker,
            st.session_state.tx_side,
            st.session_state.tx_qty,
            st.session_state.tx_price,
            str(st.session_state.tx_date),
        )
        if "error" in res:
            st.error(res["error"])
        else:
            st.success(
                f"Added {st.session_state.tx_side} "
                f"{st.session_state.tx_qty} {st.session_state.tx_ticker.upper().strip()}"
            )
            st.rerun()

    # --- holdings ----------------------------------------------------------
    st.subheader("Holdings")
    positions = portfolio.aggregate_positions(db.list_transactions(sb))
    if not positions:
        st.info("No open positions yet. Add a buy above to start tracking your book.")
        return

    priced = [(p, _live_price(p["ticker"])) for p in positions]
    total_value = sum(price * p["quantity"] for p, price in priced if price is not None)
    total_cost_priced = sum(p["cost_basis"] for p, price in priced if price is not None)
    total_unreal = total_value - total_cost_priced

    c1, c2, c3 = st.columns(3)
    c1.metric("Portfolio value", f"${total_value:,.2f}")
    c2.metric("Cost basis", f"${total_cost_priced:,.2f}")
    c3.metric("Unrealized P&L", f"${total_unreal:,.2f}")

    rows = []
    for p, price in priced:
        mkt = price * p["quantity"] if price is not None else None
        unreal = mkt - p["cost_basis"] if mkt is not None else None
        rows.append(
            {
                "Ticker": p["ticker"],
                "Qty": p["quantity"],
                "Avg cost": p["avg_cost"],
                "Price": price if price is not None else "—",
                "Mkt value": round(mkt, 2) if mkt is not None else "—",
                "Cost basis": p["cost_basis"],
                "Unreal $": round(unreal, 2) if unreal is not None else "—",
                "Unreal %": round(unreal / p["cost_basis"] * 100, 2)
                if (unreal is not None and p["cost_basis"]) else "—",
                "Weight %": round(mkt / total_value * 100, 1)
                if (mkt is not None and total_value) else "—",
            }
        )
    st.dataframe(pd.DataFrame(rows), hide_index=True, use_container_width=True)

    for p in positions:
        with st.expander(f"{p['ticker']} — {len(p['batches'])} purchase batch(es)"):
            st.dataframe(pd.DataFrame(p["batches"]), hide_index=True, use_container_width=True)


def render_realized(sb):
    txns = db.list_transactions(sb)
    if not txns:
        st.info("No trades yet. Add transactions on the Positions tab.")
        return

    realized = portfolio.realized_pnl(txns)

    st.subheader("Realized gains")
    st.metric("Total realized P&L", f"${realized['total']:,.2f}")
    if realized["sales"]:
        sales = pd.DataFrame(realized["sales"])[
            ["traded_at", "ticker", "quantity", "price_per_share",
             "cost_basis", "proceeds", "realized"]
        ]
        st.dataframe(sales, hide_index=True, use_container_width=True)
    else:
        st.caption("No closed lots yet — realized P&L appears once you record a sell.")

    st.subheader("Trade history")
    history = sorted(
        txns,
        key=lambda t: (str(t.get("traded_at", "")), str(t.get("created_at", ""))),
        reverse=True,
    )
    for t in history:
        c = st.columns([2, 2, 1, 2, 2, 1])
        c[0].write(str(t.get("traded_at", "—")))
        c[1].write(t["ticker"])
        c[2].write(t["side"])
        c[3].write(f"{float(t['quantity']):g}")
        c[4].write(f"${float(t['price_per_share']):,.2f}")
        if c[5].button("🗑", key=f"del_{t['id']}"):
            db.delete_transaction(sb, t["id"])
            st.rerun()


def render_chat():
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    if prompt := st.chat_input("Ask about any stock or options trade..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

    # Answer any trailing, unanswered user message (shared by Run + chat input).
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


tab_positions, tab_realized, tab_chat = st.tabs(["📊 Positions", "💰 Realized", "💬 Chat"])

with tab_positions:
    render_positions(SB)

with tab_realized:
    render_realized(SB)

with tab_chat:
    render_chat()
