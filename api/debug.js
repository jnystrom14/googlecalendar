// Debug endpoint to check calendar events and Trello setup
import { SimpleCalendarSync } from '../lib/simple-calendar-sync.js';

export default async function handler(req, res) {
  try {
    console.log('🔍 Debug endpoint triggered');
    
    const sync = new SimpleCalendarSync();
    
    // Check environment variables
    const envCheck = {
      hasGoogleAccessToken: !!process.env.GOOGLE_ACCESS_TOKEN,
      hasGoogleRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
      hasTrelloApiKey: !!process.env.TRELLO_API_KEY,
      hasTrelloToken: !!process.env.TRELLO_TOKEN,
      hasTrelloBoardId: !!process.env.TRELLO_BOARD_ID,
      hasTodayListId: !!process.env.TODAY_LIST_ID,
      hasTomorrowListId: !!process.env.TOMORROW_LIST_ID,
      boardId: process.env.TRELLO_BOARD_ID,
      todayListId: process.env.TODAY_LIST_ID,
      tomorrowListId: process.env.TOMORROW_LIST_ID
    };

    // Get all lists from the board
    let boardLists = [];
    let boardError = null;
    
    try {
      const boardUrl = `https://api.trello.com/1/boards/${process.env.TRELLO_BOARD_ID}/lists`;
      const boardParams = new URLSearchParams({
        key: process.env.TRELLO_API_KEY,
        token: process.env.TRELLO_TOKEN
      });
      
      const boardResponse = await fetch(`${boardUrl}?${boardParams}`);
      boardLists = await boardResponse.json();
      
      if (!boardResponse.ok) {
        throw new Error(`Board API error: ${boardResponse.statusText}`);
      }
    } catch (error) {
      boardError = error.message;
    }
    
    // Check tokens
    if (!sync.hasValidTokens()) {
      return res.status(400).json({
        success: false,
        error: 'Missing authentication tokens',
        envCheck: envCheck
      });
    }
    
    try {
      await sync.ensureAuthenticated();
    } catch (authError) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed',
        authError: authError.message,
        envCheck: envCheck
      });
    }
    
    // Test Trello access first
    let tomorrowCards = [];
    let todayCards = [];
    let trelloError = null;
    
    try {
      [todayCards, tomorrowCards] = await Promise.all([
        sync.getTrelloCards(sync.config.TODAY_LIST_ID),
        sync.getTrelloCards(sync.config.TOMORROW_LIST_ID)
      ]);
    } catch (error) {
      trelloError = error.message;
    }
    
    // Get date ranges
    const todayRange = sync.getTodayRange();
    const tomorrowRange = sync.getTomorrowRange();
    
    // Try to get calendar events
    let todayEvents = [];
    let tomorrowEvents = [];
    let calendarError = null;
    
    try {
      [todayEvents, tomorrowEvents] = await Promise.all([
        sync.getCalendarEvents(todayRange.start, todayRange.end),
        sync.getCalendarEvents(tomorrowRange.start, tomorrowRange.end)
      ]);
    } catch (error) {
      calendarError = error.message;
    }
    
    return res.status(200).json({
      success: true,
      message: 'Debug data collected',
      envCheck: envCheck,
      boardLists: boardLists.map(list => ({
        id: list.id,
        name: list.name,
        closed: list.closed
      })),
      errors: {
        board: boardError,
        trello: trelloError,
        calendar: calendarError
      },
      data: {
        dateRanges: {
          today: todayRange,
          tomorrow: tomorrowRange
        },
        calendarEvents: {
          today: todayEvents.length,
          tomorrow: tomorrowEvents.length,
          todayEvents: todayEvents.slice(0, 3).map(e => ({
            id: e.id,
            summary: e.summary,
            start: e.start?.dateTime || e.start?.date
          })),
          tomorrowEvents: tomorrowEvents.slice(0, 3).map(e => ({
            id: e.id,
            summary: e.summary,
            start: e.start?.dateTime || e.start?.date
          }))
        },
        trelloCards: {
          todayCount: todayCards.length,
          tomorrowCount: tomorrowCards.length,
          tomorrowCards: tomorrowCards.map(c => ({
            id: c.id,
            name: c.name,
            eventId: sync.extractEventIdFromCard(c)
          }))
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}