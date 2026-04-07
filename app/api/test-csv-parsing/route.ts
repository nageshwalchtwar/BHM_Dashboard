import { NextResponse } from 'next/server';
import { parseMergedDayCSV } from '@/lib/merged-csv-parser';

/**
 * Test CSV parsing with the actual data format
 */
const TEST_CSV = `timestamp	ax_adxl_rms	ay_adxl_rms	az_adxl_rms	temp_avg_10s	lvdt_avg_10s
2026-02-12 0:00:00	0.0007503030583	0.0005279478633	0.001222663958	30.97669254	-1.645905883
2026-02-12 0:00:10	0.001156023026	0.0007250843156	0.001930917462	30.97714271	-1.654065783
2026-02-12 0:00:20	0.001386837614	0.0009977016413	0.003470592758	31	-1.653403381
2026-02-12 0:00:30	0.001057483746	0.0006671558969	0.003274452946	30.98826284	-1.649134853
2026-02-12 0:00:40	0.001750196243	0.001170384809	0.005886617789	30.99445804	-1.653891672
2026-02-12 0:00:50	0.0007084840891	0.0007344811725	0.002603910381	30.95890754	-1.648526725`;

export async function GET() {
  try {
    console.log('🧪 Testing CSV parsing with tab-separated format...');
    
    const result = parseMergedDayCSV(TEST_CSV);
    
    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Parser returned no data',
        message: 'Check browser console for parsing errors',
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      parsed: result.length,
      sample: result.slice(0, 3),
      message: `✅ CSV parsing works! ${result.length} rows parsed`,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
