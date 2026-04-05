import { NextRequest, NextResponse } from "next/server"
import { deviceConfig } from "@/lib/device-config"
import { getAvailableDates } from "@/lib/simple-google-api"

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 CSV Available Dates DEBUG endpoint called')
    
    // List all configured devices
    const allDevices = deviceConfig.getAllDevices()
    console.log(`📱 All configured devices: ${allDevices.map(d => `${d.id}(${d.name})`).join(', ')}`)

    // Check Device_S specifically
    const deviceS = deviceConfig.getDevice('Device_S')
    console.log(`📱 Device_S lookup result:`, deviceS ? 'FOUND' : 'NOT FOUND')
    if (deviceS) {
      console.log(`   ID: ${deviceS.id}`)
      console.log(`   Name: ${deviceS.name}`)
      console.log(`   FolderId: ${deviceS.folderId}`)
      console.log(`   FolderURL: ${deviceS.folderUrl}`)
    }

    // Check environment variables
    console.log(`\n🔐 Environment check:`)
    console.log(`   DEVICE_S_FOLDER_ID: ${process.env.DEVICE_S_FOLDER_ID ? '✅ SET' : '❌ NOT SET'}`)
    console.log(`   DEVICE_S_NAME: ${process.env.DEVICE_S_NAME ? '✅ SET' : '❌ NOT SET'}`)
    console.log(`   GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? '✅ SET' : '❌ NOT SET'}`)

    // Get dates for Device_S
    if (!deviceS) {
      return NextResponse.json({
        success: false,
        error: 'Device_S not found. Check DEVICE_S_FOLDER_ID environment variable',
        debug: {
          deviceSFound: false,
          configuredDevices: allDevices.map(d => ({ id: d.id, name: d.name }))
        }
      }, { status: 404 })
    }

    console.log(`\n📂 Fetching dates from Device_S folder: ${deviceS.folderId}`)
    const dates = await getAvailableDates(deviceS.folderId)
    
    console.log(`✅ Retrieved ${dates.length} dates: ${dates.slice(0, 5).join(', ')}${dates.length > 5 ? '...' : ''}`)

    return NextResponse.json({
      success: true,
      deviceS: {
        id: deviceS.id,
        name: deviceS.name,
        folderId: deviceS.folderId,
        folderUrl: deviceS.folderUrl
      },
      dates: dates,
      count: dates.length,
      sample: dates.slice(0, 5)
    })

  } catch (error) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
