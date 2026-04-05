import { NextRequest, NextResponse } from "next/server"
import { parseMergedDayCSV } from "@/lib/merged-csv-parser"
import { getCSVByDate } from "@/lib/simple-google-api"
import { deviceConfig } from "@/lib/device-config"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date") || "2026-02-25"
  const deviceId = searchParams.get("device") || "d4"

  try {
    const device = deviceConfig.getDevice(deviceId)
    
    if (!device) {
      return NextResponse.json({
        success: false,
        error: `Device ${deviceId} not found`,
        availableDevices: deviceConfig.getDevices().map(d => ({ id: d.id, name: d.name }))
      }, { status: 404 })
    }

    console.log(`🧪 TEST: Parsing CSV for ${device.name} on ${date}`)
    console.log(`📂 Using folder: ${device.folderId}`)

    const result = await getCSVByDate(date, device.folderId)
    if (!result) {
      return NextResponse.json({
        success: false,
        error: `No CSV found for ${date}`,
        device: device.name,
        folder: device.folderId
      }, { status: 404 })
    }

    console.log(`📄 CSV Content length: ${result.content.length} bytes`)
    const lines = result.content.split('\n').filter(l => l.trim())
    console.log(`📊 Total lines: ${lines.length}`)
    console.log(`📋 Header: ${lines[0]}`)
    console.log(`📋 Line 1: ${lines[1]}`)
    console.log(`📋 Line 2: ${lines[2]}`)

    const parsed = parseMergedDayCSV(result.content)
    console.log(`✅ Parsed ${parsed.length} rows`)
    
    if (parsed.length > 0) {
      console.log(`📊 First row:`, JSON.stringify(parsed[0]))
      console.log(`📊 Last row:`, JSON.stringify(parsed[parsed.length - 1]))
      console.log(`🧮 Sample accel_z values: ${parsed.slice(0, 5).map(p => p.accel_z).join(', ')}`)
    }

    return NextResponse.json({
      success: true,
      device: { id: device.id, name: device.name },
      folder: device.folderId,
      filename: result.filename,
      csvSize: result.content.length,
      csvLineCount: lines.length,
      csvHeader: lines[0],
      csvLine1: lines[1],
      csvLine2: lines[2],
      parsedRowCount: parsed.length,
      firstRow: parsed[0] || null,
      lastRow: parsed[parsed.length - 1] || null,
      sampleAccelZValues: parsed.slice(0, 5).map(p => ({ ts: new Date(p.timestamp).toISOString().slice(11, 19), az: p.accel_z })),
      allAccelZValues: parsed.map(p => p.accel_z),
      stats: {
        minAZ: Math.min(...parsed.map(p => p.accel_z)),
        maxAZ: Math.max(...parsed.map(p => p.accel_z)),
        avgAZ: parsed.reduce((s, p) => s + p.accel_z, 0) / (parsed.length || 1),
      }
    })
  } catch (error) {
    console.error('❌ Test endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
