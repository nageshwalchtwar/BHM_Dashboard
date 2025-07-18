import { NextResponse } from "next/server"
import { generateSensorData } from "@/lib/data-generator"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get("start")
  const endDate = searchParams.get("end")

  // In a real implementation, you would fetch from ThingSpeak API
  // For now, we'll return simulated data
  const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const end = endDate ? new Date(endDate) : new Date()

  const data = generateSensorData(start, end)

  return NextResponse.json({
    success: true,
    data,
    message: "Sensor data retrieved successfully",
  })
}

export async function POST(request: Request) {
  // This would handle posting data to ThingSpeak
  const body = await request.json()

  // Simulate API response
  return NextResponse.json({
    success: true,
    message: "Data posted to ThingSpeak successfully",
    data: body,
  })
}
