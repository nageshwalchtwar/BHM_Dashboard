import { NextResponse } from 'next/server'
import emailService from '@/lib/email-service'

export async function POST() {
  try {
    console.log('🧪 Manual email configuration test...')
    
    // Force re-initialize the email service
    const testResult = await emailService.sendTestEmail('morning')
    
    console.log('🧪 Test result:', testResult)
    
    return NextResponse.json({
      success: testResult.success,
      message: testResult.message,
      details: {
        configured: emailService.isEmailConfigured(),
        status: emailService.getEmailStatus(),
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('🧪 Email test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Email test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: {
        configured: emailService.isEmailConfigured(),
        status: emailService.getEmailStatus(),
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}

export async function GET() {
  // Just return the current email configuration status
  return NextResponse.json({
    status: emailService.getEmailStatus(),
    configured: emailService.isEmailConfigured(),
    timestamp: new Date().toISOString(),
    envVars: {
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPass: !!process.env.EMAIL_PASS,
      emailService: process.env.EMAIL_SERVICE,
      userValue: process.env.EMAIL_USER,
      passLength: process.env.EMAIL_PASS?.length
    }
  })
}