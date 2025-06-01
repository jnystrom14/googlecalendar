// api/health-check.js
import { CalendarTrelloSync } from '../lib/calendar-sync.js';

export default async function handler(req, res) {
  const sync = new CalendarTrelloSync();
  const checks = {
    overallStatus: 'PASS',
    timestamp: new Date().toISOString(),
    details: [],
  };

  // 1. Check Environment Variables
  const essentialEnvVars = [
    'TRELLO_API_KEY',
    'TRELLO_TOKEN',
    'TRELLO_BOARD_ID',
    'TODAY_LIST_ID',
    'TOMORROW_LIST_ID',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    // KV_URL is implicitly checked by kv.get anwwhere, but let's add it for completeness
    'KV_URL'
  ];

  essentialEnvVars.forEach(varName => {
    if (process.env[varName]) {
      checks.details.push({
        name: `Env Var: ${varName}`,
        status: 'PASS',
        message: 'Set',
      });
    } else {
      checks.details.push({
        name: `Env Var: ${varName}`,
        status: 'FAIL',
        message: 'Missing',
      });
      checks.overallStatus = 'FAIL';
    }
  });

  // 2. Check KV Token Loading
  try {
    const tokens = await sync.loadTokens();
    if (tokens) {
      checks.details.push({
        name: 'KV Token Load',
        status: 'PASS',
        message: 'Tokens loaded successfully.',
      });
    } else {
      checks.details.push({
        name: 'KV Token Load',
        status: 'WARN',
        message: 'No tokens found in KV storage. Initial setup might be needed.',
      });
      // Not failing overallStatus for WARN
    }
  } catch (error) {
    checks.details.push({
      name: 'KV Token Load',
      status: 'FAIL',
      message: error.message,
    });
    checks.overallStatus = 'FAIL';
  }

  // 3. Check Google Calendar API Access
  // ensureAuthenticated also tests calendar access or attempts refresh.
  const kvTokenLoadCheck = checks.details.find(d => d.name === 'KV Token Load');

  if (kvTokenLoadCheck && kvTokenLoadCheck.status === 'PASS') {
    try {
      await sync.ensureAuthenticated(); // This uses sync.accessToken set by loadTokens()
      checks.details.push({
        name: 'Google Calendar Auth',
        status: 'PASS',
        message: 'Authenticated successfully with Google Calendar.',
      });
    } catch (error) {
      checks.details.push({
        name: 'Google Calendar Auth',
        status: 'FAIL',
        message: `Authentication failed: ${error.message}`,
      });
      checks.overallStatus = 'FAIL';
    }
  } else if (kvTokenLoadCheck && kvTokenLoadCheck.status === 'WARN') {
    checks.details.push({
      name: 'Google Calendar Auth',
      status: 'WARN',
      message: 'Skipped: Google Calendar authentication requires tokens from KV storage.',
    });
  } else { // Implies KV Token Load failed or check was not found (which shouldn't happen)
    checks.details.push({
      name: 'Google Calendar Auth',
      status: 'SKIPPED',
      message: 'Skipped due to KV Token Load failure or issue.',
    });
  }


  // 4. Check Trello API Access (non-modifying)
  // Only attempt if critical env vars for Trello are present
  const trelloEnvVarsPresent = ['TRELLO_API_KEY', 'TRELLO_TOKEN', 'TRELLO_BOARD_ID'].every(varName => process.env[varName]);

  if (trelloEnvVarsPresent) {
    try {
      const boardDetails = await sync.getBoardDetails(sync.config.TRELLO_BOARD_ID);
      if (boardDetails && boardDetails.id === sync.config.TRELLO_BOARD_ID) {
        checks.details.push({
          name: 'Trello API Access',
          status: 'PASS',
          message: `Successfully fetched board details for "${boardDetails.name}".`,
        });
      } else {
        checks.details.push({
          name: 'Trello API Access',
          status: 'FAIL',
          message: 'Fetched board details, but ID mismatch or invalid response.',
        });
        checks.overallStatus = 'FAIL';
      }
    } catch (error) {
      checks.details.push({
        name: 'Trello API Access',
        status: 'FAIL',
        message: error.message,
      });
      checks.overallStatus = 'FAIL';
    }
  } else {
    checks.details.push({
        name: 'Trello API Access',
        status: 'SKIPPED',
        message: 'Skipped due to missing Trello environment variables (API_KEY, TOKEN, or BOARD_ID).',
      });
  }

  // Return Response
  if (checks.overallStatus === 'FAIL') {
    return res.status(500).json(checks);
  } else {
    return res.status(200).json(checks);
  }
}
