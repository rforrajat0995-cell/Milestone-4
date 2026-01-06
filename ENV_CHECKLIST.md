# Environment Variables Checklist

## Dependencies Status

✅ **googleapis** - Installed  
✅ **nodemailer** - Installed

## Required .env Variables

Your `.env` file must contain the following variables:

### ✅ Already Have (from Phase 1):
- `GROQ_API_KEY` - Your Groq AI API key

### ⚠️ Need to Add (for Phase 2):
- `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` - Path to your service account JSON key file
  - Example: `./service-account-key.json` or `/full/path/to/key.json`
  
- `GOOGLE_CALENDAR_ID` - Your Google Calendar ID
  - Format: `your-calendar-id@group.calendar.google.com`
  - How to find: Google Calendar → Settings → Integrate calendar → Calendar ID
  
- `GOOGLE_SHEET_ID` - Your Google Sheet ID
  - Found in URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
  - Copy the `SHEET_ID_HERE` part
  
- `GMAIL_USER` - Your Gmail address
  - Example: `your-email@gmail.com`
  
- `GMAIL_APP_PASSWORD` - Your Gmail App Password
  - NOT your regular password
  - Generate from: Google Account → Security → 2-Step Verification → App passwords

## Quick Check

Run this command to verify your .env file:
```bash
node check-env.js
```

## Example .env File

```env
# Groq AI (Phase 1)
GROQ_API_KEY=gsk_your_groq_key_here

# Google Service Account (Phase 2)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./service-account-key.json

# Google Calendar (Phase 2)
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com

# Google Sheets (Phase 2)
GOOGLE_SHEET_ID=1a2b3c4d5e6f7g8h9i0j

# Gmail SMTP (Phase 2)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop

# Server (Optional)
PORT=3000
```

