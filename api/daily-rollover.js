// Daily rollover cron job - Runs at 4am daily
import { CalendarTrelloSync } from '../lib/calendar-sync.js';

export default async function handler(req, res) {
  try {
    console.log('🌅 Daily 4am rollover triggered');
    console.log(`🕐 Current time: ${new Date().toLocaleString()}`);
    
    const sync = new CalendarTrelloSync();
    const result = await sync.performDailyRollover();
    
    console.log('✨ Daily rollover completed successfully');
    
    return res.status(200).json({
      success: true,
      message: 'Daily rollover completed successfully',
      result: result,
      timestamp: new Date().toISOString(),
      nextRollover: 'Tomorrow at 4:00 AM'
    });
    
  } catch (error) {
    console.error('❌ Daily rollover failed:', error);
    
    // Still return 200 to prevent Vercel from retrying
    return res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      note: 'Will retry tomorrow at 4:00 AM'
    });
  }
}
