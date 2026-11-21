import data from './data/descriptors.json'
import './style.css'
import { renderWheel } from './wheel.js'

const app = document.getElementById('app')

const root = { id: '', label: 'All categories', children: data.categories }

/** Resolve a list of ids (from the URL hash) to the chain of nodes from root. */
function resolve(ids) {
  const chain = [root]
  for (const id of ids) {
    const next = (chain.at(-1).children || []).find((c) => c.id === id)
    if (!next) break
    chain.push(next)
  }
  return chain
}

function parseHash() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?')
  const ids = path.split('/').filter(Boolean).map(decodeURIComponent)
  const word = new URLSearchParams(query || '').get('w')
  return { ids, word }
}

function hrefFor(chain, word) {
  const path = chain
    .slice(1)
    .map((n) => encodeURIComponent(n.id))
    .join('/')
  return `#/${path}${word ? `?w=${encodeURIComponent(word)}` : ''}`
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'class') node.className = v
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v)
    else node.setAttribute(k, v === true ? '' : v)
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue
    node.append(c instanceof Node ? c : document.createTextNode(c))
  }
  return node
}

function renderBranch(chain) {
  const node = chain.at(-1)
  if (chain.length === 1) return []
  return [
    el(
      'section',
      { class: 'intro' },
      el('h1', {}, node.label),
      el('p', {}, node.summary),
      node.science ? el('p', { class: 'science' }, el('strong', {}, 'Why: '), node.science) : null,
    ),
  ]
}

function renderScale(chain, selected) {
  const node = chain.at(-1)
  const words = node.scale
  const current = words.find((w) => w.word === selected) || null
  const n = words.length

  const select = (w) => {
    const next = hrefFor(chain, current && current.word === w.word ? null : w.word)
    history.replaceState(null, '', next)
    render()
  }

  return [
    el(
      'section',
      { class: 'intro' },
      el('p', {}, node.summary),
    ),
    el(
      'section',
      { class: 'scale', style: `--n:${n}`, 'aria-label': `${node.label} scale, mildest to most intense` },
      el(
        'div',
        { class: 'scale-inner' },
        el(
          'div',
          { class: 'scale-ends', 'aria-hidden': 'true' },
          el('span', {}, 'Mildest'),
          el('span', {}, 'Most intense'),
        ),
        el('div', { class: 'scale-track', 'aria-hidden': 'true' }),
        el(
          'ol',
          { class: 'scale-words' },
          words.map((w, i) =>
            el(
              'li',
              { style: `--i:${i}` },
              el(
                'button',
                {
                  type: 'button',
                  class: `word${current === w ? ' is-active' : ''}`,
                  'aria-pressed': current === w ? 'true' : 'false',
                  onclick: () => select(w),
                },
                el('span', { class: 'word-dot', 'aria-hidden': 'true' }),
                el('span', { class: 'word-label' }, w.word),
              ),
            ),
          ),
        ),
      ),
    ),
    current
      ? el(
          'section',
          { class: 'detail' },
          el('p', {}, current.meaning),
          current.synonyms?.length
            ? el('p', { class: 'synonyms' }, el('span', {}, 'Similar: '), current.synonyms.join(', '))
            : null,
        )
      : el('p', { class: 'hint' }, 'Tap a word on the scale to highlight it.'),
  ]
}

function render() {
  const { ids, word } = parseHash()
  const chain = resolve(ids)
  const node = chain.at(-1)
  document.title = chain.length > 1 ? `${node.label} · Food Describer` : 'Food Describer'
  app.replaceChildren(
    ...[
      renderWheel(chain, hrefFor),
      ...(node.scale ? renderScale(chain, word) : renderBranch(chain)),
    ].filter(Boolean),
  )
  // On narrow screens the scale scrolls sideways; keep the chosen word in view.
  const active = app.querySelector('.word.is-active')
  const scale = app.querySelector('.scale')
  if (active && scale && scale.scrollWidth > scale.clientWidth) {
    scale.scrollLeft = active.offsetLeft - scale.clientWidth / 2 + active.offsetWidth / 2
  }
}

// Search: index every category label, descriptor word and synonym at load.
function buildIndex() {
  const out = []
  const walk = (chain) => {
    const n = chain.at(-1)
    if (chain.length > 1) out.push({ text: n.label, hint: chain.slice(1, -1).map((c) => c.label).join(' › '), chain })
    for (const c of n.children || []) walk([...chain, c])
    for (const w of n.scale || []) {
      out.push({ text: w.word, hint: n.label, chain, word: w.word })
      for (const s of w.synonyms || []) out.push({ text: s, to: w.word, hint: n.label, chain, word: w.word })
    }
  }
  walk([root])
  return out
}
const searchIndex = buildIndex()

function searchMatches(q) {
  q = q.trim().toLowerCase()
  if (!q) return []
  const seen = new Set()
  return searchIndex
    .map((e) => ({ e, pos: e.text.toLowerCase().indexOf(q) }))
    .filter(({ pos }) => pos >= 0)
    .sort((a, b) => (a.pos !== 0) - (b.pos !== 0) || a.e.text.length - b.e.text.length || a.e.text.localeCompare(b.e.text))
    .map(({ e }) => e)
    .filter((e) => {
      const key = `${e.text.toLowerCase()}|${hrefFor(e.chain, e.word)}`
      return seen.has(key) ? false : seen.add(key)
    })
    .slice(0, 8)
}

function mountSearch() {
  const input = el('input', {
    type: 'search', class: 'search-input', placeholder: 'Search words…', autocomplete: 'off',
    'aria-label': 'Search categories and words', role: 'combobox', 'aria-expanded': 'false',
    'aria-controls': 'search-list', 'aria-autocomplete': 'list',
  })
  const list = el('ul', { id: 'search-list', class: 'search-list', role: 'listbox', hidden: true })
  let results = []
  let active = 0
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false') }
  const pick = (e) => {
    input.value = ''
    close()
    input.blur()
    location.hash = hrefFor(e.chain, e.word)
  }
  const draw = () => {
    list.replaceChildren(
      ...results.map((e, i) =>
        el(
          'li',
          {
            role: 'option', id: `search-opt-${i}`, class: `search-opt${i === active ? ' is-active' : ''}`,
            'aria-selected': i === active ? 'true' : 'false',
            onmousedown: (ev) => { ev.preventDefault(); pick(e) },
          },
          el('span', { class: 'search-text' }, e.to ? `${e.text} → ${e.to}` : e.text),
          e.hint ? el('span', { class: 'search-hint' }, e.hint) : null,
        ),
      ),
    )
    list.hidden = !results.length
    input.setAttribute('aria-expanded', results.length ? 'true' : 'false')
    if (results.length) input.setAttribute('aria-activedescendant', `search-opt-${active}`)
    else input.removeAttribute('aria-activedescendant')
  }
  input.addEventListener('input', () => { results = searchMatches(input.value); active = 0; draw() })
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { if (results[active]) { ev.preventDefault(); pick(results[active]) } }
    else if (ev.key === 'Escape') { ev.preventDefault(); input.value = ''; results = []; draw() }
    else if (ev.key === 'ArrowDown' && results.length) { ev.preventDefault(); active = (active + 1) % results.length; draw() }
    else if (ev.key === 'ArrowUp' && results.length) { ev.preventDefault(); active = (active - 1 + results.length) % results.length; draw() }
  })
  input.addEventListener('blur', close)
  input.addEventListener('focus', () => { if (results.length) draw() })
  app.before(el('div', { class: 'search', role: 'search' }, input, list))
}
mountSearch()

// Tapping the tongue resets the wheel: clear the hash entirely and re-render.
app.addEventListener('click', (e) => {
  if (!e.target.closest('.wheel-center')) return
  e.preventDefault()
  if (location.hash) history.pushState(null, '', location.pathname + location.search)
  lastPath = ''
  render()
})

let lastPath = location.hash.split('?')[0]
window.addEventListener('popstate', () => render())
window.addEventListener('hashchange', () => {
  const path = location.hash.split('?')[0]
  render()
  // Reaching a leaf: bring its word scale (below the wheel) into view.
  if (path !== lastPath && app.querySelector('.scale')) {
    app.querySelector('.intro').scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  lastPath = path
})
render()
