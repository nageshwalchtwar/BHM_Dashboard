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
    // Get device configuration
    const device = deviceId ? deviceConfig.getDevice(deviceId) : deviceConfig.getDefaultDevice()
    
    console.log(`📱 Device lookup: ${deviceId || 'default'} → ${device?.name || 'NOT FOUND'}`)
    
    if (!device) {
      return NextResponse.json({
        success: false,
        error: `Device not found: ${deviceId}`,
      }, { status: 404 })
    }

    let csvContent = null
    let folderId = null

    // Strategy 1: Try merged folder first
    try {
      folderId = device.folderId
      console.log(`📂 [1] Trying primary folder=${folderId}`)
      const result = await getCSVByDate(date, folderId)
      if (result) {
        csvContent = result.content
        console.log(`✅ Found merged CSV: ${result.filename} (${csvContent.length} bytes)`)
      }
    } catch (e) {
      console.log(`⚠️ Primary folder failed:`, (e as Error).message)
    }

    // Strategy 2: Fallback to LATEST folder
    if (!csvContent && device.latestDataFolderId) {
      try {
        folderId = device.latestDataFolderId
        console.log(`📂 [2] Trying LATEST folder=${folderId}`)
        const result = await getCSVByDate(date, folderId)
        if (result) {
          csvContent = result.content
          console.log(`✅ Found merged CSV in LATEST: ${result.filename} (${csvContent.length} bytes)`)
        }
      } catch (e) {
        console.log(`⚠️ LATEST folder failed:`, (e as Error).message)
      }
    }

    if (!csvContent) {
      return NextResponse.json({
        success: false,
        error: `No merged CSV found for date: ${date} in device ${device.name}`,
      }, { status: 404 })
    }

    // Parse merged CSV with pre-computed RMS and averages
    console.log(`🔄 Parsing CSV: ${csvContent.length} bytes, ${csvContent.split('\n').length} lines`)
    const mergedData = parseMergedDayCSV(csvContent)
    
    if (mergedData.length === 0) {
      // More detailed error logging
      console.error('❌ Failed to parse CSV for date:', date)
      console.log('📄 CSV Preview (first 1000 chars):', csvContent.slice(0, 1000))
      console.log('📊 CSV line count:', csvContent.split('\n').length)
      console.log('📋 CSV header:', csvContent.split('\n')[0])
      return NextResponse.json({
        success: false,
        error: `Failed to parse merged CSV for date: ${date}. CSV may have unexpected format. Check server logs for details.`,
        debug: {
          hasContent: csvContent.length > 0,
          lineCount: csvContent.split('\n').length,
          header: csvContent.split('\n')[0],
          device: device.name,
          folder: folderId,
        }
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

    // Diagnostic: Check if any field is all NaN
    const accelZCount = transformedData.filter(d => !isNaN(d.accel_z)).length;
    const tempCount = transformedData.filter(d => !isNaN(d.temperature_c)).length;
    const lvdtCount = transformedData.filter(d => !isNaN(d.stroke_mm)).length;

    if (accelZCount === 0) {
      console.error('🚨 CRITICAL: All accel_z values are NaN!');
      console.error('📊 Sample row:', JSON.stringify(transformedData[0]));
      console.error('📋 Data count: accel_z=', accelZCount, ', temp=', tempCount, ', lvdt=', lvdtCount);
    } else {
      console.log(`✅ Data quality: accel_z=${accelZCount}/${transformedData.length}, temp=${tempCount}/${transformedData.length}, lvdt=${lvdtCount}/${transformedData.length}`)
    }

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
