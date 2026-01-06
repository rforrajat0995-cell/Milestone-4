# MCP Integration Setup Guide

## Fixed Package Dependencies

The correct packages for Google APIs are:
- `googleapis` - Includes Calendar, Sheets, and Gmail APIs (NOT @google-cloud/calendar)
- `nodemailer` - For email sending via SMTP

## Installation

The `package.json` has been updated with the correct dependencies. To install:

```bash
npm install
```

If you get permission errors, try:
```bash
npm install --legacy-peer-deps
```

Or install packages individually:
```bash
npm install googleapis nodemailer
```

## .env File Requirements

Your `.env` file should contain:

```env
# Groq AI API Key
GROQ_API_KEY=your-groq-api-key-here

# Google Service Account
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./path/to/service-account-key.json

# Google Calendar
GOOGLE_CALENDAR_ID=your-calendar-id@group.calendar.google.com

# Google Sheets
GOOGLE_SHEET_ID=your-sheet-id-here

# Gmail SMTP
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password-here

# Server Port (optional)
PORT=3000
```

## How to Find Your IDs

### Google Calendar ID:
1. Go to Google Calendar
2. Click the three dots next to your calendar
3. Select "Settings and sharing"
4. Scroll down to "Integrate calendar"
5. Copy the "Calendar ID" (format: `xxx@group.calendar.google.com`)

### Google Sheet ID:
1. Open your Google Sheet
2. Look at the URL: `https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit`
3. Copy the `SHEET_ID_HERE` part

### Service Account Key Path:
- Place your downloaded JSON key file in the project
- Use relative path: `./service-account-key.json`
- Or absolute path: `/full/path/to/key.json`

## Next Steps

Once dependencies are installed and .env is configured:
1. Create `src/services/googleCalendar.js`
2. Create `src/services/googleSheets.js`
3. Create `src/services/emailService.js`
4. Replace mock function calls with real implementations

