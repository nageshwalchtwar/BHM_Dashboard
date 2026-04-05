# Device 1 Configuration & Debugging Guide

## Quick Fix: Configure Device 1

Your folder ID `1B528rBpUy0lc7XstZqYZxlRQhuiZdQXP` **must be added as an environment variable** for Device 1 to appear in the dropdown.

### Option 1: Railway Dashboard (Recommended)
1. Go to your Railway project
2. Navigate to "Variables" tab
3. Add these variables:
   ```
   DEVICE_1_FOLDER_ID = 1B528rBpUy0lc7XstZqYZxlRQhuiZdQXP
   DEVICE_1_NAME = Device 1
   ```
4. Deploy/restart the app

### Option 2: Local Testing (.env file)
Create/update `.env.local`:
```
DEVICE_1_FOLDER_ID=1B528rBpUy0lc7XstZqYZxlRQhuiZdQXP
DEVICE_1_NAME=Device 1
```

## Debugging: Check What's Configured

1. **List all devices**:
   ```
   curl http://localhost:3000/api/list-devices
   ```
   Shows all configured devices and their folders.

2. **Test CSV parsing directly**:
   ```
   curl "http://localhost:3000/api/test-merged-parse?device=d1&date=2026-02-25"
   ```
   This will show:
   - CSV header detected
   - First few rows
   - Parsed values for accel_z, temperature, lvdt
   - Min/max/avg statistics

## Expected Behavior After Fixing

1. **Device Dropdown**: Should show "Device 1" or "d1" option
2. **Select Device 1**: Dashboard auto-switches to "1 Day" button
3. **Date Picker**: Shows dates from 2026-02-12 to 2026-04-05
4. **Select Date**: All 4 charts should populate:
   - ✅ LVDT Displacement (purple)
   - ✅ Accelerometer RMS (green)
   - ✅ Temperature (yellow/orange)
   - ✅ FFT Spectrum

## Troubleshooting

### "No device found" error
- Check that DEVICE_1_FOLDER_ID is set correctly
- Verify folder ID has exactly 33 characters
- Restart the application after setting variables

### "No dates found for device"
- Check that DEVICE_1_FOLDER_ID points to a folder with CSV files
- CSV filenames should contain dates like: `MERGED_2026-02-25_x_10s_rms.csv`
- Visit `/api/test-merged-parse` to see actual parsing

### Accelerometer chart stuck loading
- Browser console will show parse logs
- Chart waits for accel_z values to be non-NaN
- Visit `/api/test-merged-parse` to see if accel_z values are extracted

### Hangs/Freezing after date selection
- This might be a rendering issue with large datasets
- Check server logs for parsing errors
- Visit `/api/test-merged-parse` with your selected date to see if parsing is slow

## CSV Format Verification

Expected structure:
```
timestamp       | ax_adxl_rms    | ay_adxl_rms    | az_adxl_rms    | temp_avg_10s | lvdt_avg_10s
2026-02-13 0:00:00 | 0.0006990855506 | 0.0006394709292 | 0.001473222333 | 31.75       | -1.670614919
```

- **Columns**: 6 (timestamp, ax, ay, az, temp, lvdt)
- **Delimiter**: Tab or comma
- **Values**: All numeric except timestamp

## Debug Logs to Check

Open browser DevTools (F12) and check Console tab:
- Should see `✅ Got X dates:` messages
- Should see `📊 Device lookup: d1 →` messages
- Should see `✅ Parsed XXX rows` messages
- Should see column indices and detected headers

If these don't appear:
1. Check application restarted after env variable change
2. Verify folder ID is valid
3. Check Google Drive API key is set (GOOGLE_DRIVE_API_KEY)
