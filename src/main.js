import data from './data/descriptors.json'
import './style.css'

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

function badge(source) {
  return source === 'pe'
    ? el('span', { class: 'badge badge-pe', title: 'From Project Everything' }, 'PE')
    : el('span', { class: 'badge badge-sensory', title: 'Standard sensory-science vocabulary' }, 'std')
}

function countLeaves(node) {
  if (node.scale) return node.scale.length
  return (node.children || []).reduce((n, c) => n + countLeaves(c), 0)
}

function breadcrumb(chain) {
  return el(
    'nav',
    { class: 'crumbs', 'aria-label': 'Breadcrumb' },
    chain.length > 1
      ? el('a', { class: 'back', href: hrefFor(chain.slice(0, -1)), 'aria-label': 'Back' }, '← Back')
      : null,
    el(
      'ol',
      {},
      chain.map((n, i) =>
        el(
          'li',
          {},
          i === chain.length - 1
            ? el('span', { 'aria-current': 'page' }, n.label)
            : el('a', { href: hrefFor(chain.slice(0, i + 1)) }, n.label),
        ),
      ),
    ),
  )
}

function renderBranch(chain) {
  const node = chain.at(-1)
  const isRoot = chain.length === 1
  return [
    el(
      'section',
      { class: 'intro' },
      el('h1', {}, isRoot ? 'What are you noticing?' : node.label),
      el(
        'p',
        {},
        isRoot
          ? 'Pick a category, then keep narrowing down until you reach a scale of words from mildest to most intense.'
          : node.summary,
      ),
      !isRoot && node.science ? el('p', { class: 'science' }, el('strong', {}, 'Why: '), node.science) : null,
    ),
    el(
      'ul',
      { class: 'cards' },
      node.children.map((c) =>
        el(
          'li',
          {},
          el(
            'a',
            { class: 'card', href: hrefFor([...chain, c]) },
            el('span', { class: 'card-title' }, c.label, badge(c.source)),
            el('span', { class: 'card-summary' }, c.summary),
            el(
              'span',
              { class: 'card-meta' },
              c.scale ? `${c.scale.length} words →` : `${c.children.length} groups · ${countLeaves(c)} words →`,
            ),
          ),
        ),
      ),
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
      el('h1', {}, node.label),
      el('p', {}, node.summary),
      node.science ? el('p', { class: 'science' }, el('strong', {}, 'Why: '), node.science) : null,
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
          el('h2', {}, current.word, badge(current.source)),
          el('p', {}, current.meaning),
          current.science ? el('p', { class: 'science' }, el('strong', {}, 'Food science: '), current.science) : null,
        )
      : el('p', { class: 'hint' }, 'Tap a word on the scale to highlight it.'),
    el(
      'ol',
      { class: 'glossary' },
      words.map((w, i) =>
        el(
          'li',
          { class: current === w ? 'is-active' : null },
          el('span', { class: 'glossary-rank', 'aria-hidden': 'true' }, String(i + 1)),
          el(
            'div',
            {},
            el('strong', {}, w.word),
            badge(w.source),
            el('span', { class: 'glossary-meaning' }, ` ${w.meaning}`),
            w.science ? el('span', { class: 'glossary-science' }, w.science) : null,
          ),
        ),
      ),
    ),
  ]
}

function render() {
  const { ids, word } = parseHash()
  const chain = resolve(ids)
  const node = chain.at(-1)
  document.title = chain.length > 1 ? `${node.label} · Food Describer` : 'Food Describer'
  app.replaceChildren(breadcrumb(chain), ...(node.scale ? renderScale(chain, word) : renderBranch(chain)))
  // On narrow screens the scale scrolls sideways; keep the chosen word in view.
  const active = app.querySelector('.word.is-active')
  const scale = app.querySelector('.scale')
  if (active && scale && scale.scrollWidth > scale.clientWidth) {
    scale.scrollLeft = active.offsetLeft - scale.clientWidth / 2 + active.offsetWidth / 2
  }
}

let lastPath = null
window.addEventListener('hashchange', () => {
  const path = location.hash.split('?')[0]
  render()
  if (path !== lastPath) window.scrollTo({ top: 0 })
  lastPath = path
})
lastPath = location.hash.split('?')[0]
render()
