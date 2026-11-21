# food-describer

Find the right words to describe food: drill down through flavor categories to mild-to-intense descriptor scales.

**Live site:** https://food-describer.vercel.app

## What it is

A small, static, mobile-friendly website. Start from a top-level category
(Taste, Aroma, Texture, Mouthfeel, Heat & Sensation, Overall Impression, Finish),
tap your way down (for example Aroma → Fruity → Citrus), and at the bottom you
get a left-to-right scale of descriptor words, from mildest to most intense.
Tap a word for its one-line meaning and a few similar words.

There is no backend, login or database. The URL hash holds where you are
(`#/taste/sour/sourness?w=Tart`), so the browser back button and shared links work.

## Run locally

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # validates the data, then builds to dist/
npm run preview  # serve the production build
```

## Where the data comes from

All content lives in one versioned file: [`src/data/descriptors.json`](src/data/descriptors.json).
`npm run build` runs `scripts/check-data.mjs` first, which fails the build if
the file is malformed (duplicate ids, a node with both or neither of
`children`/`scale`, unknown sources, more than 9 children on one node) or
repeats itself (a descriptor word on more than one scale, or a synonym that is
a word on the same scale or anywhere else).

Every category and every word has a `source` field:

- **`pe`**: taken read-only from the Food Science branch of
  [Project Everything](https://github.com/mhaney93/Project_Everything)
  (Applied Sciences → Food Science → Development of Sensory Lexicons). Where
  the PE label differs (PE disambiguates names like `Sharp|sour`), the original
  is kept in `peLabel`. The mild-to-intense ordering was added here.
- **`sensory`**: gap-fill entries from standard sensory-science and
  flavor-wheel vocabulary, for areas PE doesn't cover yet (for example
  carbonation, finish, Sichuan-pepper numbing).

To add or change words, edit `descriptors.json`, bump `version` if the shape
changes, and run `npm run build`.

## Deployment

Hosted on Vercel (project `food-describer`, connected to this GitHub repo).
Every merge to `main` deploys to production automatically.
