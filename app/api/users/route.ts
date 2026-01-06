import { NextRequest, NextResponse } from 'next/server'
import userAuthManager from '@/lib/user-auth'

// Helper function to authenticate admin user
async function authenticateAdmin(request: NextRequest) {
  const token = request.cookies.get('bhm_token')?.value
  if (!token) return null

  const user = userAuthManager.validateToken(token)
  if (!user || user.role !== 'admin') return null

  return user
}

// GET /api/users - Get all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const adminUser = await authenticateAdmin(request)
    if (!adminUser) {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 })
    }

    const users = userAuthManager.getAllUsers()
    const stats = userAuthManager.getStats()

    return NextResponse.json({
      success: true,
      users,
      stats
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// PUT /api/users - Update user role (admin only)
export async function PUT(request: NextRequest) {
  try {
    const adminUser = await authenticateAdmin(request)
    if (!adminUser) {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 })
    }

    const { userId, action } = await request.json()
    if (!userId || !action) {
      return NextResponse.json({
        success: false,
        error: 'User ID and action are required'
      }, { status: 400 })
    }

    let success = false
    let message = ''

    switch (action) {
      case 'promote':
        success = userAuthManager.promoteToAdmin(userId, adminUser.id)
        message = success ? 'User promoted to admin' : 'Failed to promote user'
        break
      case 'demote':
        success = userAuthManager.demoteToUser(userId, adminUser.id)
        message = success ? 'User demoted to regular user' : 'Failed to demote user'
        break
      case 'deactivate':
        success = userAuthManager.deactivateUser(userId, adminUser.id)
        message = success ? 'User deactivated' : 'Failed to deactivate user'
        break
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }

    if (success) {
      return NextResponse.json({
        success: true,
        message
      })
    } else {
      return NextResponse.json({
        success: false,
        error: message
      }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}