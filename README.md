# 🎮 Next Up

**Less choosing. More playing.**

I love games. Finding time for them is harder. I built Next Up to keep my backlog in one place and help me pick something for the device and time I have.

- 🕹️ Your library, wishlist and current games.
- 🔎 Search-as-you-type with IGDB, or add games manually.
- 🌙 Dark/light themes and an offline PWA.
- 💾 Google sign-in, a private library across devices, and JSON backups.

**Built with:** React · TypeScript · Vite · Tailwind CSS · shadcn/ui + Radix · Supabase Auth + PostgreSQL · Dexie/IndexedDB · Zod · Cloudflare Workers + Durable Objects.

**Tested with:** Vitest · Playwright · axe · Lighthouse.

### Run locally

Node 22.12+ and npm.

```sh
npm ci
# Configure .env.local using .env.example and follow supabase/README.md
npm run build
npm run preview
```

Open **http://127.0.0.1:3030**. [Setup & checks](docs/development.md) · [API keys](docs/integrations.md) · [Validation](docs/validation.md)

[Try Next Up](https://next-up.deivbid.workers.dev/) 🎮

**This branch:** account storage is ready for local testing. Read your saved copy offline; connect to edit. Refresh to pick up changes from another device. No paid AI APIs. Steam import uses the HTTPS app. [Supabase setup](supabase/README.md).

## Connect your AI 🔌

Next Up includes an authenticated MCP server: look up games, get recommendations, or grant access to edit individual games. Manage access in Settings. [Setup & tools](docs/mcp.md).
