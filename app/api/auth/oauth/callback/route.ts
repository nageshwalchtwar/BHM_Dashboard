import { NextRequest, NextResponse } from 'next/server'
import userAuthManager from '@/lib/user-auth'

// OAuth configuration for different providers
const OAUTH_CONFIG = {
  google: {
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  },
  github: {
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    emailUrl: 'https://api.github.com/user/emails',
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
  },
  microsoft: {
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
  }
}

async function exchangeCodeForToken(provider: string, code: string, redirectUri: string) {
  const config = OAUTH_CONFIG[provider as keyof typeof OAUTH_CONFIG]
  
  const tokenParams = new URLSearchParams({
    client_id: config.clientId!,
    client_secret: config.clientSecret!,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: tokenParams.toString(),
  })

  return response.json()
}

async function getUserInfo(provider: string, accessToken: string) {
  const config = OAUTH_CONFIG[provider as keyof typeof OAUTH_CONFIG]
  
  const headers: HeadersInit = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/json',
  }

  // GitHub requires a different auth header format
  if (provider === 'github') {
    headers['Authorization'] = `token ${accessToken}`
  }

  const response = await fetch(config.userInfoUrl, { headers })
  const userInfo = await response.json()

  // For GitHub, we need to fetch email separately if not provided
  if (provider === 'github' && !userInfo.email) {
    const githubConfig = OAUTH_CONFIG.github
    const emailResponse = await fetch(githubConfig.emailUrl, { headers })
    const emails = await emailResponse.json()
    const primaryEmail = emails.find((e: any) => e.primary)?.email || emails[0]?.email
    userInfo.email = primaryEmail
  }

  return userInfo
}

function normalizeUserInfo(provider: string, userInfo: any) {
  switch (provider) {
    case 'google':
      return {
        email: userInfo.email,
        name: userInfo.name || userInfo.given_name || 'Google User',
        picture: userInfo.picture,
        provider: 'google',
        providerId: userInfo.id,
      }
    case 'github':
      return {
        email: userInfo.email,
        name: userInfo.name || userInfo.login || 'GitHub User',
        picture: userInfo.avatar_url,
        provider: 'github',
        providerId: String(userInfo.id),
      }
    case 'microsoft':
      return {
        email: userInfo.mail || userInfo.userPrincipalName,
        name: userInfo.displayName || 'Microsoft User',
        picture: null,
        provider: 'microsoft',
        providerId: userInfo.id,
      }
    default:
      throw new Error('Unknown provider')
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // Get the base URL for redirects
  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL || 
    request.headers.get('origin') || 'http://localhost:3000'

  // Handle OAuth errors
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Authentication failed'
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorDescription)}`, baseUrl))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=Invalid OAuth response', baseUrl))
  }

  try {
    // Decode state to get provider
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const provider = stateData.provider

    if (!['google', 'github', 'microsoft'].includes(provider)) {
      return NextResponse.redirect(new URL('/login?error=Invalid provider', baseUrl))
    }

    const config = OAUTH_CONFIG[provider as keyof typeof OAUTH_CONFIG]
    
    if (!config.clientId || !config.clientSecret) {
      return NextResponse.redirect(new URL('/login?error=OAuth not configured', baseUrl))
    }

    // Get the callback URL
    const redirectUri = `${baseUrl}/api/auth/oauth/callback`

    // Exchange code for access token
    const tokenData = await exchangeCodeForToken(provider, code, redirectUri)

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData)
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(tokenData.error_description || 'Token exchange failed')}`, baseUrl))
    }

    const accessToken = tokenData.access_token

    // Get user info from provider
    const rawUserInfo = await getUserInfo(provider, accessToken)
    const userInfo = normalizeUserInfo(provider, rawUserInfo)

    if (!userInfo.email) {
      return NextResponse.redirect(new URL('/login?error=Could not retrieve email from provider', baseUrl))
    }

    // Register or login the user via OAuth
    const result = userAuthManager.oauthLogin(
      userInfo.email,
      userInfo.name,
      userInfo.provider,
      userInfo.providerId
    )

    if (result.success && result.token) {
      // Set authentication cookie and redirect to dashboard
      const response = NextResponse.redirect(new URL('/', baseUrl))
      
      response.cookies.set('bhm_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 // 24 hours
      })

      return response
    } else {
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(result.error || 'Authentication failed')}`, baseUrl))
    }

  } catch (error) {
    console.error('OAuth callback error:', error)
    const fallbackUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    return NextResponse.redirect(new URL('/login?error=Authentication failed. Please try again.', fallbackUrl))
  }
}
