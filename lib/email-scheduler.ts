import emailService from './email-service'

interface CronJob {
  id: string
  name: string
  schedule: string
  nextRun: Date
  lastRun?: Date
  isActive: boolean
}

// Simple cron scheduler (in production, use node-cron or similar)
class EmailScheduler {
  private static instance: EmailScheduler
  private jobs: Map<string, CronJob> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()

  static getInstance(): EmailScheduler {
    if (!EmailScheduler.instance) {
      EmailScheduler.instance = new EmailScheduler()
    }
    return EmailScheduler.instance
  }

  constructor() {
    this.initializeScheduledJobs()
  }

  private initializeScheduledJobs() {
    // Morning report at 10:00 AM every day
    this.scheduleJob({
      id: 'morning-report',
      name: 'Morning System Status Report',
      schedule: '10:00', // 10:00 AM
      nextRun: this.getNextRunTime('10:00'),
      isActive: true
    }, async () => {
      console.log('🌅 Sending morning system status reports...')
      const result = await emailService.sendSystemStatusToAllUsers('morning')
      console.log(`Morning report result: ${result.message}`)
    })

    // Evening report at 10:00 PM every day
    this.scheduleJob({
      id: 'evening-report',
      name: 'Evening System Status Report', 
      schedule: '22:00', // 10:00 PM
      nextRun: this.getNextRunTime('22:00'),
      isActive: true
    }, async () => {
      console.log('🌙 Sending evening system status reports...')
      const result = await emailService.sendSystemStatusToAllUsers('evening')
      console.log(`Evening report result: ${result.message}`)
    })

    console.log('📅 Email scheduler initialized with daily reports at 10:00 AM and 10:00 PM')
  }

  private getNextRunTime(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number)
    const now = new Date()
    const nextRun = new Date()
    
    nextRun.setHours(hours, minutes || 0, 0, 0)
    
    // If the time has already passed today, schedule for tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1)
    }
    
    return nextRun
  }

  private scheduleJob(job: CronJob, callback: () => Promise<void>) {
    this.jobs.set(job.id, job)
    
    const scheduleNext = () => {
      const now = new Date()
      const timeUntilNext = job.nextRun.getTime() - now.getTime()
      
      if (timeUntilNext <= 0) {
        // Time has passed, execute immediately and schedule next
        this.executeJob(job.id, callback)
        return
      }
      
      const timeout = setTimeout(async () => {
        if (job.isActive) {
          await this.executeJob(job.id, callback)
        }
        
        // Schedule next run (same time tomorrow)
        job.nextRun = new Date(job.nextRun.getTime() + 24 * 60 * 60 * 1000)
        scheduleNext()
      }, Math.min(timeUntilNext, 2147483647)) // Max timeout value
      
      this.intervals.set(job.id, timeout)
    }
    
    scheduleNext()
    console.log(`⏰ Scheduled job '${job.name}' for ${job.nextRun.toLocaleString()}`)
  }

  private async executeJob(jobId: string, callback: () => Promise<void>) {
    const job = this.jobs.get(jobId)
    if (!job) return

    try {
      console.log(`🚀 Executing job: ${job.name}`)
      job.lastRun = new Date()
      await callback()
      console.log(`✅ Job completed: ${job.name}`)
    } catch (error) {
      console.error(`❌ Job failed: ${job.name}`, error)
    }
    
    this.jobs.set(jobId, job)
  }

  // Get all scheduled jobs
  getJobs(): CronJob[] {
    return Array.from(this.jobs.values())
  }

  // Manually trigger a job
  async triggerJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId)
    if (!job) return false

    try {
      if (jobId === 'morning-report') {
        await emailService.sendSystemStatusToAllUsers('morning')
      } else if (jobId === 'evening-report') {
        await emailService.sendSystemStatusToAllUsers('evening')
      }
      
      job.lastRun = new Date()
      this.jobs.set(jobId, job)
      return true
    } catch (error) {
      console.error(`Failed to trigger job ${jobId}:`, error)
      return false
    }
  }

  // Toggle job active status
  toggleJob(jobId: string, isActive: boolean): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    job.isActive = isActive
    this.jobs.set(jobId, job)
    
    if (isActive) {
      console.log(`✅ Enabled job: ${job.name}`)
    } else {
      console.log(`⏸️ Disabled job: ${job.name}`)
    }
    
    return true
  }

  // Stop all scheduled jobs
  stopAllJobs() {
    for (const [jobId, timeout] of this.intervals) {
      clearTimeout(timeout)
      console.log(`🛑 Stopped job: ${jobId}`)
    }
    this.intervals.clear()
  }
}

// Initialize the scheduler when the module is imported
export const emailScheduler = EmailScheduler.getInstance()
export default emailScheduler