import { NextResponse } from "next/server"

export async function GET() {
  // Debug: Check all environment variables related to our app
  const envVars = {
    GOOGLE_DRIVE_API_KEY: process.env.GOOGLE_DRIVE_API_KEY || 'NOT_SET',
    GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || 'NOT_SET',
    DEVICE_1_FOLDER_ID: process.env.DEVICE_1_FOLDER_ID || 'NOT_SET',
    DEVICE_2_FOLDER_ID: process.env.DEVICE_2_FOLDER_ID || 'NOT_SET', 
    DEVICE_3_FOLDER_ID: process.env.DEVICE_3_FOLDER_ID || 'NOT_SET',
    DEVICE_4_FOLDER_ID: process.env.DEVICE_4_FOLDER_ID || 'NOT_SET',
    DEVICE_5_FOLDER_ID: process.env.DEVICE_5_FOLDER_ID || 'NOT_SET',
    DEVICE_1_NAME: process.env.DEVICE_1_NAME || 'NOT_SET',
    DEVICE_2_NAME: process.env.DEVICE_2_NAME || 'NOT_SET',
    DEVICE_3_NAME: process.env.DEVICE_3_NAME || 'NOT_SET',
    DEVICE_4_NAME: process.env.DEVICE_4_NAME || 'NOT_SET',
    DEVICE_5_NAME: process.env.DEVICE_5_NAME || 'NOT_SET',
    NODE_ENV: process.env.NODE_ENV || 'NOT_SET',
    // Check if any env vars are loaded at all
    hasAnyGoogleVars: !!(process.env.GOOGLE_DRIVE_API_KEY || process.env.DEVICE_1_FOLDER_ID),
    totalEnvVars: Object.keys(process.env).length
  }

  console.log('🔍 Environment Variables Check:', envVars)

  return NextResponse.json({
    success: true,
    environment: envVars,
    message: envVars.GOOGLE_DRIVE_API_KEY !== 'NOT_SET' ? 
      '✅ Environment variables are loaded correctly!' : 
      '❌ Environment variables are not being loaded. Server restart needed.',
    timestamp: new Date().toISOString()
  })
}