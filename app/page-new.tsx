"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to simple dashboard
    router.replace('/simple')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Bridge Health Monitor</h1>
        <p className="text-muted-foreground">Redirecting to simple dashboard...</p>
      </div>
    </div>
  )
}