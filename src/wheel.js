// Taste wheel: a sunburst drawn as plain SVG. The top-level categories form the
// first ring around a tongue in the centre; each node on the selected path opens
// its children as the next ring, inside the parent's arc.

const SVG = 'http://www.w3.org/2000/svg'
// Radii in viewBox units: the centre disc, and the outer edge the visible rings share.
const CENTER_R = 78
const OUTER_R = 490
// The open segment in each ring gets at least this share of its parent's arc.
const OPEN_SHARE = 0.5
const HUES = [8, 32, 50, 140, 200, 262, 320]
const MIN_FONT = 17
const CHAR_W = 0.6 // rough average glyph width in em for the label font

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v)
  for (const c of children.flat()) if (c != null) node.append(c)
  return node
}

const leaves = (n) => (n.scale ? 1 : n.children.reduce((s, c) => s + leaves(c), 0))

const pt = (r, a) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`

function arcPath(r0, r1, a0, a1) {
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${pt(r0, a0)} L${pt(r1, a0)} A${r1} ${r1} 0 ${large} 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0} ${r0} 0 ${large} 0 ${pt(r0, a0)}Z`
}

function color(hue, depth, index) {
  const light = [58, 72, 83][depth] + (index % 2 ? 3 : -2)
  const sat = [70, 62, 55][depth]
  return `hsl(${hue} ${sat}% ${light}%)`
}

/** Fit a label radially into a band of `len` units long and `thick` units wide. */
function fitLabel(text, len, thick, maxFont) {
  const words = text.split(' ')
  const options = [[text]]
  if (words.length > 1) {
    // Best two-line split: the one with the shortest longer line.
    let best = null
    for (let i = 1; i < words.length; i++) {
      const lines = [words.slice(0, i).join(' '), words.slice(i).join(' ')]
      const w = Math.max(...lines.map((l) => l.length))
      if (!best || w < best.w) best = { lines, w }
    }
    options.push(best.lines)
  }
  for (const lines of options) {
    const longest = Math.max(...lines.map((l) => l.length))
    const size = Math.min(maxFont, len / (longest * CHAR_W), thick / (lines.length * 1.15))
    if (size >= MIN_FONT) return { lines, size }
  }
  // Too long even when wrapped: one line at the smallest size, truncated.
  const size = Math.max(Math.min(MIN_FONT, thick / 1.15), 11)
  const max = Math.max(3, Math.floor(len / (size * CHAR_W)))
  return { lines: [text.length > max ? `${text.slice(0, max - 1)}…` : text], size }
}

function label(text, r0, r1, a0, a1, maxFont) {
  const mid = (a0 + a1) / 2
  const rm = (r0 + r1) / 2
  const along = rm * (a1 - a0) * 0.9 // room across the arc
  const depth = (r1 - r0) * 0.88 // room along the radius
  // Try text along the radius and text across the arc; keep whichever fits larger.
  const radial = fitLabel(text, depth, along, maxFont)
  const tangent = fitLabel(text, along * 0.85, depth, maxFont)
  const useTangent = tangent.size > radial.size && !tangent.lines[0].endsWith('…')
  const { lines, size } = useTangent ? tangent : radial
  const deg = (mid * 180) / Math.PI
  // Flip so text never reads upside down.
  const transform = useTangent
    ? `rotate(${deg.toFixed(2)}) translate(0 ${-rm}) rotate(${mid > Math.PI / 2 && mid < (3 * Math.PI) / 2 ? 180 : 0})`
    : `rotate(${(deg - 90).toFixed(2)}) translate(${rm} 0) rotate(${mid > Math.PI ? 180 : 0})`
  return svg(
    'text',
    { class: 'wheel-label', transform, 'font-size': size.toFixed(1), 'text-anchor': 'middle' },
    lines.map((l, i) =>
      svg('tspan', { x: 0, dy: i === 0 ? `${(0.35 - (lines.length - 1) * 0.55).toFixed(2)}em` : '1.1em' }, l),
    ),
  )
}

/**
 * @param {object[]} chain  root..selected node
 * @param {(chain: object[]) => string} hrefFor
 */
export function renderWheel(chain, hrefFor) {
  const outer = OUTER_R
  const root = chain[0]
  const rings = chain.filter((n) => n.children).length
  const band = (OUTER_R - CENTER_R) / rings
  // Fewer, thicker rings get bigger labels.
  const maxFont = Math.max(30, Math.min(46, band * 0.2))
  const RADII = Array.from({ length: rings + 1 }, (_, i) => CENTER_R + i * band)
  const g = svg('g')

  // Draw one ring per open node on the path: root's children, then each selected child's children.
  let span = [0, Math.PI * 2]
  let hue = null
  for (let depth = 0; depth < chain.length && depth < RADII.length - 1; depth++) {
    const parent = chain[depth]
    if (!parent.children) break
    const selected = chain[depth + 1]
    const [r0, r1] = [RADII[depth] + 2, RADII[depth + 1]]
    // Natural weights: equal for the top ring, leaf counts below. The open
    // segment is then widened to OPEN_SHARE so its children stay legible.
    const weights = parent.children.map((c) => (depth === 0 ? 1 : leaves(c)))
    const sum = weights.reduce((x, y) => x + y, 0)
    let fracs = weights.map((w) => w / sum)
    const si = parent.children.indexOf(selected)
    if (si >= 0 && fracs[si] < OPEN_SHARE && fracs.length > 1) {
      const rest = 1 - fracs[si]
      fracs = fracs.map((f, i) => (i === si ? OPEN_SHARE : (f * (1 - OPEN_SHARE)) / rest))
    }
    let a = span[0]
    let nextSpan = null
    parent.children.forEach((c, i) => {
      const a0 = a
      const a1 = a + (span[1] - span[0]) * fracs[i]
      a = a1
      const h = depth === 0 ? HUES[i % HUES.length] : hue
      const isSel = c === selected
      if (isSel) nextSpan = { span: [a0, a1], hue: h }
      const gap = Math.min(0.006, (a1 - a0) / 8)
      // Clicking the open segment steps back up to its parent.
      const target = isSel ? chain.slice(0, depth + 1) : [...chain.slice(0, depth + 1), c]
      g.append(
        svg(
          'a',
          {
            href: hrefFor(target),
            class: `wheel-seg${isSel ? ' is-open' : ''}${selected && !isSel ? ' is-dim' : ''}`,
            'aria-label': isSel ? `${c.label} (selected; go back up)` : c.label,
          },
          svg('title', {}, c.label),
          svg('path', { d: arcPath(r0, r1, a0 + gap, a1 - gap), fill: color(h, depth, i) }),
          label(c.label, r0, r1, a0 + gap, a1 - gap, maxFont),
        ),
      )
    })
    if (!nextSpan) break
    span = nextSpan.span
    hue = nextSpan.hue
  }

  const center = svg(
    'a',
    {
      href: hrefFor(chain.length > 1 ? chain.slice(0, -1) : chain),
      class: 'wheel-center',
      'aria-label': chain.length > 1 ? 'Go back up one level' : root.label,
    },
    svg('title', {}, chain.length > 1 ? 'Back' : 'Food Describer'),
    svg('circle', { r: CENTER_R - 2 }),
    svg('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 84, y: 4 }, '👅'),
  )

  return svg(
    'svg',
    {
      class: 'wheel',
      viewBox: `${-outer - 6} ${-outer - 6} ${2 * outer + 12} ${2 * outer + 12}`,
      role: 'navigation',
      'aria-label': 'Taste wheel',
    },
    g,
    center,
  )
}
