import { WebSocketServer, WebSocket } from 'ws'

const PORT = 3001

const wss = new WebSocketServer({ port: PORT })

wss.on('connection', (clientWs) => {
  console.log('[ws-proxy] Client connected, opening upstream')
  const upstream = new WebSocket('wss://stream.aisstream.io/v0/stream')
  const pending = []

  clientWs.on('message', (data) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(data)
    } else {
      pending.push(data)
    }
  })

  upstream.on('open', () => {
    console.log('[ws-proxy] Upstream connected, flushing', pending.length, 'buffered msgs')
    for (const msg of pending) upstream.send(msg)
    pending.length = 0
  })

  let msgCount = 0
  upstream.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      // Send as UTF-8 string so the browser receives it as a string, not a Blob
      clientWs.send(data.toString('utf8'))
      msgCount++
      if (msgCount <= 3) console.log('[ws-proxy] Forwarded msg #' + msgCount)
    }
  })

  upstream.on('close', (code, reason) => {
    const safeCode = code >= 1000 && code <= 4999 ? code : 1000
    try { clientWs.close(safeCode, reason) } catch {}
  })

  upstream.on('error', (err) => {
    console.error('[ws-proxy] Upstream error:', err.message)
    try { clientWs.close(1011, 'Upstream error') } catch {}
  })

  clientWs.on('close', () => {
    console.log('[ws-proxy] Client disconnected')
    try { upstream.close() } catch {}
  })

  clientWs.on('error', () => {
    try { upstream.close() } catch {}
  })
})

console.log(`[ws-proxy] AIS WebSocket proxy listening on ws://localhost:${PORT}`)
