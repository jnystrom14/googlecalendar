# Google Calendar to Trello Automation

Automated daily sync between Google Calendar events and Trello board with scheduled rollover functionality.

## Overview

This serverless application automatically:
- Syncs Google Calendar events to Trello cards
- Moves "Tomorrow" cards to "Today" list daily at 4am EDT
- Creates new "Tomorrow" cards for upcoming calendar events
- Handles token refresh and authentication automatically

## Architecture

- **Platform**: Vercel serverless functions
- **Authentication**: Google OAuth2 with refresh tokens
- **Storage**: Environment variables (no database required)
- **Scheduling**: Vercel cron jobs
- **APIs**: Google Calendar API v3, Trello API

## Project Structure

```
├── api/
│   ├── auth-token.js         # OAuth flow initiation
│   ├── get-tokens.js         # OAuth callback handler
│   ├── setup.js              # Initial setup and token exchange
│   ├── sync.js               # Manual sync endpoint
│   ├── simple-sync.js        # Simplified sync endpoint
│   ├── manual-rollover.js    # Working rollover endpoint (used by cron)
│   ├── daily-rollover.js     # Legacy rollover (deprecated)
│   ├── debug.js              # Debug information endpoint
│   ├── test.js               # Basic test endpoint
│   ├── cleanup-tomorrow.js   # Cleanup utility for wrong date events
│   ├── debug-dates.js        # Date calculation debugging
│   ├── debug-rollover.js     # Rollover debugging
│   └── webhook-rollover.js   # Alternative webhook rollover
├── lib/
│   ├── calendar-sync.js      # Core sync library (KV storage)
│   └── simple-calendar-sync.js # Simplified sync (env variables)
├── public/
│   └── index.html            # Basic landing page
├── package.json              # Dependencies and metadata
├── vercel.json               # Vercel configuration and cron jobs
└── README.md                 # This file
```

## Environment Variables

### Required Variables

```bash
# Google OAuth2
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_ACCESS_TOKEN=your_access_token
GOOGLE_REFRESH_TOKEN=your_refresh_token

# Trello API
TRELLO_API_KEY=your_trello_api_key
TRELLO_TOKEN=your_trello_token
TRELLO_BOARD_ID=your_board_id

# Trello List IDs
TODAY_LIST_ID=your_today_list_id
TOMORROW_LIST_ID=your_tomorrow_list_id
```

## Setup Instructions

### 1. Google Calendar API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Calendar API
4. Create OAuth2 credentials (Web application)
5. Add your domain to authorized origins
6. Note the `client_id` and `client_secret`

### 2. Trello API Setup

1. Get API key from [Trello Developer Portal](https://trello.com/app-key)
2. Generate token with read/write permissions
3. Get board ID from board URL or API
4. Get list IDs for "Today" and "Tomorrow" lists

### 3. Initial Authentication

1. Deploy to Vercel with environment variables
2. Visit `/api/auth-token` to start OAuth flow
3. Complete Google authorization
4. Visit `/api/setup` to exchange code for tokens
5. Update `GOOGLE_ACCESS_TOKEN` and `GOOGLE_REFRESH_TOKEN` in Vercel

### 4. Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
```

## API Endpoints

### Core Functionality

- `GET /api/manual-rollover` - **Main rollover endpoint** (used by cron)
- `GET /api/simple-sync` - Sync today and tomorrow events
- `GET /api/sync` - Legacy sync with KV storage
- `GET /api/debug` - System status and debugging info

### Authentication

- `GET /api/auth-token` - Start OAuth flow
- `GET /api/get-tokens` - OAuth callback handler  
- `GET /api/setup` - Complete initial setup

### Utilities

- `GET /api/cleanup-tomorrow` - Remove incorrect date events
- `GET /api/debug-dates` - Debug date calculations
- `GET /api/debug-rollover` - Debug rollover API calls
- `GET /api/test` - Basic connectivity test

## Daily Rollover Process

**Scheduled**: Every day at 4:00 AM EDT via Vercel cron

**Process**:
1. Move all cards from "Tomorrow" list to "Today" list
2. Fetch calendar events for tomorrow's date
3. Filter events to ensure correct date (no spillover)
4. Create new Trello cards for tomorrow's events
5. Skip declined events and duplicates

**Endpoint**: `/api/manual-rollover`

## Calendar Integration

**Supported Calendars**:
- Primary calendar: `carlnystrom116@gmail.com`
- Secondary calendar: `llheqt9na4oplidmvmcipln0ac@group.calendar.google.com`

**Event Processing**:
- Automatic duplicate detection
- Declined events are skipped
- All-day and timed events supported
- Event details included in card description

## Trello Card Format

**Card Title**: Event summary
**Card Description**: 
- Event description (if any)
- Start and end times
- Location (if any)
- Attendees list
- Google Calendar link
- Source calendar
- Event ID for tracking

**Due Date**: Set to end of target day (Today/Tomorrow)

## Debugging

### Check System Status
```bash
curl https://your-domain.vercel.app/api/debug
```

### Manual Rollover Test
```bash
curl https://your-domain.vercel.app/api/manual-rollover
```

### View Logs
Check Vercel function logs in dashboard for detailed execution info.

## Troubleshooting

### Common Issues

**401 Authentication Error**
- Token expired - automatic refresh should handle this
- Check environment variables are set correctly
- Re-run setup process if refresh token is invalid

**No Events Found**
- Check calendar IDs are correct
- Verify calendar permissions
- Check date range calculations

**Duplicate Cards**
- Run `/api/cleanup-tomorrow` to remove wrong-date events
- Check event ID extraction logic

**Cron Not Running**
- Verify `vercel.json` cron configuration
- Check Vercel dashboard for cron execution logs
- Ensure endpoint returns 200 status

### Manual Testing

```bash
# Test authentication
curl https://your-domain.vercel.app/api/debug

# Test rollover manually
curl https://your-domain.vercel.app/api/manual-rollover

# Clean up wrong events
curl https://your-domain.vercel.app/api/cleanup-tomorrow

# Check date calculations
curl https://your-domain.vercel.app/api/debug-dates
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Run local dev server
vercel dev

# Test endpoints locally
curl http://localhost:3000/api/debug
```

### Configuration Files

**vercel.json**:
- Function timeout: 300s
- Cron schedule: 4am daily
- Protection bypass headers

**package.json**:
- ES modules enabled
- No external dependencies
- Node.js 18+ required

## Security Notes

- Tokens stored as environment variables (not in code)
- Automatic token refresh prevents expiration
- No sensitive data in logs or responses
- Environment variables are encrypted at rest

## Monitoring

- Check Vercel function logs for execution status
- Use `/api/debug` for system health checks
- Monitor Trello board for successful card creation
- Verify Google Calendar events are properly synced

## License

ISC

---

**Last Updated**: June 2025
**Deployment**: Vercel Serverless
**Status**: Production Ready