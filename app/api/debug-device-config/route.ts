import { NextRequest, NextResponse } from "next/server"
import { deviceConfig } from "@/lib/device-config"
import { getAvailableDates } from "@/lib/simple-google-api"

export async function GET(request: NextRequest) {
  try {
    const allDevices = deviceConfig.getAllDevices()
    const defaultDevice = deviceConfig.getDefaultDevice()

    const apiKey = process.env.GOOGLE_DRIVE_API_KEY
    const hasValidKey = apiKey && !apiKey.startsWith('your_')

    // Fetch dates for each device
    const devicesWithDates = await Promise.all(
      allDevices.map(async (device) => {
        try {
          const dates = await getAvailableDates(device.folderId)
          return {
            id: device.id,
            name: device.name,
            folderId: device.folderId,
            hasLatestFolder: !!device.latestDataFolderId,
            dateCount: dates.length,
            firstDates: dates.slice(0, 5),
            status: dates.length > 0 ? 'OK' : 'NO_DATA',
            error: null
          }
        } catch (err) {
          return {
            id: device.id,
            name: device.name,
            folderId: device.folderId,
            hasLatestFolder: !!device.latestDataFolderId,
            dateCount: 0,
            firstDates: [],
            status: 'ERROR',
            error: err instanceof Error ? err.message : String(err)
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnosis: {
        googleDriveApiKey: {
          configured: !!apiKey,
          isValid: hasValidKey,
          status: hasValidKey ? '✅ Valid API key present' : '❌ MISSING or invalid (starts with "your_")',
          hint: !hasValidKey ? 'Add GOOGLE_DRIVE_API_KEY to Railway variables' : null
        },
        devices: {
          total: allDevices.length,
          withOkStatus: devicesWithDates.filter(d => d.status === 'OK').length,
          withNoData: devicesWithDates.filter(d => d.status === 'NO_DATA').length,
          withError: devicesWithDates.filter(d => d.status === 'ERROR').length
        }
      },
      defaultDevice: defaultDevice ? { id: defaultDevice.id, name: defaultDevice.name } : null,
      allDevices: devicesWithDates,
      nextSteps: (() => {
        if (!hasValidKey) return "Step 1: Set GOOGLE_DRIVE_API_KEY in Railway"
        const failedDevices = devicesWithDates.filter(d => d.status !== 'OK')
        if (failedDevices.length > 0) {
          return `Step 2: Check that these folder IDs contain CSV files: ${failedDevices.map(d => d.folderId).join(', ')}`
        }
        return "✅ Configuration looks good! 1 Day mode should work."
      })()
    })
  } catch (error) {
    console.error('❌ Debug error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
