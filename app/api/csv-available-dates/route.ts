import { NextRequest, NextResponse } from "next/server"
import { getAvailableDates } from "@/lib/simple-google-api"
import { deviceConfig } from "@/lib/device-config"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("device")

    const device = deviceId ? deviceConfig.getDevice(deviceId) : deviceConfig.getDefaultDevice()
    
    console.log(`📅 Fetching available dates for device: ${deviceId || 'default'} (${device?.name || 'N/A'})`)
    
    if (!device) {
      console.error(`❌ Device not found: ${deviceId}`)
      return NextResponse.json({
        success: false,
        dates: [],
        error: `Device not found: ${deviceId}`
      }, { status: 404 })
    }

    const folderId = device.folderId
    console.log(`📂 Using folder ID: ${folderId}`)

    // Get dates from primary folder
    const mergedDates = await getAvailableDates(folderId)
    console.log(`✅ Found ${mergedDates.length} dates in folder: ${mergedDates.slice(0, 5).join(', ')}${mergedDates.length > 5 ? '...' : ''}`)

    // Also get dates from LATEST folder (may have more recent data)
    let latestDates: string[] = [];
    if (device.latestDataFolderId) {
      try {
        console.log(`📂 Also checking LATEST folder: ${device.latestDataFolderId}`)
        latestDates = await getAvailableDates(device.latestDataFolderId);
        console.log(`✅ Found ${latestDates.length} additional dates from LATEST folder`)
      } catch (err) {
        console.log(`⚠️ LATEST folder unavailable:`, err instanceof Error ? err.message : String(err))
      }
    }

    // Combine and deduplicate
    const allDates = [...new Set([...mergedDates, ...latestDates])];
    const sortedDates = allDates.sort((a, b) => b.localeCompare(a));

    console.log(`📋 Final date list (${sortedDates.length} dates): ${sortedDates.slice(0, 3).join(', ')}...`)

    return NextResponse.json({
      success: true,
      dates: sortedDates,
      device: device
        ? {
            id: device.id,
            name: device.name,
            folder: device.folderId,
          }
        : null,
    })
  } catch (error) {
    console.error('❌ Error fetching available dates:', error)
    return NextResponse.json(
      {
        success: false,
        dates: [],
        error: error instanceof Error ? error.message : "Failed to list available dates",
      },
      { status: 500 }
    )
  }
}
