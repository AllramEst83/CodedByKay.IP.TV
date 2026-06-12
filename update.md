Root Problem & Proposed Fixes

1. Full Catalog Loading Issue (OOM & Payload Limit)
- Root Cause: When loading "All Categories" (empty category_id), the Xtream API returns the entire VOD/Series library. For many IPTV providers, this is a massive JSON response (often 50MB to 100MB+). The Netlify BFF (`netlify/functions/xtream.js`) currently reads the entire response into memory using `await upstream.json()` and then serializes it again with `JSON.stringify()`. This causes the serverless function to exceed its memory limit (crashing with Out-Of-Memory) or hit the strict 6MB AWS API Gateway payload limit, resulting in a 502 Bad Gateway error.
- Fix Needed: The Netlify function should bypass JSON parsing for large library requests and directly stream the upstream HTTP response body back to the client (`return new Response(upstream.body)`). The `auth === 0` check should be restricted to only the `authenticate` action, allowing data to stream efficiently without buffering.

2. Image Loading Bottleneck
- Root Cause: The image proxy (`netlify/functions/image.js`) also buffers entire image payloads into memory (`await upstream.arrayBuffer()`) before returning them. This causes high memory consumption and delays the delivery of images to the browser, making the UI feel sluggish when rendering grids.
- Fix Needed: Update the image proxy to also stream the response directly (`return new Response(upstream.body)`). Combined with the native `loading="lazy"` attributes on the frontend, this will significantly improve image loading performance and eliminate function bottlenecks.
