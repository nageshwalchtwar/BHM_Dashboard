import { NextRequest, NextResponse } from "next/server"
import { parseMergedDayCSV, MergedDayData } from "@/lib/merged-csv-parser"
import { getFolderIdForDevice, getLatestFolderIdForDevice, deviceConfig } from "@/lib/device-config"
import { getCSVByDate } from "@/lib/simple-google-api"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date") || ""
  const deviceId = searchParams.get("device")

  console.log(`📊 Merged CSV API: date=${date}, device=${deviceId || 'default'}`)

  if (!date) {
    return NextResponse.json({
      success: false,
      error: "Date parameter required",
    }, { status: 400 })
  }

  try {
    const device = deviceId ? deviceConfig.getDevice(deviceId) : deviceConfig.getDefaultDevice()
    let csvContent = null
    let folderId = null

    // Strategy 1: Try merged folder first
    try {
      folderId = getFolderIdForDevice(deviceId || undefined)
      console.log(`📂 [1] Trying merged folder=${folderId}`)
      const result = await getCSVByDate(date, folderId)
      if (result) {
        csvContent = result.content
        console.log(`✅ Found merged CSV: ${result.filename}`)
      }
    } catch (e) {
      console.log(`⚠️ Merged folder failed:`, (e as Error).message)
    }

    // Strategy 2: Fallback to LATEST folder
    if (!csvContent) {
      try {
        folderId = getLatestFolderIdForDevice(deviceId || undefined)
        console.log(`📂 [2] Trying LATEST folder=${folderId}`)
        const result = await getCSVByDate(date, folderId)
        if (result) {
          csvContent = result.content
          console.log(`✅ Found merged CSV in LATEST: ${result.filename}`)
        }
      } catch (e) {
        console.log(`⚠️ LATEST folder failed:`, (e as Error).message)
      }
    }

    if (!csvContent) {
      return NextResponse.json({
        success: false,
        error: `No merged CSV found for date: ${date}`,
      }, { status: 404 })
    }

    // Parse merged CSV with pre-computed RMS and averages
    const mergedData = parseMergedDayCSV(csvContent)
    if (mergedData.length === 0) {
      // Log first 500 characters of CSV for debugging
      console.log('📄 CSV Preview (first 500 chars):', csvContent.slice(0, 500))
      return NextResponse.json({
        success: false,
        error: `Failed to parse merged CSV for date: ${date}. Check server logs for details.`,
      }, { status: 422 })
    }

    // Convert to API response format (map merged columns to standard names)
    const transformedData = mergedData.map((row: MergedDayData) => ({
      timestamp: row.timestamp,
      rawTimestamp: new Date(row.timestamp).toISOString().slice(11, 19), // HH:MM:SS
      accel_z: row.accel_z,  // az_adxl_rms (already RMS for 1-day data)
      temperature_c: row.temperature_c,  // temp_avg_10s
      stroke_mm: row.stroke_mm,  // lvdt_avg_10s
    }))

    const responseRMS = {
      accel_z_rms: Math.abs(transformedData[transformedData.length - 1]?.accel_z ?? 0),
    }

    // Cache response for 5 minutes for merged day data
    const response = {
      success: true,
      data: transformedData,
      rms: responseRMS,
      metadata: {
        totalPoints: transformedData.length,
        device: device,
        filename: `${date}-merged.csv`,
        isMergedDay: true,
      },
      isRMSData: true, // 1-day data is pre-computed RMS, not per-second windows
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 min cache
      },
    })
  } catch (error) {
    console.error("❌ Merged CSV API error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
