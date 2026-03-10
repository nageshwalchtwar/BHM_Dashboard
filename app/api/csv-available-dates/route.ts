import { NextRequest, NextResponse } from "next/server"
import { getAvailableDates } from "@/lib/simple-google-api"
import { getFolderIdForDevice, deviceConfig } from "@/lib/device-config"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("device")

    const folderId = getFolderIdForDevice(deviceId || undefined)
    const device = deviceId ? deviceConfig.getDevice(deviceId) : deviceConfig.getDefaultDevice()

    const dates = await getAvailableDates(folderId)
    const sortedDates = [...dates].sort((a, b) => b.localeCompare(a))

    return NextResponse.json({
      success: true,
      dates: sortedDates,
      device: device
        ? {
            id: device.id,
            name: device.name,
          }
        : null,
    })
  } catch (error) {
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
