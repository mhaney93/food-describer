// Validates src/data/descriptors.json before every build.
import { readFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('../src/data/descriptors.json', import.meta.url), 'utf8'))
const errors = []
const sources = new Set(Object.keys(data.sources))
const ids = new Set()

function check(node, path) {
  const where = [...path, node.id].join('/')
  if (!node.id || !node.label) errors.push(`${where}: missing id or label`)
  if (ids.has(node.id)) errors.push(`${where}: duplicate id`)
  ids.add(node.id)
  if (!sources.has(node.source)) errors.push(`${where}: unknown source ${node.source}`)
  const hasKids = Array.isArray(node.children) && node.children.length > 0
  const hasScale = Array.isArray(node.scale) && node.scale.length > 0
  if (hasKids === hasScale) errors.push(`${where}: needs exactly one of children or scale`)
  if (hasKids) node.children.forEach((c) => check(c, [...path, node.id]))
  if (hasScale) {
    node.scale.forEach((w, i) => {
      if (!w.word || !w.meaning) errors.push(`${where}[${i}]: missing word or meaning`)
      if (!sources.has(w.source)) errors.push(`${where}[${i}]: unknown source ${w.source}`)
    })
  }
}

if (!Number.isInteger(data.version)) errors.push('version must be an integer')
data.categories.forEach((c) => check(c, []))

if (errors.length) {
  console.error('descriptors.json is invalid:\n  ' + errors.join('\n  '))
  process.exit(1)
}
console.log(`descriptors.json v${data.version}: ${ids.size} nodes OK`)
