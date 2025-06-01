// Manual rollover using environment variables (same auth as debug endpoint)
export default async function handler(req, res) {
  try {
    console.log('🔄 Manual rollover triggered');
    console.log(`🕐 Current time: ${new Date().toLocaleString()}`);
    
    // Environment variable auth (same as debug endpoint)
    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    
    if (!accessToken || !refreshToken) {
      throw new Error('Missing environment tokens');
    }
    
    const config = {
      TRELLO_API_KEY: process.env.TRELLO_API_KEY,
      TRELLO_TOKEN: process.env.TRELLO_TOKEN,
      TODAY_LIST_ID: process.env.TODAY_LIST_ID,
      TOMORROW_LIST_ID: process.env.TOMORROW_LIST_ID,
      CALENDAR_IDS: [
        'carlnystrom116@gmail.com',
        'llheqt9na4oplidmvmcipln0ac@group.calendar.google.com'
      ]
    };
    
    // Step 1: Move Tomorrow cards to Today
    console.log('🔄 Moving Tomorrow cards to Today...');
    const tomorrowCards = await getTrelloCards(config.TOMORROW_LIST_ID, config);
    let moved = 0;
    
    for (const card of tomorrowCards) {
      try {
        await moveCardToList(card.id, config.TODAY_LIST_ID, config);
        moved++;
        console.log(`📋 Moved: ${card.name}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to move: ${card.name}`, error);
      }
    }
    
    // Step 2: Get tomorrow's calendar events
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfDay = new Date(tomorrow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log(`📅 Fetching events for: ${startOfDay.toDateString()}`);
    const tomorrowEvents = await getCalendarEvents(
      startOfDay.toISOString(), 
      endOfDay.toISOString(),
      accessToken,
      refreshToken,
      config
    );
    
    // Step 3: Create cards for new tomorrow events
    const existingCards = await getTrelloCards(config.TOMORROW_LIST_ID, config);
    const existingEventIds = existingCards
      .map(card => card.desc?.match(/🔗 Event ID: ([a-zA-Z0-9_-]+)/)?.[1])
      .filter(id => id);
    
    let created = 0;
    for (const event of tomorrowEvents) {
      if (existingEventIds.includes(event.id)) continue;
      
      if (event.attendees) {
        const userAttendee = event.attendees.find(a => a.self);
        if (userAttendee?.responseStatus === 'declined') continue;
      }
      
      try {
        await createTrelloCard(config.TOMORROW_LIST_ID, formatEvent(event), config);
        created++;
        console.log(`✅ Created: ${event.summary}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`❌ Failed to create: ${event.summary}`, error);
      }
    }
    
    console.log('✨ Manual rollover completed!');
    
    return res.status(200).json({
      success: true,
      message: 'Manual rollover completed successfully',
      result: {
        moved: moved,
        created: created,
        tomorrowEvents: tomorrowEvents.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Manual rollover failed:', error);
    return res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function getTrelloCards(listId, config) {
  const url = `https://api.trello.com/1/lists/${listId}/cards`;
  const params = new URLSearchParams({
    key: config.TRELLO_API_KEY,
    token: config.TRELLO_TOKEN
  });

  const response = await fetch(`${url}?${params}`);
  if (!response.ok) throw new Error(`Trello API error: ${response.statusText}`);
  return await response.json();
}

async function moveCardToList(cardId, newListId, config) {
  const url = `https://api.trello.com/1/cards/${cardId}`;
  const params = {
    key: config.TRELLO_API_KEY,
    token: config.TRELLO_TOKEN,
    idList: newListId,
    pos: 'top'
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  
  if (!response.ok) throw new Error(`Trello API error: ${response.statusText}`);
  return await response.json();
}

async function getCalendarEvents(timeMin, timeMax, accessToken, refreshToken, config) {
  const allEvents = [];
  const eventTitleMap = new Map();
  let currentAccessToken = accessToken;
  
  for (const calendarId of config.CALENDAR_IDS) {
    try {
      const params = new URLSearchParams({
        timeMin, timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50'
      });

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
      let response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${currentAccessToken}` }
      });
      
      // If 401, try refreshing token
      if (response.status === 401) {
        console.log('🔄 Token expired, refreshing...');
        currentAccessToken = await refreshAccessToken(refreshToken);
        
        response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${currentAccessToken}` }
        });
      }
      
      const data = await response.json();
      if (!response.ok) throw new Error(`Calendar API error: ${data.error?.message}`);
      
      const events = data.items || [];
      console.log(`📅 ${calendarId.split('@')[0]}: ${events.length} events`);
      
      events.forEach(event => {
        const startTime = event.start?.dateTime || event.start?.date;
        
        // Filter events to only include those actually on tomorrow's date
        const eventDate = new Date(startTime).toDateString();
        const tomorrowDate = new Date(timeMin).toDateString();
        
        console.log(`  📅 ${event.summary}: ${startTime} (${eventDate}) - Target: ${tomorrowDate}`);
        
        if (eventDate === tomorrowDate) {
          const uniqueKey = `${event.summary || 'Untitled'}_${startTime}`;
          
          if (!eventTitleMap.has(uniqueKey)) {
            eventTitleMap.set(uniqueKey, true);
            allEvents.push(event);
            console.log(`    ✅ Added: ${event.summary}`);
          }
        } else {
          console.log(`    ❌ Skipped (wrong date): ${event.summary}`);
        }
      });
    } catch (error) {
      console.error(`❌ Failed to get events from ${calendarId}:`, error);
    }
  }
  
  return allEvents;
}

async function refreshAccessToken(refreshToken) {
  const refreshData = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  };

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(refreshData)
  });

  const tokens = await response.json();
  if (!response.ok) {
    throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error}`);
  }

  console.log('✅ Access token refreshed');
  return tokens.access_token;
}

async function createTrelloCard(listId, cardData, config) {
  const url = 'https://api.trello.com/1/cards';
  const params = {
    key: config.TRELLO_API_KEY,
    token: config.TRELLO_TOKEN,
    idList: listId,
    name: cardData.name,
    desc: cardData.description,
    due: cardData.due,
    pos: 'top'
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!response.ok) throw new Error(`Trello API error: ${response.statusText}`);
  return await response.json();
}

function formatEvent(event) {
  const startTime = event.start?.dateTime || event.start?.date;
  const endTime = event.end?.dateTime || event.end?.date;
  
  let description = '';
  if (event.description) description += `${event.description}\n\n`;
  
  description += `📅 **Calendar Event**\n`;
  description += `• Start: ${new Date(startTime).toLocaleString()}\n`;
  description += `• End: ${new Date(endTime).toLocaleString()}\n`;
  
  if (event.location) description += `• Location: ${event.location}\n`;
  if (event.htmlLink) description += `• [View in Google Calendar](${event.htmlLink})\n`;
  
  description += `\n🔗 Event ID: ${event.id}`;
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  return {
    name: event.summary || 'Untitled Event',
    description: description,
    due: tomorrow.toISOString()
  };
}