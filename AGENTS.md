# AGENTS - runmeal-portal-fe-website

Next.js customer-facing frontend for browsing menus and placing orders.

## Project structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (app)/              # Authenticated routes
│   │   ├── cart/           # Shopping cart
│   │   ├── checkout/       # Checkout flow
│   │   ├── orders/         # Order history
│   │   ├── profile/        # User profile
│   │   └── addresses/      # Address management
│   ├── (auth)/             # Auth routes
│   ├── menu/               # Public menu browsing
│   └── layout.tsx          # Root layout
│
├── components/             # React components
│   ├── ui/                 # Shadcn-style UI primitives
│   ├── cart/               # Cart-related components
│   ├── menu/               # Menu display components
│   └── [feature]/          # Feature-specific components
│
├── services/               # API service layer
│   ├── api.ts              # Base API client
│   ├── auth.ts             # Auth service
│   ├── cart.ts             # Cart service
│   └── orders.ts           # Orders service
│
├── context/                # React contexts
│   ├── AuthContext.tsx     # Auth state
│   └── CartContext.tsx     # Cart state
│
├── providers/              # App providers
├── lib/                    # Utilities
└── types/                  # TypeScript definitions
```

## Key files

| File                      | Purpose                    |
| ------------------------- | -------------------------- |
| `src/app/layout.tsx`      | Root layout with providers |
| `src/services/*.ts`       | Backend API integration    |
| `src/context/*.tsx`       | Global state contexts      |
| `src/components/ui/*.tsx` | Reusable UI components     |

## Scripts

| Command         | Description             |
| --------------- | ----------------------- |
| `npm run dev`   | Dev server on port 3002 |
| `npm run build` | Production build        |
| `npm run lint`  | ESLint check            |

## Tech stack

- **Framework**: Next.js 16 (App Router, React 19)
- **Styling**: TailwindCSS 4 + tw-animate-css
- **Forms**: react-hook-form + Zod
- **HTTP**: Axios
- **Maps**: @vis.gl/react-google-maps
- **Icons**: lucide-react
- **UI**: Radix UI + custom components

## Conventions

- API calls in `src/services/` directory
- Use contexts for global state (auth, cart)
- Use existing UI components from `src/components/ui/`
- Pages are server components by default
- Run `npm run lint` before committing
