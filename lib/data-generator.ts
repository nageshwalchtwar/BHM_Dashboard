export interface SensorData {
  timestamp: number
  vibration: number
  acceleration: number
  strain: number
  temperature: number
}

export function generateSensorData(startDate: Date, endDate: Date): SensorData[] {
  const data: SensorData[] = []
  const start = startDate.getTime()
  const end = endDate.getTime()
  const interval = (end - start) / 100 // Generate 100 data points

  for (let i = 0; i <= 100; i++) {
    const timestamp = start + interval * i

    // Generate realistic sensor data with some randomness
    const baseVibration = 1.2 + Math.sin(i * 0.1) * 0.3
    const baseAcceleration = 0.25 + Math.sin(i * 0.15) * 0.1
    const baseStrain = 120 + Math.sin(i * 0.08) * 20
    const baseTemperature = 22 + Math.sin(i * 0.05) * 5

    // Add random variations
    const vibration = Math.max(0, baseVibration + (Math.random() - 0.5) * 0.4)
    const acceleration = Math.max(0, baseAcceleration + (Math.random() - 0.5) * 0.2)
    const strain = Math.max(0, baseStrain + (Math.random() - 0.5) * 40)
    const temperature = baseTemperature + (Math.random() - 0.5) * 8

    // Occasionally add some anomalies to simulate real-world conditions
    let anomalyMultiplier = 1
    if (Math.random() < 0.05) {
      // 5% chance of anomaly
      anomalyMultiplier = 1.5 + Math.random() * 0.5
    }

    data.push({
      timestamp,
      vibration: vibration * anomalyMultiplier,
      acceleration: acceleration * anomalyMultiplier,
      strain: strain * anomalyMultiplier,
      temperature,
    })
  }

  return data
}

export function calculateHealthStatus(data: SensorData[]): "good" | "warning" | "critical" {
  if (data.length === 0) return "good"

  // Define thresholds for each parameter
  const thresholds = {
    vibration: { warning: 2.0, critical: 2.5 },
    acceleration: { warning: 0.5, critical: 0.7 },
    strain: { warning: 200, critical: 250 },
    temperature: { warning: 35, critical: 40 },
  }

  // Group data by day (assume 24 points per day)
  const days: SensorData[][] = [];
  for (let i = 0; i < data.length; i += 24) {
    days.push(data.slice(i, i + 24));
  }

  // Determine if each day is bad
  const badDays = days.map(dayData => {
    return dayData.some(point =>
      point.vibration > thresholds.vibration.warning ||
      point.acceleration > thresholds.acceleration.warning ||
      point.strain > thresholds.strain.warning ||
      point.temperature > thresholds.temperature.warning
    );
  });

  // Count consecutive bad days from the end
  let consecutiveBad = 0;
  for (let i = badDays.length - 1; i >= 0; i--) {
    if (badDays[i]) {
      consecutiveBad++;
    } else {
      break;
    }
  }

  if (consecutiveBad >= 10) {
    return "critical";
  } else if (consecutiveBad >= 5) {
    return "warning";
  } else {
    return "good";
  }
}
