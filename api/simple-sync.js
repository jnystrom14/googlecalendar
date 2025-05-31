// Simple sync endpoint using environment variables for token storage
import { SimpleCalendarSync } from '../lib/simple-calendar-sync.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🚀 Simple sync triggered via API');
    
    const sync = new SimpleCalendarSync();
    
    // Check if we have the required tokens
    if (!sync.hasValidTokens()) {
      return res.status(400).json({
        success: false,
        error: 'Missing authentication tokens',
        message: 'Please add GOOGLE_ACCESS_TOKEN and GOOGLE_REFRESH_TOKEN to your Vercel environment variables',
        instructions: [
          '1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
          '2. Add: GOOGLE_ACCESS_TOKEN with your access token',
          '3. Add: GOOGLE_REFRESH_TOKEN with your refresh token',
          '4. Redeploy your project'
        ],
        timestamp: new Date().toISOString()
      });
    }
    
    const result = await sync.syncTodayAndTomorrow();
    
    return res.status(200).json({
      success: true,
      message: 'Sync completed successfully',
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Simple sync failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
