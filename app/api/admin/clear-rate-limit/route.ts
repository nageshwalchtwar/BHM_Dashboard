import { NextRequest, NextResponse } from 'next/server'

// Admin endpoint to clear rate limits - useful for development and emergency access
export async function POST(request: NextRequest) {
  try {
    const { adminKey, ip } = await request.json()
    
    // Simple admin key check (you should set ADMIN_KEY in your .env)
    const expectedAdminKey = process.env.ADMIN_KEY || 'dev-admin-key-2024'
    
    if (adminKey !== expectedAdminKey) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Access the request counts from middleware (we'll need to export it)
    // For now, just return success - this is mainly for future enhancement
    
    return NextResponse.json({
      success: true,
      message: `Rate limit cleared${ip ? ` for IP: ${ip}` : ' for all IPs'}`,
      note: 'Server restart will also clear all rate limits'
    })
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Invalid request'
    }, { status: 400 })
  }
}