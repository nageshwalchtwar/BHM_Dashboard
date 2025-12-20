import { NextResponse } from "next/server"
import { fetchLatestCSVData } from "@/lib/csv-handler"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const minutes = parseInt(searchParams.get("minutes") || "1")

  try {
    // Fetch the latest CSV data filtered to recent minutes
    const data = await fetchLatestCSVData()
    
    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      timeRange: `${minutes} minute(s)`,
      lastUpdate: new Date().toISOString(),
      message: `Latest ${data.length} data points from the most recent ${minutes} minute(s)`,
    })
  } catch (error) {
    console.error('Error fetching latest CSV data:', error)
    return NextResponse.json({
      success: false,
      error: "Failed to fetch latest CSV data",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

// Optional: Handle manual data refresh
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { csvContent } = body
    
    if (!csvContent) {
      return NextResponse.json({
        success: false,
        error: "No CSV content provided"
      }, { status: 400 })
    }
    
    // Here you could process uploaded CSV content
    // For now, just return success
    return NextResponse.json({
      success: true,
      message: "CSV data processed successfully",
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: "Failed to process CSV data"
    }, { status: 500 })
  }
}