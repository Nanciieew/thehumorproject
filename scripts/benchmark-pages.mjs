// Production HTTP timings, not browser LCP. No cookies or private data are logged.
// node scripts/benchmark-pages.mjs [http://127.0.0.1:3001]
const base = process.argv[2] ?? 'http://127.0.0.1:3001';
const paths = ['/gallery', '/api/gallery?sort=top', '/page-art/gallery-decoration.cf65846479ac.webp', '/page-art/quest-background.fb730a831b0c.webp'];
for (let run = 1; run <= 3; run++) for (const path of paths) {
  const start = performance.now();
  const response = await fetch(new URL(path, base), { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' }, signal: AbortSignal.timeout(30_000) });
  const headersMs = Math.round(performance.now() - start);
  let bytes = 0, html = '', galleryShellMs = null, firstCardMs = null;
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (path === '/gallery') {
      html += decoder.decode(chunk, { stream: true });
      if (galleryShellMs === null && html.includes('id="gallery-title"')) galleryShellMs = Math.round(performance.now() - start);
      if (firstCardMs === null && html.includes('class="gallery-card ')) firstCardMs = Math.round(performance.now() - start);
    }
  }
  console.log(JSON.stringify({ run, path, status: response.status, headersMs, ...(path === '/gallery' ? { galleryShellMs, firstCardMs } : {}), totalMs: Math.round(performance.now()-start), bytes, cacheControl:response.headers.get('cache-control') }));
}
