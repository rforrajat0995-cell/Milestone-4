# Streamlit-Only Deployment Guide

This guide explains how to deploy the entire application (backend + frontend) on Streamlit Cloud without using external services like Railway.

## ⚠️ Important Limitations

Streamlit Cloud has some limitations:
- **No persistent processes**: Subprocesses may be killed after inactivity
- **Limited resources**: CPU and memory constraints
- **No background tasks**: Long-running processes may timeout

However, we can work around these by:
1. Starting the Node.js backend as a subprocess when the app loads
2. Using Streamlit's session state to manage the backend process
3. Handling process restarts gracefully

## 📋 Prerequisites

1. GitHub repository with all code
2. Streamlit Cloud account
3. All API keys and credentials

## 🚀 Deployment Steps

### Step 1: Prepare Your Repository

Ensure these files are in your repo:
- `streamlit_app.py` - Main Streamlit app
- `src/server.js` - Node.js backend
- `package.json` - Node.js dependencies
- `requirements.txt` - Python dependencies
- `public/voice-complete.html` - Voice interface

### Step 2: Set Up Streamlit Secrets

1. Go to your Streamlit Cloud app settings
2. Click "Secrets"
3. Add all environment variables:

```toml
GROQ_API_KEY = "your_groq_key"
ELEVEN_LABS_API_KEY = "your_eleven_labs_key"
ELEVEN_LABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
ELEVEN_LABS_MODEL = "eleven_turbo_v2"
GOOGLE_CALENDAR_ID = "your_calendar_id"
GOOGLE_SHEET_ID = "your_sheet_id"
GMAIL_USER = "your_email@gmail.com"
GMAIL_APP_PASSWORD = "your_app_password"
GOOGLE_SERVICE_ACCOUNT_KEY_PATH = "/mount/src/secrets/service-account-key.json"
PORT = "3000"
```

**For Google Service Account Key:**
- Upload the JSON key file to Streamlit Cloud
- Reference it in secrets as shown above
- Streamlit Cloud mounts files in `/mount/src/secrets/`

### Step 3: Create .streamlit/config.toml

Already created in the repo. It configures:
- Theme colors
- Server settings
- Headless mode

### Step 4: Deploy to Streamlit Cloud

1. Go to https://share.streamlit.io
2. Sign in with GitHub
3. Click "New app"
4. Select repository: `rforrajat0995-cell/Milestone-4`
5. Main file path: `streamlit_app.py`
6. Click "Deploy"

### Step 5: Install Node.js Dependencies

Streamlit Cloud doesn't automatically install Node.js dependencies. You have two options:

**Option A: Use a buildpack (Recommended)**
1. Create `nixpkgs.txt` or use a buildpack
2. Streamlit Cloud will install Node.js and npm
3. Add a startup script to run `npm install`

**Option B: Pre-build and commit node_modules (Not recommended)**
- Increases repo size significantly
- Not ideal for version control

**Option C: Use Python-only backend (Future enhancement)**
- Port the Node.js backend to Python
- Use `backend_api.py` (created but needs full implementation)

## 🔧 How It Works

1. **App Loads**: Streamlit app starts
2. **Backend Check**: Checks if backend is running on localhost:3000
3. **Start Backend**: If not running, starts Node.js server as subprocess
4. **Load Interface**: Embeds `voice-complete.html` in Streamlit
5. **API Calls**: HTML makes requests to localhost:3000 (same container)

## 🐛 Troubleshooting

### Backend Not Starting

**Issue**: Backend process fails to start
**Solutions**:
- Check Streamlit logs for errors
- Verify Node.js is available (check `packages.txt`)
- Ensure `package.json` is correct
- Check that all dependencies are listed

### API Calls Failing

**Issue**: Voice interface can't connect to backend
**Solutions**:
- Verify backend is running (check logs)
- Check CORS settings in `src/server.js`
- Ensure backend URL is correct (localhost:3000)

### Environment Variables Not Loading

**Issue**: API keys not found
**Solutions**:
- Verify secrets are set in Streamlit Cloud
- Check secret names match exactly (case-sensitive)
- Restart the app after adding secrets

### Process Killed

**Issue**: Backend stops after inactivity
**Solutions**:
- This is expected behavior on Streamlit Cloud
- Backend will restart on next user interaction
- Consider using a separate backend service for production

## 📝 Notes

- **Development**: Test locally first with `streamlit run streamlit_app.py`
- **Production**: For production use, consider deploying backend separately
- **Limitations**: Streamlit Cloud is best for demos and prototypes
- **Scaling**: For high traffic, use dedicated backend service

## 🔄 Alternative: Python Backend

For better Streamlit integration, consider porting the backend to Python:
- Use `backend_api.py` as starting point
- Port conversation engine logic
- Use Python libraries for Groq, Google APIs, etc.
- No subprocess needed - everything in Python

This would be more reliable on Streamlit Cloud but requires more development work.

