import { NextRequest, NextResponse } from 'next/server'
import userAuthManager from '@/lib/user-auth'

// POST /api/auth/logout - Logout user
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('bhm_token')?.value

    if (token) {
      userAuthManager.logout(token)
    }

    // Clear the token cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })

    response.cookies.set('bhm_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0
    })

    return response
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}