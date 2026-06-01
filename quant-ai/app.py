"""Streamlit UI for the Quant AI assistant.

Minimal chat surface: renders the conversation and routes each prompt through
the Claude agent. The sidebar quick-analysis modes and theming are added later.
"""
import streamlit as st

from agent import run_agent

st.set_page_config(
    page_title="Quant AI",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# --- session state ---------------------------------------------------------
if "messages" not in st.session_state:
    st.session_state.messages = []      # display list: {role, content}
if "history" not in st.session_state:
    st.session_state.history = []       # agent conversation history

# --- header ----------------------------------------------------------------
st.title("📈 Quant AI")
st.caption("Claude-powered quantitative analysis · US equities & options · real-time market data")

# --- chat history ----------------------------------------------------------
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# --- chat input + response -------------------------------------------------
if prompt := st.chat_input("Ask about any stock or options trade..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        try:
            with st.spinner("Fetching market data & analyzing..."):
                response_text, st.session_state.history = run_agent(
                    prompt, st.session_state.history
                )
            st.markdown(response_text)
            st.session_state.messages.append(
                {"role": "assistant", "content": response_text}
            )
        except Exception as e:
            st.error(f"Analysis failed: {e}")
