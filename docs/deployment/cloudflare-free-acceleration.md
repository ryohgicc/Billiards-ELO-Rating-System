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
   - Edge TTL: 5 minutes
   - Browser TTL: 5 minutes
   - Do not mark these assets immutable unless their filenames are confirmed content-hashed after every deploy.

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

- `/_next/static/*` and `/_next/*` use a short 5 minute cache because exported Turbopack chunk names can be reused between deploys.
- common image/icon assets are cached for 7 days.
- HTML and `/` are cached for 60 seconds with stale-while-revalidate.
- Route HTML responses include `Clear-Site-Data: "cache"` so browsers drop stale JS chunks after deploys.

These headers are intentionally conservative so the site can update quickly after a deploy while still avoiding repeated static asset downloads.

## Optional Hong Kong Entry

If the free Cloudflare route is still slow, use an overseas or Hong Kong CDN/proxy in front of the existing Cloudflare Worker. Keep `/api/*` uncached or very short cached. Do not enable mainland China acceleration unless the domain has ICP filing.
