# Cirkle Search (prototype)

A small search engine over sites you choose. It is not a web-wide search engine. Glyde still uses Google as its only search engine; this is a separate project.

## How it works
1. `sources.json` lists the sites to read (seeds and allowed hosts).
2. `crawler/crawl.mjs` visits them politely: it obeys robots.txt, noindex, waits between requests and identifies itself as `CirkleSearchBot`.
3. Pages are ranked with BM25 (title words count 3 times, description words twice).
4. The result is a static file, `data/index.json`, served by `api/search.js` on Vercel.
5. A nightly GitHub Actions run rebuilds the index, so no always-on server is needed.

Queries are sent by POST so they never appear in URLs, and the code does not store or log them.

## Use it
    cd search
    npm test          # run the tests
    npm run crawl     # edit sources.json first

Pages the crawler cannot read (sites drawn by JavaScript) can be added by hand: copy `sources/manual.example.json` to `sources/manual.json`.

## Deploy
Import the repo in Vercel with the root directory set to `search`. Replace `SEARCH_ORIGIN` in `public/opensearch.xml` with your real address.
