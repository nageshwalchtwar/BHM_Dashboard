import { NextResponse } from "next/server"
import { GoogleDriveCSVReader, EXTRACTED_FOLDER_ID } from "@/lib/google-drive"

export async function GET(request: Request) {
  try {
    const driveReader = new GoogleDriveCSVReader({
      folderId: EXTRACTED_FOLDER_ID,
      apiKey: process.env.GOOGLE_DRIVE_API_KEY,
      accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN
    })

    // First, try to list files
    console.log('Testing Google Drive access...')
    console.log('Folder ID:', EXTRACTED_FOLDER_ID)
    console.log('API Key available:', !!process.env.GOOGLE_DRIVE_API_KEY)
    console.log('Access Token available:', !!process.env.GOOGLE_DRIVE_ACCESS_TOKEN)

    const files = await driveReader.listCSVFiles()
    console.log('Files found:', files.length)

    if (files.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No CSV files found in the folder",
        debug: {
          folderId: EXTRACTED_FOLDER_ID,
          hasApiKey: !!process.env.GOOGLE_DRIVE_API_KEY,
          hasAccessToken: !!process.env.GOOGLE_DRIVE_ACCESS_TOKEN
        }
      })
    }

    // Get the latest file info
    const latestFile = files[0]
    console.log('Latest file:', latestFile)

    // Try to read a small sample of the content
    let contentSample = "Unable to read content"
    try {
      const content = await driveReader.readFileContent(latestFile.id)
      contentSample = content.substring(0, 500) + (content.length > 500 ? '...' : '')
    } catch (contentError) {
      console.error('Error reading content:', contentError)
      contentSample = `Error reading content: ${contentError}`
    }

    return NextResponse.json({
      success: true,
      message: "Google Drive access test completed",
      data: {
        folderId: EXTRACTED_FOLDER_ID,
        totalFiles: files.length,
        latestFile: {
          name: latestFile.name,
          id: latestFile.id,
          modifiedTime: latestFile.modifiedTime,
          size: latestFile.size
        },
        allFiles: files.map(f => ({
          name: f.name,
          modifiedTime: f.modifiedTime,
          size: f.size
        })),
        contentSample,
        debug: {
          hasApiKey: !!process.env.GOOGLE_DRIVE_API_KEY,
          hasAccessToken: !!process.env.GOOGLE_DRIVE_ACCESS_TOKEN
        }
      }
    })

  } catch (error) {
    console.error('Google Drive test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      debug: {
        folderId: EXTRACTED_FOLDER_ID,
        hasApiKey: !!process.env.GOOGLE_DRIVE_API_KEY,
        hasAccessToken: !!process.env.GOOGLE_DRIVE_ACCESS_TOKEN,
        errorStack: error instanceof Error ? error.stack : "No stack trace"
      }
    }, { status: 500 })
  }
}