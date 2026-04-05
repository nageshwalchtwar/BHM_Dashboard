import { NextResponse } from "next/server"
import { deviceConfig } from "@/lib/device-config"

export async function GET() {
  try {
    const devices = deviceConfig.getDevices()
    const defaultDevice = deviceConfig.getDefaultDevice()

    const deviceList = devices.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      folderId: d.folderId,
      hasLatestFolder: !!d.latestDataFolderId,
      isActive: d.isActive,
    }))

    console.log(`📱 Device Configuration:`)
    console.log(`  Total devices: ${deviceList.length}`)
    console.log(`  Default device: ${defaultDevice?.id} (${defaultDevice?.name})`)
    deviceList.forEach(d => {
      console.log(`  - ${d.id}: ${d.name} [folder: ${d.folderId}]`)
    })

    return NextResponse.json({
      success: true,
      devices: deviceList,
      defaultDeviceId: defaultDevice?.id,
      defaultDeviceName: defaultDevice?.name,
      message: devices.length === 0 ? 
        '❌ No devices configured! Set DEVICE_1_FOLDER_ID and DEVICE_1_NAME in railway.app or .env' :
        '✅ Devices configured'
    })
  } catch (error) {
    console.error('❌ Device config error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
