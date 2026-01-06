"""
Python Backend API for Advisor Booking Agent
Replicates the Node.js backend functionality for Streamlit deployment
"""

import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
import requests
from groq import Groq
import google.auth
from google.oauth2 import service_account
from googleapiclient.discovery import build
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Initialize services
groq_client = None
calendar_service = None
sheets_service = None

def init_services():
    """Initialize all services"""
    global groq_client, calendar_service, sheets_service
    
    # Initialize Groq
    groq_api_key = os.getenv("GROQ_API_KEY")
    if groq_api_key:
        groq_client = Groq(api_key=groq_api_key)
    
    # Initialize Google Calendar
    calendar_id = os.getenv("GOOGLE_CALENDAR_ID")
    service_account_path = os.getenv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH")
    if service_account_path and calendar_id:
        try:
            credentials = service_account.Credentials.from_service_account_file(
                service_account_path,
                scopes=['https://www.googleapis.com/auth/calendar']
            )
            calendar_service = build('calendar', 'v3', credentials=credentials)
        except Exception as e:
            print(f"Error initializing Calendar: {e}")
    
    # Initialize Google Sheets
    sheet_id = os.getenv("GOOGLE_SHEET_ID")
    if service_account_path and sheet_id:
        try:
            credentials = service_account.Credentials.from_service_account_file(
                service_account_path,
                scopes=['https://www.googleapis.com/auth/spreadsheets']
            )
            sheets_service = build('sheets', 'v4', credentials=credentials)
        except Exception as e:
            print(f"Error initializing Sheets: {e}")

# Session management
sessions = {}

def create_session(session_id=None):
    """Create a new session"""
    if not session_id:
        session_id = f"session_{int(datetime.now().timestamp() * 1000)}_{hashlib.md5(str(datetime.now()).encode()).hexdigest()[:9]}"
    
    sessions[session_id] = {
        "state": "GREETING",
        "intent": None,
        "topic": None,
        "preferences": {},
        "offeredSlots": [],
        "selectedSlot": None,
        "bookingCode": None,
        "bookingCodeToCancel": None,
        "cancellationPending": False,
        "reschedulePending": False
    }
    return sessions[session_id]

def get_session(session_id):
    """Get session by ID"""
    return sessions.get(session_id)

def update_session(session_id, updates):
    """Update session"""
    if session_id in sessions:
        sessions[session_id].update(updates)
    return sessions.get(session_id)

# Booking store
bookings_file = Path("data/bookings.json")
bookings_file.parent.mkdir(exist_ok=True)

def load_bookings():
    """Load bookings from file"""
    if bookings_file.exists():
        try:
            with open(bookings_file, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_bookings(bookings):
    """Save bookings to file"""
    with open(bookings_file, 'w') as f:
        json.dump(bookings, f, indent=2)

bookings = load_bookings()

def create_booking(booking_code, booking_data):
    """Create a new booking"""
    bookings[booking_code] = {
        **booking_data,
        "createdAt": datetime.now().isoformat(),
        "status": "confirmed"
    }
    save_bookings(bookings)
    return bookings[booking_code]

def get_booking(booking_code):
    """Get booking by code"""
    return bookings.get(booking_code)

# Simplified message processing (you'll need to port the full logic)
def process_message(session_id, user_message):
    """Process user message and return response"""
    session = get_session(session_id)
    if not session:
        session = create_session(session_id)
    
    # This is a simplified version - you'll need to port the full conversation logic
    # For now, return a basic response
    response = {
        "message": "Processing your request...",
        "session": session,
        "sessionId": session_id
    }
    
    # TODO: Port the full conversation engine logic from conversationEngine.js
    # This includes intent detection, state management, slot filling, etc.
    
    return response

# API endpoints as functions
def health_check():
    """Health check endpoint"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

def chat_endpoint(message, session_id=None):
    """Chat endpoint"""
    if not session_id:
        session_id = f"session_{int(datetime.now().timestamp() * 1000)}"
        create_session(session_id)
    
    result = process_message(session_id, message)
    return result

def tts_endpoint(text):
    """TTS endpoint using Eleven Labs"""
    api_key = os.getenv("ELEVEN_LABS_API_KEY")
    if not api_key:
        raise Exception("ELEVEN_LABS_API_KEY not set")
    
    voice_id = os.getenv("ELEVEN_LABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    model_id = os.getenv("ELEVEN_LABS_MODEL", "eleven_turbo_v2")
    
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key
    }
    data = {
        "text": text,
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }
    
    response = requests.post(url, json=data, headers=headers)
    if response.status_code != 200:
        raise Exception(f"TTS API error: {response.status_code}")
    
    return response.content

