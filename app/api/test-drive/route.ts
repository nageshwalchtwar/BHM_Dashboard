import { NextResponse } from "next/server"
import { RealGoogleDriveReader } from '@/lib/real-drive-reader'
import { SimpleGoogleDriveReader, getLatestCSVSimple } from '@/lib/simple-drive-reader'

const NEW_FOLDER_ID = '17ju54uc22YcUCzyAjijIg1J2m-B3M1Ai'

export async function GET(request: Request) {
  console.log('🧪 Testing new Google Drive folder access...')
  
  const results = {
    folderId: NEW_FOLDER_ID,
    folderUrl: `https://drive.google.com/drive/folders/${NEW_FOLDER_ID}`,
    tests: [] as any[]
  }

  // Test 1: Real Google Drive Reader
  try {
    console.log('🎯 Testing RealGoogleDriveReader...')
    const realReader = new RealGoogleDriveReader(NEW_FOLDER_ID)
    const realResult = await realReader.getLatestRealCSV()
    
    results.tests.push({
      method: 'RealGoogleDriveReader',
      success: !!realResult,
      filename: realResult?.filename || null,
      contentLength: realResult?.content?.length || 0,
      hasExpectedFormat: realResult?.content?.includes('Device,Timestamp') || false
    })
  } catch (error: any) {
    results.tests.push({
      method: 'RealGoogleDriveReader',
      success: false,
      error: error.message
    })
  }

  // Test 2: Simple Google Drive Reader
  try {
    console.log('🔍 Testing SimpleGoogleDriveReader...')
    const simpleContent = await getLatestCSVSimple(NEW_FOLDER_ID)
    
    results.tests.push({
      method: 'SimpleGoogleDriveReader',
      success: !!simpleContent,
      contentLength: simpleContent?.length || 0,
      hasExpectedFormat: simpleContent?.includes('Device,Timestamp') || false
    })
  } catch (error: any) {
    results.tests.push({
      method: 'SimpleGoogleDriveReader',
      success: false,
      error: error.message
    })
  }

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