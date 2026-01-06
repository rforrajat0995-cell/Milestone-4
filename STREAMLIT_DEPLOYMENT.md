# Streamlit Deployment Guide

This guide explains how to deploy the Advisor Booking Agent voice interface on Streamlit Cloud.

## Architecture

The deployment consists of:
1. **Streamlit App** (`streamlit_app.py`) - Frontend interface
2. **Node.js Backend** - API server (runs separately or as subprocess)

## Option 1: Deploy Backend Separately (Recommended)

### Step 1: Deploy Node.js Backend

Deploy the backend to a service like:
- **Railway** (recommended for Node.js)
- **Render**
- **Heroku**
- **Fly.io**

1. Create account on chosen platform
2. Connect your GitHub repository
3. Set environment variables:
   ```
   GROQ_API_KEY=your_key
   ELEVEN_LABS_API_KEY=your_key
   GOOGLE_CALENDAR_ID=your_id
   GOOGLE_SHEET_ID=your_id
   GMAIL_USER=your_email
   GMAIL_APP_PASSWORD=your_password
   GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/path/to/key.json
   ```
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Note the backend URL (e.g., `https://your-app.railway.app`)

### Step 2: Update Streamlit App

Update `streamlit_app.py` to point to your deployed backend:

```python
BACKEND_URL = "https://your-app.railway.app"  # Your backend URL
```

### Step 3: Deploy to Streamlit Cloud

1. Go to https://share.streamlit.io
2. Sign in with GitHub
3. Click "New app"
4. Select your repository: `rforrajat0995-cell/Milestone-4`
5. Main file path: `streamlit_app.py`
6. Add secrets in Streamlit Cloud settings:
   ```
   BACKEND_URL=https://your-backend-url.com
   ```
7. Deploy!

## Option 2: Run Backend as Subprocess (Not Recommended for Production)

The current `streamlit_app.py` tries to start the backend as a subprocess. This works locally but has limitations on Streamlit Cloud:

- Limited process management
- May timeout
- Not ideal for production

## Environment Variables for Streamlit

If using Option 1, you only need:
- `BACKEND_URL` - Your deployed backend URL

If using Option 2, you need all backend env vars in Streamlit secrets.

## Local Testing

1. Start backend:
   ```bash
   npm run dev
   ```

2. Run Streamlit app:
   ```bash
   streamlit run streamlit_app.py
   ```

3. Open: http://localhost:8501

## Troubleshooting

### Backend not connecting
- Check backend URL is correct
- Verify backend is running and accessible
- Check CORS settings in backend

### Voice not working
- Ensure microphone permissions are granted
- Check browser console for errors
- Verify Eleven Labs API key is set

### API errors
- Check backend logs
- Verify all environment variables are set
- Test backend endpoints directly

## Notes

- Streamlit Cloud has limitations on subprocess execution
- Recommended: Deploy backend separately for better reliability
- Voice interface requires HTTPS for microphone access (Streamlit Cloud provides this)

