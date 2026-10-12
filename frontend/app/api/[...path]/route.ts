import type { NextRequest } from 'next/server'

async function proxyToApi(request: NextRequest) {
  const apiBase = process.env.API_INTERNAL_URL || 'http://api:8000'
  const target = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, apiBase)
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('connection')
  headers.delete('content-length')

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer()
  }

  try {
    const upstream = await fetch(target, init)
    const responseHeaders = new Headers(upstream.headers)
    responseHeaders.delete('connection')
    responseHeaders.delete('content-encoding')
    responseHeaders.delete('content-length')
    responseHeaders.delete('transfer-encoding')
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch {
    return Response.json({ error: 'The SmartBin API is unavailable.' }, { status: 502 })
  }
}

export const GET = proxyToApi
export const HEAD = proxyToApi
export const POST = proxyToApi
export const PUT = proxyToApi
export const PATCH = proxyToApi
export const DELETE = proxyToApi
