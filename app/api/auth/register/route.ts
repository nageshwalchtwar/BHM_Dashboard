import { NextRequest, NextResponse } from 'next/server'
import userAuthManager from '@/lib/user-auth'

// POST /api/auth/register - Register new user
export async function POST(request: NextRequest) {
  try {
    const { email, name, password } = await request.json()

    if (!email || !name || !password) {
      return NextResponse.json({
        success: false,
        error: 'Email, name, and password are required'
      }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        error: 'Please provide a valid email address'
      }, { status: 400 })
    }

    // Password strength validation
    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: 'Password must be at least 6 characters long'
      }, { status: 400 })
    }

    const result = userAuthManager.register(email, name, password)

    if (result.success) {
      return NextResponse.json({
        success: true,
        user: result.user,
        message: 'Account created successfully! Please login.'
      }, { status: 201 })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}