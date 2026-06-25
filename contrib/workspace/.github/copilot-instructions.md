# Ozwell Studio

## Application Server

Your application must listen on `0.0.0.0:3000`. It is served to users
through a reverse proxy — you will not know the hostname or domain in
advance, so do not hard-code or validate the `Host` header.

## Path Handling

Your application is always served at the root path (`/`). Requests
arrive at your server with their original path unchanged — there is no
prefix to strip or account for.

The application is reached two ways:

1. **Directly** — the user visits the root of a dedicated hostname
   (e.g. `https://demo.example.com/`).

2. **Embedded in the Studio dashboard** — the dashboard loads your app
   (served at `/`) inside an iframe. The path is still `/`; the only
   difference is that the page is framed.

Because of this, your application should:

- Use **relative URLs** (e.g. `./assets/main.js`, not
  `/assets/main.js`) for static assets whenever possible, so links
  work regardless of how the page was loaded.
- Avoid absolute redirects that assume a specific origin.
- Not send `X-Frame-Options` or a restrictive
  `Content-Security-Policy: frame-ancestors` header, or the browser
  will refuse to embed the app in the dashboard iframe.
