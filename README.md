# 🎮 Next Up

**Less choosing. More playing.**

I love games. Finding time for them is harder. I built Next Up to keep my backlog in one place and help me pick something for the device and time I have.

- 🕹️ Your library, wishlist and current games.
- 🔎 Search-as-you-type with IGDB, or add games manually.
- 🌙 Dark/light themes and an offline PWA.
- 💾 No account required. Data stays in your browser; JSON backups move it with you.

**Built with:** React · TypeScript · Vite · Tailwind CSS · shadcn/ui + Radix · Dexie/IndexedDB · Zod · Cloudflare Workers + Durable Objects.

**Tested with:** Vitest · Playwright · axe · Lighthouse.

### Run locally

Node 22.12+ and npm.

```sh
npm ci
npm run build
npm run preview
```

Open **http://127.0.0.1:3030**. [Setup & checks](docs/development.md) · [API keys](docs/integrations.md) · [Validation](docs/validation.md)

**Prototype:** no cloud sync. Steam import is experimental and still needs live HTTPS login testing. No paid AI APIs. No app deployment yet.
