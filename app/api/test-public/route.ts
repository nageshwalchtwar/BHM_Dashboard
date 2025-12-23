import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    // Since the folder is public, let's try to access it without API keys
    const folderId = "10T_z5tX0XjWQ9OAlPdPQpmPXbpE0GxqM"
    
    console.log('Testing direct public access to folder:', folderId)
    
    // Try to access the folder as a public resource
    // This is a workaround for public folders without API keys
    const publicUrl = `https://drive.google.com/drive/folders/${folderId}`
    
    return NextResponse.json({
      success: false,
      error: "Google Drive API access requires authentication",
      message: "To access your CSV files, you need to set up Google Drive API credentials",
      debug: {
        folderId,
        publicUrl,
        hasApiKey: !!process.env.GOOGLE_DRIVE_API_KEY,
        hasAccessToken: !!process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
        instructions: [
          "1. Go to Google Cloud Console (https://console.cloud.google.com/)",
          "2. Create a new project or select existing",
          "3. Enable Google Drive API", 
          "4. Create credentials > API Key",
          "5. Add GOOGLE_DRIVE_API_KEY to Vercel environment variables"
        ]
      }
    })

  } catch (error) {
    console.error('Test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debug: {
        errorStack: error instanceof Error ? error.stack : "No stack trace"
      }
    }, { status: 500 })
  }
}