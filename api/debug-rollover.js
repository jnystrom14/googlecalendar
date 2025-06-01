// Debug version of manual rollover to see what's happening
export default async function handler(req, res) {
  try {
    console.log('🔄 Debug rollover triggered');
    
    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    
    if (!accessToken || !refreshToken) {
      throw new Error('Missing environment tokens');
    }
    
    const config = {
      CALENDAR_IDS: [
        'carlnystrom116@gmail.com',
        'llheqt9na4oplidmvmcipln0ac@group.calendar.google.com'
      ]
    };
    
    // Calculate tomorrow's range
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startOfDay = new Date(tomorrow);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(23, 59, 59, 999);
    
    console.log(`📅 Searching for events: ${startOfDay.toISOString()} to ${endOfDay.toISOString()}`);
    
    const debugData = {
      dateRange: {
        start: startOfDay.toISOString(),
        end: endOfDay.toISOString(),
        dateString: startOfDay.toDateString()
      },
      calendarResponses: {}
    };
    
    // Test each calendar individually
    for (const calendarId of config.CALENDAR_IDS) {
      try {
        const params = new URLSearchParams({
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '50'
        });

        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
        console.log(`🔍 Fetching from: ${calendarId}`);
        console.log(`🔗 URL: ${url}`);
        
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const data = await response.json();
        
        debugData.calendarResponses[calendarId] = {
          status: response.status,
          ok: response.ok,
          itemCount: data.items?.length || 0,
          items: data.items || [],
          error: data.error || null,
          rawResponse: data
        };
        
        console.log(`📊 ${calendarId}: ${response.status} - ${data.items?.length || 0} events`);
        
        if (data.items?.length > 0) {
          data.items.forEach(event => {
            console.log(`  📅 ${event.summary}: ${event.start?.dateTime || event.start?.date}`);
          });
        }
        
      } catch (error) {
        console.error(`❌ Error with ${calendarId}:`, error);
        debugData.calendarResponses[calendarId] = {
          error: error.message
        };
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Debug rollover completed',
      debug: debugData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Debug rollover failed:', error);
    return res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}