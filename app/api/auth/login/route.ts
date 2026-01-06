import { NextRequest, NextResponse } from 'next/server'
import userAuthManager from '@/lib/user-auth'

// POST /api/auth/login - Login user
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email and password are required'
      }, { status: 400 })
    }

    const result = userAuthManager.login(email, password)

    if (result.success) {
      // Set token as httpOnly cookie for security
      const response = NextResponse.json({
        success: true,
        user: result.user
      })

      response.cookies.set('bhm_token', result.token!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 // 24 hours
      })

      return response
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 401 })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}