#!/usr/bin/env node
/** 直接在 TCP 层手发 PG SSL 请求 + 30s 超时 + 收到啥都打印 */
import net from 'node:net'
import dns from 'node:dns/promises'

const HOST = 'sh-postgres-i556nz8q.sql.tencentcdb.com'
const PORT = 24155
const TIMEOUT_MS = 30_000

const ips = await dns.resolve4(HOST)
console.log(`DNS: ${HOST} → ${ips.join(', ')}`)

await new Promise((resolve) => {
  const sock = net.createConnection({ host: HOST, port: PORT })
  let connectMs, dataMs
  const t0 = Date.now()
  sock.setTimeout(TIMEOUT_MS)

  sock.on('connect', () => {
    connectMs = Date.now() - t0
    console.log(`TCP connected in ${connectMs}ms; sending PG SSL request packet...`)
    sock.write(Buffer.from([0, 0, 0, 8, 4, 0xd2, 0x16, 0x2f]))
  })

  sock.on('data', (d) => {
    dataMs = Date.now() - t0
    console.log(`recv ${d.length}B in ${dataMs}ms: hex=${d.toString('hex')} ascii="${d.toString('ascii').replace(/[^\x20-\x7e]/g, '.')}"`)
    sock.end()
  })

  sock.on('timeout', () => {
    console.log(`✗ TIMEOUT after ${Date.now() - t0}ms (connect=${connectMs ?? 'never'}ms, data=${dataMs ?? 'never'}ms)`)
    sock.destroy()
    resolve()
  })

  sock.on('error', (e) => {
    console.log(`✗ ERROR: ${e.message}`)
    resolve()
  })

  sock.on('close', () => {
    console.log(`socket closed at ${Date.now() - t0}ms`)
    resolve()
  })
})
