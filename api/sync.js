// Manual sync endpoint - /api/sync
import { CalendarTrelloSync } from '../lib/calendar-sync.js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Manual sync triggered via API');
    
    const sync = new CalendarTrelloSync();
    const result = await sync.syncTodayAndTomorrow();
    
    return res.status(200).json({
      success: true,
      message: 'Sync completed successfully',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Manual sync failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
