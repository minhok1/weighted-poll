# Weighted Poll (Web-First)

This project runs as a mobile-friendly web app using Expo Web.

## Local development

```bash
npm install
npm run web
```

## Production web build

```bash
npm run build:web
```

This creates a static build in `dist/`.

## Preview production build locally

```bash
npm run preview:web
```

## Deploy options

- Vercel: import this repo, build command `npm run build:web`, output `dist`
- Netlify: build command `npm run build:web`, publish directory `dist`
- Cloudflare Pages: framework "None", build command `npm run build:web`, output `dist`

## Environment variables

For Supabase, set these in your hosting provider:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

`EXPO_PUBLIC_` variables are exposed to the client app.
