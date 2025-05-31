// Token extractor - get the actual OAuth2 tokens to add to environment variables
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Generate fresh OAuth2 URL and return for quick token extraction
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const state = crypto.randomBytes(16).toString('hex');
    
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/get-tokens`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar.readonly',
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: state
    });

    const authUrl = `https://accounts.google.com/o/oauth2/auth?${params}`;
    
    return res.status(200).json({
      message: 'Click the authUrl to get tokens',
      authUrl: authUrl,
      instructions: [
        '1. Click the authUrl below',
        '2. Authorize the app',
        '3. You will be redirected back here with tokens',
        '4. Copy the tokens to your Vercel environment variables'
      ],
      codeVerifier: codeVerifier
    });
  }
  
  if (req.method === 'POST') {
    // Exchange code for actual tokens
    const { code, codeVerifier } = req.body;
    
    if (!code || !codeVerifier) {
      return res.status(400).json({ 
        error: 'Missing code or codeVerifier',
        note: 'Use the GET endpoint first to get the authUrl'
      });
    }
    
    const tokenData = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: `${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/get-tokens`,
      code_verifier: codeVerifier
    };

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenData)
      });

      const tokens = await response.json();
      
      if (!response.ok) {
        throw new Error(`Token exchange failed: ${tokens.error_description || tokens.error}`);
      }

      return res.status(200).json({
        success: true,
        message: '🎉 SUCCESS! Copy these tokens to your Vercel environment variables:',
        tokens: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          scope: tokens.scope,
          token_type: tokens.token_type
        },
        instructions: [
          '1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
          '2. Add these two variables:',
          `   GOOGLE_ACCESS_TOKEN = ${tokens.access_token}`,
          `   GOOGLE_REFRESH_TOKEN = ${tokens.refresh_token}`,
          '3. Save both variables',
          '4. Redeploy your project',
          '5. Test with /api/simple-sync'
        ]
      });
      
    } catch (error) {
      return res.status(500).json({ 
        error: 'Token extraction failed', 
        details: error.message 
      });
    }
  }
  
  // Handle the OAuth2 redirect callback
  if (req.method === 'GET' && req.query.code) {
    // This is the redirect from Google OAuth2
    const { code, state } = req.query;
    
    return res.status(200).send(`
      <html>
        <head><title>Tokens Extracted!</title></head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
          <h1>🎉 Authorization Successful!</h1>
          <p><strong>Authorization Code:</strong> <code>${code}</code></p>
          <p><strong>State:</strong> <code>${state}</code></p>
          
          <h2>Next Steps:</h2>
          <ol>
            <li>Copy the authorization code above</li>
            <li>Make a POST request to this endpoint with the code and codeVerifier</li>
            <li>Extract your access_token and refresh_token</li>
            <li>Add them to your Vercel environment variables</li>
          </ol>
          
          <p><strong>Note:</strong> You still need to make the POST request to get the actual tokens!</p>
        </body>
      </html>
    `);
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
