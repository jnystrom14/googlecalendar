// Token management endpoint - stores tokens in environment variables
// This is a temporary solution to get the automation working

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Save tokens (you'll need to manually add these to Vercel env vars)
    const { access_token, refresh_token } = req.body;
    
    if (!access_token || !refresh_token) {
      return res.status(400).json({ 
        error: 'Missing tokens',
        note: 'Please provide access_token and refresh_token'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Tokens received. Please add these to your Vercel environment variables:',
      instructions: [
        'Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
        'Add these two new variables:',
        `GOOGLE_ACCESS_TOKEN: ${access_token}`,
        `GOOGLE_REFRESH_TOKEN: ${refresh_token}`,
        'Then redeploy your project'
      ],
      access_token: access_token,
      refresh_token: refresh_token
    });
  }
  
  if (req.method === 'GET') {
    // Check if tokens exist in environment variables
    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    
    if (accessToken && refreshToken) {
      return res.status(200).json({
        success: true,
        message: 'Tokens found in environment variables',
        hasTokens: true
      });
    } else {
      return res.status(200).json({
        success: false,
        message: 'No tokens found in environment variables',
        hasTokens: false,
        missing: {
          access_token: !accessToken,
          refresh_token: !refreshToken
        }
      });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
