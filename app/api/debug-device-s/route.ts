import { NextRequest, NextResponse } from "next/server"
import { SimpleGoogleDriveAPI } from "@/lib/simple-google-api"
import { deviceConfig } from "@/lib/device-config"

export async function GET(request: NextRequest) {
  try {
    // Get Device_S configuration
    const deviceS = deviceConfig.getDevice('Device_S')
    if (!deviceS) {
      return NextResponse.json({
        success: false,
        error: 'Device_S not configured in device-config'
      }, { status: 404 })
    }

    console.log(`🔍 Device_S Debug: Folder ID = ${deviceS.folderId}`)

    // Initialize Google Drive API with Device_S folder
    const driveAPI = new SimpleGoogleDriveAPI(
      deviceS.folderId,
      process.env.GOOGLE_API_KEY
    )

    // List available files
    console.log('📁 Listing files in Device_S folder...')
    const files = await driveAPI.listFilesWithAPIKey()

    if (!files || files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No files found in Device_S folder',
        folderUrl: deviceS.folderUrl
      }, { status: 404 })
    }

    // Show first 5 files
    const csvFiles = files.filter(f => f.name?.toLowerCase().includes('csv') || f.name?.toLowerCase().includes('merged'))
    const firstFile = csvFiles.length > 0 ? csvFiles[0] : files[0]

    console.log(`📄 Examining first file: ${firstFile.name}`)

    // Try to fetch the file content (first 2KB to see structure)
    let csvPreview = ''
    try {
      // Use export endpoint to get CSV content
      const exportUrl = `https://www.googleapis.com/drive/v3/files/${firstFile.id}/export?mimeType=text/csv&key=${process.env.GOOGLE_API_KEY}`
      const response = await fetch(exportUrl)
      const content = await response.text()
      csvPreview = content.substring(0, 3000) // First 3000 chars for structure
      console.log(`✅ Retrieved file content (${content.length} bytes total)`)
    } catch (err) {
      console.log(`⚠️ Could not fetch file content:`, err)
    }

    // Parse headers to show structure
    const lines = csvPreview.split('\n')
    const headerLine = lines[0]
    let delimiter = headerLine.includes('\t') ? '\t' : ','
    const headers = headerLine.split(delimiter).map((h: string) => h.trim())

    // Check for parser requirements
    const tsIndex = headers.findIndex(h => h.toLowerCase().includes('timestamp'))
    const azIndex = headers.findIndex(h => h.toLowerCase().includes('az') && h.toLowerCase().includes('rms'))
    const tempIndex = headers.findIndex(h => h.toLowerCase().includes('temp') && h.toLowerCase().includes('avg'))
    const lvdtIndex = headers.findIndex(h => h.toLowerCase().includes('lvdt') && h.toLowerCase().includes('avg'))

    const parserStatus = {
      timestamp: tsIndex !== -1 ? `✅ Found at [${tsIndex}]: ${headers[tsIndex]}` : '❌ NOT FOUND',
      az_rms: azIndex !== -1 ? `✅ Found at [${azIndex}]: ${headers[azIndex]}` : '❌ NOT FOUND',
      temp_avg: tempIndex !== -1 ? `✅ Found at [${tempIndex}]: ${headers[tempIndex]}` : '❌ NOT FOUND',
      lvdt_avg: lvdtIndex !== -1 ? `✅ Found at [${lvdtIndex}]: ${headers[lvdtIndex]}` : '❌ NOT FOUND'
    }

    console.log(`📋 CSV Structure:`)
    console.log(`   Delimiter: ${delimiter === '\t' ? 'TAB' : 'COMMA'}`)
    console.log(`   Columns: ${headers.length}`)
    headers.forEach((h: string, i: number) => {
      console.log(`   [${i}] ${h}`)
    })
    console.log(`\n🔍 Parser Status:`)
    Object.entries(parserStatus).forEach(([key, val]) => {
      console.log(`   ${key}: ${val}`)
    })

    // Show sample data
    const sampleRows = lines.slice(1, 4).filter((l: string) => l.trim())
    console.log(`📊 Sample Data (first 3 rows):`)
    sampleRows.forEach((row: string, idx: number) => {
      const values = row.split(delimiter).slice(0, 5).map((v: string) => v.trim())
      console.log(`   Row ${idx + 1}: ${values.join(' | ')}`)
    })

    return NextResponse.json({
      success: true,
      deviceS: {
        id: deviceS.id,
        name: deviceS.name,
        folderUrl: deviceS.folderUrl
      },
      filesList: {
        total: files.length,
        csvFiles: csvFiles.length,
        files: files.slice(0, 5).map(f => ({
          name: f.name,
          id: f.id,
          modifiedTime: f.modifiedTime,
          size: f.size
        }))
      },
      csvStructure: {
        delimiter: delimiter === '\t' ? 'TAB' : 'COMMA',
        columns: headers,
        columnCount: headers.length,
        columnIndices: {
          timestamp: tsIndex,
          az_rms: azIndex,
          temp_avg: tempIndex,
          lvdt_avg: lvdtIndex
        },
        parserStatus: {
          timestamp: tsIndex !== -1 ? {status: '✅ FOUND', index: tsIndex, column: headers[tsIndex]} : {status: '❌ NOT FOUND'},
          az_rms: azIndex !== -1 ? {status: '✅ FOUND', index: azIndex, column: headers[azIndex]} : {status: '❌ NOT FOUND'},
          temp_avg: tempIndex !== -1 ? {status: '✅ FOUND', index: tempIndex, column: headers[tempIndex]} : {status: '❌ NOT FOUND'},
          lvdt_avg: lvdtIndex !== -1 ? {status: '✅ FOUND', index: lvdtIndex, column: headers[lvdtIndex]} : {status: '❌ NOT FOUND'}
        },
        preview: csvPreview,
        sampleRows: sampleRows.slice(0, 2)
      }
    })

  } catch (error) {
    console.error("❌ Device_S debug error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
