import { NextRequest, NextResponse } from "next/server"
import { getAvailableDates } from "@/lib/simple-google-api"
import { getFolderIdForDevice, getLatestFolderIdForDevice, deviceConfig } from "@/lib/device-config"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("device")

    const folderId = getFolderIdForDevice(deviceId || undefined)
    const device = deviceId ? deviceConfig.getDevice(deviceId) : deviceConfig.getDefaultDevice()

    // Get dates from merged folder
    const mergedDates = await getAvailableDates(folderId)

    // Also get dates from LATEST folder (may have more recent data)
    let latestDates: string[] = [];
    try {
      const latestFolderId = getLatestFolderIdForDevice(deviceId || undefined);
      latestDates = await getAvailableDates(latestFolderId);
    } catch { /* no LATEST folder configured */ }

    // Combine and deduplicate
    const allDates = [...new Set([...mergedDates, ...latestDates])];
    const sortedDates = allDates.sort((a, b) => b.localeCompare(a));

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
