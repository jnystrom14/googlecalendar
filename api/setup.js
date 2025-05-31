// Initial setup endpoint for OAuth2 authentication
import { CalendarTrelloSync } from '../lib/calendar-sync.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  const sync = new CalendarTrelloSync();
  
  if (req.method === 'GET') {
    // Generate OAuth2 authorization URL
    try {
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      
      // Store code verifier temporarily (in production, use proper session storage)
      const state = crypto.randomBytes(16).toString('hex');
      
      const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: `${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/setup`,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        access_type: 'offline',
        prompt: 'consent',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state
      });

      const authUrl = `https://accounts.google.com/o/oauth2/auth?${params}`;
      
      // Store code verifier for later use (you'd use a proper session store in production)
      // For now, we'll return it in the response for manual handling
      
      return res.status(200).json({
        message: 'Visit this URL to authorize the application',
        authUrl: authUrl,
        instructions: [
          '1. Click the authorization URL below',
          '2. Sign in to Google and authorize the app',
          '3. Copy the authorization code from the redirect URL',
          '4. Make a POST request to /api/setup with the code'
        ],
        codeVerifier: codeVerifier // In production, store this securely
      });
      
    } catch (error) {
      return res.status(500).json({ error: 'Failed to generate auth URL', details: error.message });
    }
  }
  
  if (req.method === 'POST') {
    // Exchange authorization code for tokens
    try {
      const { code, codeVerifier } = req.body;
      
      if (!code || !codeVerifier) {
        return res.status(400).json({ 
          error: 'Missing required fields: code and codeVerifier' 
        });
      }
      
      const tokenData = {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/setup`,
        code_verifier: codeVerifier
      };

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenData)
      });

      const tokens = await response.json();
      
      if (!response.ok) {
        throw new Error(`Token exchange failed: ${tokens.error_description || tokens.error}`);
      }

      // Save tokens to Vercel KV
      await sync.saveTokens(tokens);
      
      return res.status(200).json({
        success: true,
        message: 'Authentication successful! Tokens saved.',
        note: 'You can now use the /api/sync endpoint and daily automation is active.'
      });
      
    } catch (error) {
      console.error('Setup error:', error);
      return res.status(500).json({ 
        error: 'Setup failed', 
        details: error.message 
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
