"""
Streamlit App for Advisor Booking Agent - Complete Voice Interface
Deploys the voice-complete.html interface with STT + TTS capabilities
"""

import streamlit as st
import os
import requests
from pathlib import Path

# Page configuration
st.set_page_config(
    page_title="Advisor Booking Agent",
    page_icon="🎤",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Custom CSS to hide Streamlit UI elements and make it fullscreen
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

# Get backend URL from environment or Streamlit secrets
BACKEND_URL = os.getenv("BACKEND_URL", st.secrets.get("BACKEND_URL", "http://localhost:3000"))

# Check if backend server is running
def check_backend_health():
    """Check if the Node.js backend server is running"""
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        return response.status_code == 200
    except Exception as e:
        return False

# Read and modify the voice-complete.html file
def get_voice_interface_html():
    """Load and return the voice-complete.html content with backend URL"""
    html_path = Path(__file__).parent / "public" / "voice-complete.html"
    
    if not html_path.exists():
        st.error(f"❌ Voice interface file not found at {html_path}")
        return None
    
    with open(html_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    
    # Replace API endpoints to use the backend URL
    # Handle both '/api/' and full URLs
    html_content = html_content.replace(
        "fetch('/api/",
        f"fetch('{BACKEND_URL}/api/"
    )
    
    # Also replace session endpoint
    html_content = html_content.replace(
        "fetch('/api/session'",
        f"fetch('{BACKEND_URL}/api/session'"
    )
    
    return html_content

# Main app
def main():
    # Minimal header
    with st.container():
        col1, col2, col3 = st.columns([1, 2, 1])
        with col2:
            st.markdown("### 🎤 Advisor Booking Agent - Voice Interface")
    
    st.markdown("---")
    
    # Check backend status
    with st.spinner("Checking backend connection..."):
        backend_running = check_backend_health()
    
    if not backend_running:
        st.error(f"""
        ❌ **Backend server is not accessible at {BACKEND_URL}**
        
        **For Local Development:**
        1. Start the backend server:
           ```bash
           npm run dev
           ```
        2. Ensure it's running on port 3000
        3. Refresh this page
        
        **For Streamlit Cloud Deployment:**
        1. Deploy the backend separately (Railway, Render, etc.)
        2. Set `BACKEND_URL` in Streamlit secrets to your backend URL
        3. Ensure CORS is enabled on the backend
        """)
        return
    
    st.success(f"✅ Backend server connected: {BACKEND_URL}")
    
    # Load and display voice interface
    html_content = get_voice_interface_html()
    
    if html_content:
        # Display the voice interface in an iframe (full height)
        st.components.v1.html(
            html_content, 
            height=700, 
            scrolling=False
        )
    else:
        st.error("Failed to load voice interface")

if __name__ == "__main__":
    main()

