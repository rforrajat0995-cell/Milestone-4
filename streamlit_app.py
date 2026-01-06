"""
Streamlit App for Advisor Booking Agent - Complete Voice Interface
All-in-one deployment: Backend and Frontend in Streamlit
"""

import streamlit as st
import os
import json
import requests
from pathlib import Path
import subprocess
import threading
import time

# Page configuration
st.set_page_config(
    page_title="Advisor Booking Agent",
    page_icon="🎤",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS
st.markdown("""
    <style>
        #MainMenu {visibility: hidden;}
        footer {visibility: hidden;}
        header {visibility: hidden;}
        .stDeployButton {visibility: hidden;}
        .stApp {
            padding-top: 0rem;
        }
        .block-container {
            padding-top: 1rem;
            padding-bottom: 1rem;
        }
    </style>
    """, unsafe_allow_html=True)

# Initialize session state
if 'backend_process' not in st.session_state:
    st.session_state.backend_process = None
if 'backend_url' not in st.session_state:
    st.session_state.backend_url = "http://localhost:3000"

def start_node_backend():
    """Start Node.js backend as subprocess"""
    if st.session_state.backend_process is None:
        try:
            # Check if node_modules exists
            if not Path("node_modules").exists():
                st.error("❌ node_modules not found. Please install dependencies first.")
                return False
            
            # Start backend
            process = subprocess.Popen(
                ["node", "src/server.js"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            st.session_state.backend_process = process
            
            # Wait for server to start
            time.sleep(3)
            return True
        except Exception as e:
            st.error(f"Error starting backend: {e}")
            return False
    return True

def check_backend_health():
    """Check if backend is running"""
    try:
        response = requests.get(f"{st.session_state.backend_url}/health", timeout=2)
        return response.status_code == 200
    except:
        return False

def get_voice_interface_html():
    """Load voice-complete.html and modify for Streamlit"""
    html_path = Path(__file__).parent / "public" / "voice-complete.html"
    
    if not html_path.exists():
        st.error(f"❌ Voice interface not found at {html_path}")
        return None
    
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    
    # Replace API endpoints with backend URL
    backend_url = st.session_state.backend_url
    html_content = html_content.replace(
        "fetch('/api/",
        f"fetch('{backend_url}/api/"
    )
    html_content = html_content.replace(
        "fetch('/api/session'",
        f"fetch('{backend_url}/api/session'"
    )
    
    return html_content

# Main app
def main():
    st.markdown("### 🎤 Advisor Booking Agent - Voice Interface")
    st.markdown("---")
    
    # Check if we need to start backend
    backend_running = check_backend_health()
    
    if not backend_running:
        with st.spinner("Starting backend server..."):
            if start_node_backend():
                time.sleep(2)
                backend_running = check_backend_health()
    
    if not backend_running:
        st.error("""
        ❌ **Backend server is not running**
        
        **For Streamlit Cloud:**
        - The backend will start automatically
        - Ensure all environment variables are set in Streamlit secrets
        - Node.js dependencies are installed (add to requirements.txt or use buildpack)
        
        **For Local Testing:**
        1. Install dependencies: `npm install`
        2. Start backend manually: `npm run dev`
        3. Refresh this page
        """)
        
        # Show backend logs if available
        if st.session_state.backend_process:
            st.code("Backend process started. Check terminal for logs.")
        
        return
    
    st.success(f"✅ Backend server running at {st.session_state.backend_url}")
    
    # Load and display voice interface
    html_content = get_voice_interface_html()
    
    if html_content:
        st.components.v1.html(html_content, height=700, scrolling=False)
    else:
        st.error("Failed to load voice interface")
    
    # Cleanup on app close
    if st.session_state.backend_process:
        # Note: Process will be cleaned up when Streamlit restarts
        pass

if __name__ == "__main__":
    main()
