# Cloudflare Free Acceleration Checklist

This project already serves the static export and `/api/*` from one Cloudflare Worker. For a small private group in mainland China, the safest free setup is to keep this architecture and enable the low-risk free Cloudflare optimizations below.

## Dashboard Settings

Use these settings on the Cloudflare zone that serves the public domain.

### DNS

- Keep the app hostname proxied through Cloudflare, shown as the orange cloud in DNS.
- If the hostname is DNS-only, Cloudflare CDN, HTTP/3, Brotli, and edge caching will not apply.

### Speed

- Enable Brotli compression.
- Enable HTTP/3.
- Enable Early Hints.
- Leave Rocket Loader off unless the site has been tested after enabling it.

### Cache Rules

Create rules in this order:

1. Static Next.js assets
   - Match: URI path starts with `/_next/static/`
   - Cache eligibility: Cache
   - Edge TTL: 1 year
   - Browser TTL: 1 year
   - Mark immutable for content-hashed files under `/_next/static/`.

2. Public images and icons
   - Match: URI path ends with `.svg`, `.png`, `.jpg`, `.jpeg`, `.webp`, or `.ico`
   - Cache eligibility: Cache
   - Edge TTL: 7 days or longer
   - Browser TTL: 7 days

3. API routes
   - Match: URI path starts with `/api/`
   - Cache eligibility: Bypass cache

The Worker already gives `/api/state` a 10 second edge cache and clears that cache after writes. Do not add a long Cloudflare dashboard cache rule for `/api/*`, because match edits and imports need to show up quickly.

## Repository Defaults

The repository includes `public/_headers` as a deploy-time fallback for static asset caching:

- `/_next/static/*` uses a long immutable cache because these files are content-addressed by the build output.
- other `/_next/*` files keep a short 5 minute cache as a conservative fallback.
- common image/icon assets are cached for 7 days.
- HTML and route entry points use `no-cache`, so browsers can reuse the local copy only after checking whether the deployed entry changed.

These headers let deployments update quickly without repeatedly clearing the whole browser cache on every page visit.

## Optional Hong Kong Entry

If the free Cloudflare route is still slow, use an overseas or Hong Kong CDN/proxy in front of the existing Cloudflare Worker. Keep `/api/*` uncached or very short cached. Do not enable mainland China acceleration unless the domain has ICP filing.
