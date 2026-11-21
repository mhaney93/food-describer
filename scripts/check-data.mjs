// Validates src/data/descriptors.json before every build.
import { readFileSync } from 'node:fs'

const data = JSON.parse(readFileSync(new URL('../src/data/descriptors.json', import.meta.url), 'utf8'))
const errors = []
const sources = new Set(Object.keys(data.sources))
const ids = new Set()
// Every descriptor word appears on exactly one scale across the whole site.
const wordAt = new Map()
const synonyms = []
const MAX_CHILDREN = 9 // keeps each wheel ring readable on a phone

function check(node, path) {
  const where = [...path, node.id].join('/')
  if (!node.id || !node.label) errors.push(`${where}: missing id or label`)
  if (ids.has(node.id)) errors.push(`${where}: duplicate id`)
  ids.add(node.id)
  if (!sources.has(node.source)) errors.push(`${where}: unknown source ${node.source}`)
  if (node.childOrder != null && node.childOrder !== 'natural') errors.push(`${where}: childOrder must be "natural" or absent`)
  const hasKids = Array.isArray(node.children) && node.children.length > 0
  const hasScale = Array.isArray(node.scale) && node.scale.length > 0
  if (hasKids === hasScale) errors.push(`${where}: needs exactly one of children or scale`)
  if (hasKids) {
    if (node.children.length > MAX_CHILDREN) errors.push(`${where}: ${node.children.length} children (max ${MAX_CHILDREN}); split into sub-groups`)
    node.children.forEach((c) => check(c, [...path, node.id]))
  }
  if (hasScale) {
    if (node.childOrder) errors.push(`${where}: childOrder only applies to nodes with children`)
    const own = new Set(node.scale.map((w) => w.word?.toLowerCase()))
    node.scale.forEach((w, i) => {
      if (!w.word || !w.meaning) errors.push(`${where}[${i}]: missing word or meaning`)
      if (!sources.has(w.source)) errors.push(`${where}[${i}]: unknown source ${w.source}`)
      const key = w.word?.toLowerCase()
      if (wordAt.has(key)) errors.push(`${where}: word "${w.word}" also on ${wordAt.get(key)}`)
      else wordAt.set(key, where)
      // Two or three everyday foods that show this word at this step of the scale.
      const ex = w.examples
      if (!Array.isArray(ex) || ex.length < 2 || ex.length > 3) errors.push(`${where}: "${w.word}" needs 2-3 examples`)
      else if (ex.some((e) => typeof e !== 'string' || !e.trim())) errors.push(`${where}: "${w.word}" has an empty example`)
      else if (new Set(ex.map((e) => e.toLowerCase())).size !== ex.length) errors.push(`${where}: "${w.word}" repeats an example`)
      const seen = new Set()
      for (const s of w.synonyms || []) {
        const k = s.toLowerCase()
        if (seen.has(k)) errors.push(`${where}: "${w.word}" lists synonym "${s}" twice`)
        seen.add(k)
        if (own.has(k)) errors.push(`${where}: synonym "${s}" of "${w.word}" is a word on the same scale`)
        synonyms.push({ where, word: w.word, s, k })
      }
    })
  }
}

if (!Number.isInteger(data.version)) errors.push('version must be an integer')
data.categories.forEach((c) => check(c, []))
// A synonym that is itself a descriptor word elsewhere would send search to two places.
for (const { where, word, s, k } of synonyms) {
  if (wordAt.has(k)) errors.push(`${where}: synonym "${s}" of "${word}" is a word on ${wordAt.get(k)}`)
}

if (errors.length) {
  console.error('descriptors.json is invalid:\n  ' + errors.join('\n  '))
  process.exit(1)
}
console.log(`descriptors.json v${data.version}: ${ids.size} nodes, ${wordAt.size} words OK`)
