import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiting (Railway cost optimization)
const requestCounts = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 10 // Max 10 requests per hour per IP
const WINDOW_SIZE = 60 * 60 * 1000 // 1 hour

export function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const ip = request.ip || request.headers.get('x-forwarded-for') || 'anonymous'
  const now = Date.now()
  
  const clientData = requestCounts.get(ip) || { count: 0, resetTime: now + WINDOW_SIZE }
  
  // Reset count if window has passed
  if (now > clientData.resetTime) {
    clientData.count = 0
    clientData.resetTime = now + WINDOW_SIZE
  }
  
  // Check rate limit
  if (clientData.count >= RATE_LIMIT) {
    return new NextResponse('Rate limit exceeded. Railway cost optimization active.', { 
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((clientData.resetTime - now) / 1000)),
        'X-RateLimit-Limit': String(RATE_LIMIT),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(clientData.resetTime)
      }
    })
  }
  
  // Increment count
  clientData.count++
  requestCounts.set(ip, clientData)
  
  // Clean up old entries periodically
  if (Math.random() < 0.1) {
    for (const [key, data] of requestCounts.entries()) {
      if (now > data.resetTime) {
        requestCounts.delete(key)
      }
    }
  }
  
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT))
  response.headers.set('X-RateLimit-Remaining', String(RATE_LIMIT - clientData.count))
  response.headers.set('X-RateLimit-Reset', String(clientData.resetTime))
  
  return response
}

export const config = {
  matcher: '/api/:path*'
}