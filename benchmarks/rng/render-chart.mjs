// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Nicola Mustone

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const directory = resolve(import.meta.dirname, 'results')
const files = (await readdir(directory)).filter((file) => file.endsWith('.json')).sort()
const labels = new Map([
  ['chrome.json', 'Chrome 152'],
  ['firefox.json', 'Firefox 152'],
  ['node-20.json', 'Node 20'],
  ['node-22.json', 'Node 22'],
  ['node-24.json', 'Node 24'],
  ['safari.json', 'Safari 26'],
  ['workerd.json', 'workerd'],
])
const panels = [
  { metric: 'roll-d20', title: 'One d20', maximum: 50 },
  { metric: 'roll-2d6+3', title: '2d6 + 3', maximum: 4 },
  { metric: 'roll-1000d6', title: '1,000d6', maximum: 12 },
]

const results = []
for (const file of files) {
  if (!labels.has(file)) continue
  const result = JSON.parse(await readFile(resolve(directory, file), 'utf8'))
  const speedups = new Map()
  for (const panel of panels) {
    const baseline = result.rows.find(
      (row) => row.metric === panel.metric && row.candidate === 'one-word',
    )
    const buffered = result.rows.find(
      (row) => row.metric === panel.metric && row.candidate === 'buffer-256',
    )
    speedups.set(panel.metric, baseline.medianNsPerOperation / buffered.medianNsPerOperation)
  }
  results.push({ label: labels.get(file), speedups })
}

const width = 1120
const height = 560
const labelWidth = 110
const panelWidth = 320
const panelGap = 20
const chartTop = 135
const rowHeight = 48
const barHeight = 24

let body = `
  <rect width="${width}" height="${height}" fill="#fafaf9"/>
  <text x="40" y="48" class="title">Median roll speedup from a 256-word CSPRNG buffer</text>
  <text x="40" y="78" class="subtitle">Same platform CSPRNG and rejection sampling; seven samples after two warmups</text>`

for (const [panelIndex, panel] of panels.entries()) {
  const x = labelWidth + panelIndex * (panelWidth + panelGap)
  const barWidth = panelWidth - 58
  body += `
  <text x="${x}" y="112" class="panel">${panel.title}</text>
  <line x1="${x}" y1="${chartTop - 8}" x2="${x + barWidth}" y2="${chartTop - 8}" class="rule"/>`

  for (const [index, result] of results.entries()) {
    const y = chartTop + index * rowHeight
    const speedup = result.speedups.get(panel.metric)
    const measuredWidth = (speedup / panel.maximum) * barWidth
    if (panelIndex === 0) {
      body += `<text x="${labelWidth - 12}" y="${y + 17}" text-anchor="end" class="runtime">${result.label}</text>`
    }
    body += `
  <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3" class="track"/>
  <rect x="${x}" y="${y}" width="${measuredWidth.toFixed(2)}" height="${barHeight}" rx="3" class="bar"/>
  <text x="${x + barWidth + 8}" y="${y + 17}" class="value">${speedup.toFixed(2)}×</text>`
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Median roll speedup from a 256-word CSPRNG buffer</title>
  <desc id="description">Horizontal bars compare d20, 2d6 plus 3, and 1000d6 roll speedups in Chrome, Firefox, Node 20, Node 22, Node 24, Safari, and workerd.</desc>
  <style>
    text { font-family: ui-sans-serif, system-ui, sans-serif; fill: #1e293b; }
    .title { font-size: 25px; font-weight: 700; }
    .subtitle { font-size: 14px; fill: #475569; }
    .panel { font-size: 16px; font-weight: 700; }
    .runtime, .value { font-size: 13px; }
    .value { font-variant-numeric: tabular-nums; font-weight: 650; }
    .rule { stroke: #cbd5e1; }
    .track { fill: #e7e5e4; }
    .bar { fill: #4f46e5; }
  </style>${body}
</svg>
`

await writeFile(resolve(import.meta.dirname, 'speedup.svg'), svg)
console.log(resolve(import.meta.dirname, 'speedup.svg'))
