// Test rollover using deployed CalendarTrelloSync (with KV storage)
import { CalendarTrelloSync } from '../lib/calendar-sync.js';

export default async function handler(req, res) {
  try {
    console.log('🔄 Test rollover triggered');
    console.log(`🕐 Current time: ${new Date().toLocaleString()}`);
    
    const sync = new CalendarTrelloSync();
    const result = await sync.performDailyRollover();
    
    console.log('✨ Test rollover completed successfully');
    
    return res.status(200).json({
      success: true,
      message: 'Test rollover completed successfully',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Test rollover failed:', error);
    
    return res.status(200).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}