# 🍔 Food Delivery User Frontend

Next.js platform storefront (runmeal.com) - browse all brands and place orders.

## Features

- **Restaurant Discovery** - Browse by location
- **Menu Browsing** - View products with options
- **Shopping Cart** - Add items, customize, manage quantities
- **Checkout** - Address selection, payment
- **Order Tracking** - Real-time status updates
- **Profile** - Manage account, addresses, order history

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev    # http://localhost:3002
```

## Scripts

| Command         | Description             |
| --------------- | ----------------------- |
| `npm run dev`   | Dev server on port 3002 |
| `npm run build` | Production build        |
| `npm run preview` | OpenNext Cloudflare preview |
| `npm run deploy` | Build and deploy to Cloudflare Workers |
| `npm run upload` | Upload a new Cloudflare Worker version |
| `npm run pages-build` | Cloudflare build command |
| `npm run start` | Run production          |
| `npm run lint`  | Lint code               |

## Cloudflare Deploy

Required environment variables:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Recommended Cloudflare settings:

- Build command: `npm run pages-build`
- Deploy command: `npm run deploy`

Local verification:

```bash
npm run preview
npm run deploy
```

## vs branch-fe

| This (user-fe)    | branch-fe             |
| ----------------- | --------------------- |
| runmeal.com       | brandname.runmeal.com |
| All brands        | Single brand          |
| Platform branding | Custom brand theming  |
| Discovery focused | Direct brand access   |

## Tech Stack

- Next.js 16 (App Router, React 19)
- TailwindCSS 4
- react-hook-form + Zod
- Google Maps integration
