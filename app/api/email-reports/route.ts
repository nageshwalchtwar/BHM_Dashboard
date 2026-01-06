import { NextRequest, NextResponse } from 'next/server'
import emailService from '@/lib/email-service'
import emailScheduler from '@/lib/email-scheduler'
import userAuthManager from '@/lib/user-auth'

// Helper function to authenticate admin user
async function authenticateAdmin(request: NextRequest) {
  const token = request.cookies.get('bhm_token')?.value
  if (!token) return null

  const user = userAuthManager.validateToken(token)
  if (!user || user.role !== 'admin') return null

  return user
}

// GET /api/email-reports - Get email report status and jobs
export async function GET(request: NextRequest) {
  try {
    const adminUser = await authenticateAdmin(request)
    if (!adminUser) {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 })
    }

    const jobs = emailScheduler.getJobs()
    const systemHealth = await emailService.getSystemHealth()
    const userStats = userAuthManager.getStats()

    return NextResponse.json({
      success: true,
      jobs,
      systemHealth,
      userStats,
      lastRun: {
        morning: jobs.find(j => j.id === 'morning-report')?.lastRun,
        evening: jobs.find(j => j.id === 'evening-report')?.lastRun
      }
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST /api/email-reports - Trigger manual email or manage jobs
export async function POST(request: NextRequest) {
  try {
    const adminUser = await authenticateAdmin(request)
    if (!adminUser) {
      return NextResponse.json({
        success: false,
        error: 'Admin access required'
      }, { status: 403 })
    }

    const { action, jobId, timeOfDay, isActive } = await request.json()

    switch (action) {
      case 'trigger':
        if (!jobId) {
          return NextResponse.json({
            success: false,
            error: 'Job ID is required'
          }, { status: 400 })
        }

        const success = await emailScheduler.triggerJob(jobId)
        if (success) {
          return NextResponse.json({
            success: true,
            message: `Job ${jobId} triggered successfully`
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to trigger job'
          }, { status: 400 })
        }

      case 'test':
        const testTimeOfDay = timeOfDay === 'evening' ? 'evening' : 'morning'
        const result = await emailService.sendTestEmail(testTimeOfDay)
        return NextResponse.json({
          success: true,
          message: `Test ${testTimeOfDay} email sent to ${result.sentCount} users`,
          result
        })

      case 'toggle':
        if (!jobId || typeof isActive !== 'boolean') {
          return NextResponse.json({
            success: false,
            error: 'Job ID and isActive status are required'
          }, { status: 400 })
        }

        const toggleSuccess = emailScheduler.toggleJob(jobId, isActive)
        if (toggleSuccess) {
          return NextResponse.json({
            success: true,
            message: `Job ${jobId} ${isActive ? 'enabled' : 'disabled'}`
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Failed to toggle job'
          }, { status: 400 })
        }

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action'
        }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}