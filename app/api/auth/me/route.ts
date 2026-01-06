import { NextRequest, NextResponse } from 'next/server'
import userAuthManager from '@/lib/user-auth'

// GET /api/auth/me - Get current user info
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('bhm_token')?.value

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    const user = userAuthManager.validateToken(token)

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired token'
      }, { status: 401 })
    }

    const { password, ...userWithoutPassword } = user
    return NextResponse.json({
      success: true,
      user: userWithoutPassword
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}