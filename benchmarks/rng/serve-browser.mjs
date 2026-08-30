// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Nicola Mustone

import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const results = resolve(import.meta.dirname, 'results')
const port = Number(process.env.PORT ?? 4173)
const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
])

/** Read a request body with a finite limit. */
function requestBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = []
    let length = 0
    request.on('data', (chunk) => {
      length += chunk.length
      if (length > 1_000_000) {
        reject(new Error('Benchmark result is too large'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://localhost:${port}`)
    if (request.method === 'POST' && url.pathname === '/result') {
      const name = url.searchParams.get('name')
      if (!name || !/^[a-z0-9-]+$/i.test(name)) throw new Error('Invalid runtime name')
      const body = await requestBody(request)
      JSON.parse(body)
      await mkdir(results, { recursive: true })
      await writeFile(resolve(results, `${name}.json`), `${body}\n`)
      response.writeHead(204).end()
      console.log(`Saved benchmarks/rng/results/${name}.json`)
      return
    }

    const requested = url.pathname === '/' ? '/benchmarks/rng/browser.html' : url.pathname
    const file = resolve(root, `.${requested}`)
    if (!file.startsWith(`${root}/`)) throw new Error('Invalid path')
    const body = await readFile(file)
    response.writeHead(200, { 'content-type': types.get(extname(file)) ?? 'application/octet-stream' })
    response.end(body)
  } catch (error) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    response.end(error instanceof Error ? error.message : 'Not found')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Open http://127.0.0.1:${port}/?name=chrome in a browser`)
})
