# Ozwell Studio

## Application Server

Your application must listen on `0.0.0.0:3000`. It is served to users
through a reverse proxy — you will not know the hostname or domain in
advance, so do not hard-code or validate the `Host` header.

## Path Handling

The application is accessed two ways:

1. **Directly** — the user visits the root of a dedicated hostname
   (e.g. `https://demo.example.com/`). Requests arrive at your server
   with their original path unchanged.

2. **Through the Studio dashboard** — the user visits
   `https://studio.example.net/preview/…`. The `/preview` prefix is
   **not stripped** — the request arrives at your server with the full
   path (e.g. `/preview/page`). Your application must be able to
   serve content under the `/preview/` base path.

Because of this, your application should:

- Mount all routes under both `/` and `/preview/` so the app works
  in both access modes.
- Use **relative URLs** (e.g. `./assets/main.js`, not
  `/assets/main.js`) for static assets whenever possible, so links
  work regardless of how the page was loaded.
- Avoid absolute redirects that assume a specific origin or path
  prefix.
