import { NextRequest, NextResponse } from 'next/server'

// OAuth configuration for different providers
const OAUTH_CONFIG = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  },
  github: {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
    clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const provider = params.provider.toLowerCase()
  
  if (!['google', 'github', 'microsoft'].includes(provider)) {
    return NextResponse.json({
      success: false,
      error: 'Invalid OAuth provider. Supported: google, github, microsoft'
    }, { status: 400 })
  }

  const config = OAUTH_CONFIG[provider as keyof typeof OAUTH_CONFIG]
  
  // Check if OAuth is configured for this provider
  if (!config.clientId || !config.clientSecret) {
    return NextResponse.json({
      success: false,
      error: `${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth is not configured. Please contact the administrator.`,
      hint: `Set ${provider.toUpperCase()}_OAUTH_CLIENT_ID and ${provider.toUpperCase()}_OAUTH_CLIENT_SECRET environment variables.`
    }, { status: 503 })
  }

  // Get the callback URL
  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 
    request.headers.get('origin') || 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/auth/oauth/callback`
  
  // Generate state for CSRF protection
  const state = Buffer.from(JSON.stringify({
    provider,
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(7)
  })).toString('base64')

  // Build authorization URL
  const authParams = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state: state,
  })

  // Add provider-specific params
  if (provider === 'google') {
    authParams.append('access_type', 'offline')
    authParams.append('prompt', 'consent')
  }

  const authUrl = `${config.authUrl}?${authParams.toString()}`

  return NextResponse.json({
    success: true,
    authUrl,
    provider
  })
}
