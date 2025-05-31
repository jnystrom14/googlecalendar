// Simplified Calendar Sync using Environment Variables for token storage

export class SimpleCalendarSync {
  constructor() {
    this.config = {
      OAUTH2: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        token_uri: 'https://oauth2.googleapis.com/token'
      },
      CALENDAR_IDS: [
        'carlnystrom116@gmail.com', // Primary calendar
        'llheqt9na4oplidmvmcipln0ac@group.calendar.google.com' // Google
      ],
      TRELLO_API_KEY: process.env.TRELLO_API_KEY,
      TRELLO_TOKEN: process.env.TRELLO_TOKEN,
      TRELLO_BOARD_ID: process.env.TRELLO_BOARD_ID,
      TODAY_LIST_ID: process.env.TODAY_LIST_ID,
      TOMORROW_LIST_ID: process.env.TOMORROW_LIST_ID
    };
    
    // Get tokens from environment variables
    this.accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    this.refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  }

  // Check if we have tokens
  hasValidTokens() {
    return !!(this.accessToken && this.refreshToken);
  }

  // Refresh access token using refresh token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const refreshData = {
      client_id: this.config.OAUTH2.client_id,
      client_secret: this.config.OAUTH2.client_secret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token'
    };

    try {
      const response = await fetch(this.config.OAUTH2.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(refreshData)
      });

      const tokens = await response.json();
      
      if (!response.ok) {
        throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error}`);
      }

      // Update access token (refresh token usually stays the same)
      this.accessToken = tokens.access_token;
      
      console.log('✅ Access token refreshed');
      console.log('ℹ️  Note: You may need to update GOOGLE_ACCESS_TOKEN env var with:', tokens.access_token);
      
      return tokens;
      
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      throw error;
    }
  }

  // Test calendar access
  async testCalendarAccess() {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.config.CALENDAR_IDS[0])}`;
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });
    
    if (!response.ok) {
      throw new Error(`Calendar access test failed: ${response.status}`);
    }
    
    return await response.json();
  }

  // Ensure we have valid authentication
  async ensureAuthenticated() {
    if (!this.hasValidTokens()) {
      throw new Error('No authentication tokens found. Please set GOOGLE_ACCESS_TOKEN and GOOGLE_REFRESH_TOKEN environment variables.');
    }
    
    // Test if access token works
    try {
      await this.testCalendarAccess();
      console.log('✅ Using existing authentication');
      return true;
    } catch (error) {
      console.log('🔄 Access token expired, refreshing...');
      try {
        await this.refreshAccessToken();
        return true;
      } catch (refreshError) {
        throw new Error('Authentication failed. Please re-authenticate and update environment variables.');
      }
    }
  }

  // Get calendar events from multiple calendars
  async getCalendarEvents(timeMin, timeMax) {
    console.log(`📊 Fetching events from ${this.config.CALENDAR_IDS.length} calendars...`);
    
    const allEvents = [];
    const eventTitleMap = new Map(); // Track duplicates by title + start time
    
    for (const calendarId of this.config.CALENDAR_IDS) {
      try {
        const events = await this.getEventsFromSingleCalendar(calendarId, timeMin, timeMax);
        
        // Add calendar info and filter duplicates
        events.forEach(event => {
          event._calendarId = calendarId;
          
          // Create unique key for duplicate detection
          const startTime = event.start?.dateTime || event.start?.date;
          const uniqueKey = `${event.summary || 'Untitled'}_${startTime}`;
          
          // Only add if not a duplicate
          if (!eventTitleMap.has(uniqueKey)) {
            eventTitleMap.set(uniqueKey, true);
            allEvents.push(event);
          } else {
            console.log(`🔄 Skipping duplicate: ${event.summary}`);
          }
        });
        
        console.log(`📅 ${calendarId.split('@')[0]}: ${events.length} events`);
        
      } catch (error) {
        console.error(`❌ Failed to get events from ${calendarId}:`, error.message);
      }
    }
    
    console.log(`✅ Total unique events: ${allEvents.length}`);
    return allEvents;
  }

  // Get events from a single calendar
  async getEventsFromSingleCalendar(calendarId, timeMin, timeMax) {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50'
    });

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    
    try {
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401) {
          await this.refreshAccessToken();
          return this.getEventsFromSingleCalendar(calendarId, timeMin, timeMax);
        }
        throw new Error(`Calendar API error: ${data.error?.message || response.statusText}`);
      }
      
      return data.items || [];
    } catch (error) {
      console.error(`Error fetching events from ${calendarId}:`, error);
      return [];
    }
  }

  // Date range helpers
  getTodayRange() {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    return {
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString()
    };
  }

  getTomorrowRange() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const startOfDay = new Date(tomorrow);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(23, 59, 59, 999);
    
    return {
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString()
    };
  }

  // Trello methods (same as before)
  async getTrelloCards(listId) {
    const url = `https://api.trello.com/1/lists/${listId}/cards`;
    const params = new URLSearchParams({
      key: this.config.TRELLO_API_KEY,
      token: this.config.TRELLO_TOKEN
    });

    try {
      const response = await fetch(`${url}?${params}`);
      const cards = await response.json();
      
      if (!response.ok) {
        throw new Error(`Trello API error: ${response.statusText}`);
      }
      
      return cards;
    } catch (error) {
      console.error('Error fetching Trello cards:', error);
      return [];
    }
  }

  async createTrelloCard(listId, cardData) {
    const url = 'https://api.trello.com/1/cards';
    
    const params = {
      key: this.config.TRELLO_API_KEY,
      token: this.config.TRELLO_TOKEN,
      idList: listId,
      name: cardData.name,
      desc: cardData.description,
      due: cardData.due,
      pos: 'top'
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Trello API error: ${data.error || response.statusText}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error creating Trello card:', error);
      throw error;
    }
  }

  async moveCardToList(cardId, newListId) {
    const url = `https://api.trello.com/1/cards/${cardId}`;
    
    const params = {
      key: this.config.TRELLO_API_KEY,
      token: this.config.TRELLO_TOKEN,
      idList: newListId,
      pos: 'top'
    };

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`Trello API error: ${response.statusText}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error moving card:', error);
      throw error;
    }
  }

  formatEventForTrello(event) {
    const startTime = event.start?.dateTime || event.start?.date;
    const endTime = event.end?.dateTime || event.end?.date;
    
    let description = '';
    if (event.description) {
      description += `${event.description}\n\n`;
    }
    
    description += `📅 **Calendar Event**\n`;
    description += `• Start: ${new Date(startTime).toLocaleString()}\n`;
    description += `• End: ${new Date(endTime).toLocaleString()}\n`;
    
    if (event.location) {
      description += `• Location: ${event.location}\n`;
    }
    
    if (event.attendees && event.attendees.length > 0) {
      description += `• Attendees: ${event.attendees.map(a => a.email).join(', ')}\n`;
    }
    
    if (event.htmlLink) {
      description += `• [View in Google Calendar](${event.htmlLink})\n`;
    }

    // Show which calendar this came from
    if (event._calendarId) {
      const calendarName = event._calendarId.includes('@') ? 
        event._calendarId.split('@')[0] : 
        event._calendarId.substring(0, 20) + '...';
      description += `• Source: ${calendarName}\n`;
    }

    description += `\n🔗 Event ID: ${event.id}`;

    return {
      name: event.summary || 'Untitled Event',
      description: description,
      due: startTime ? new Date(startTime).toISOString() : null,
      eventId: event.id
    };
  }

  extractEventIdFromCard(card) {
    const match = card.desc?.match(/🔗 Event ID: ([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  async syncEventsToList(events, listId, listName) {
    const existingCards = await this.getTrelloCards(listId);
    const existingEventIds = existingCards
      .map(card => this.extractEventIdFromCard(card))
      .filter(id => id);
    
    let created = 0;
    let skipped = 0;
    
    for (const event of events) {
      if (existingEventIds.includes(event.id)) {
        skipped++;
        continue;
      }
      
      if (event.attendees) {
        const userAttendee = event.attendees.find(a => a.self);
        if (userAttendee && userAttendee.responseStatus === 'declined') {
          skipped++;
          continue;
        }
      }
      
      try {
        const cardData = this.formatEventForTrello(event);
        await this.createTrelloCard(listId, cardData);
        created++;
        console.log(`✅ Created ${listName} card: ${cardData.name}`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to create card for: ${event.summary}`, error);
      }
    }
    
    return { created, skipped };
  }

  async moveTomorrowToToday() {
    console.log('🔄 Moving Tomorrow cards to Today...');
    
    const tomorrowCards = await this.getTrelloCards(this.config.TOMORROW_LIST_ID);
    let moved = 0;
    
    for (const card of tomorrowCards) {
      try {
        await this.moveCardToList(card.id, this.config.TODAY_LIST_ID);
        moved++;
        console.log(`📋 Moved to Today: ${card.name}`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to move card: ${card.name}`, error);
      }
    }
    
    console.log(`🎯 Moved ${moved} cards from Tomorrow to Today`);
    return moved;
  }

  async syncTodayAndTomorrow() {
    try {
      console.log('🚀 Starting calendar sync...');
      
      await this.ensureAuthenticated();
      
      const todayRange = this.getTodayRange();
      const tomorrowRange = this.getTomorrowRange();
      
      console.log(`📅 Today: ${new Date(todayRange.start).toDateString()}`);
      console.log(`📅 Tomorrow: ${new Date(tomorrowRange.start).toDateString()}`);
      
      const [todayEvents, tomorrowEvents] = await Promise.all([
        this.getCalendarEvents(todayRange.start, todayRange.end),
        this.getCalendarEvents(tomorrowRange.start, tomorrowRange.end)
      ]);
      
      console.log(`📊 Found ${todayEvents.length} today events, ${tomorrowEvents.length} tomorrow events`);
      
      const [todayResult, tomorrowResult] = await Promise.all([
        this.syncEventsToList(todayEvents, this.config.TODAY_LIST_ID, 'Today'),
        this.syncEventsToList(tomorrowEvents, this.config.TOMORROW_LIST_ID, 'Tomorrow')
      ]);
      
      console.log('🎉 Sync completed!');
      console.log(`📋 Today: ${todayResult.created} created, ${todayResult.skipped} skipped`);
      console.log(`📋 Tomorrow: ${tomorrowResult.created} created, ${tomorrowResult.skipped} skipped`);
      
      return { today: todayResult, tomorrow: tomorrowResult };
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      throw error;
    }
  }

  async performDailyRollover() {
    try {
      console.log('🌅 Starting daily rollover...');
      
      await this.ensureAuthenticated();
      
      // Move Tomorrow cards to Today
      await this.moveTomorrowToToday();
      
      // Sync new Tomorrow events
      const tomorrowRange = this.getTomorrowRange();
      const tomorrowEvents = await this.getCalendarEvents(tomorrowRange.start, tomorrowRange.end);
      
      const tomorrowResult = await this.syncEventsToList(
        tomorrowEvents, 
        this.config.TOMORROW_LIST_ID, 
        'Tomorrow'
      );
      
      console.log('✨ Daily rollover completed!');
      console.log(`📋 New Tomorrow events: ${tomorrowResult.created} created, ${tomorrowResult.skipped} skipped`);
      
      return tomorrowResult;
      
    } catch (error) {
      console.error('❌ Daily rollover failed:', error);
      throw error;
    }
  }
}
