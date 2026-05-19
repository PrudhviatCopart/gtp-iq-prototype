# GPT InstaQuote Prototype

This project is a beginner-friendly prototype to let a Custom GPT collect vehicle details and return a price estimate through an API.

It now includes both options:

- GPT Actions (OpenAPI based)
- MCP Server (Model Context Protocol)

## What this prototype includes

- Node.js API with quote endpoint: `POST /api/quote`
- Accept endpoint: `POST /api/accept`
- Simple browser tester page: `http://localhost:8787`
- MCP server endpoint: `http://localhost:8788/mcp`
- OpenAPI file for GPT Actions: `docs/openapi.yaml`
- Suggested GPT behavior instructions: `docs/gpt-instructions.md`

## 1) Install and run

1. Open a terminal in this project folder.
2. Copy env file:
   - Windows PowerShell: `Copy-Item .env.example .env`
3. Install dependencies:
   - `npm install`
4. Start server:
   - `npm run start`
5. Open:
   - `http://localhost:8787`

## 1b) Run MCP server locally

In another terminal:

1. Start MCP server:
   - `npm run mcp`
2. MCP endpoint:
   - `http://localhost:8788/mcp`

## 2) Test API quickly

Use this PowerShell command:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8787/api/quote -ContentType "application/json" -Body '{
  "year": 2018,
  "make": "Toyota",
  "model": "Camry",
  "mileage": 82000,
  "condition": "good",
  "damageLevel": "none",
  "drivable": "yes",
  "zipCode": "30301"
}'
```

## 3) Connect to Custom GPT (prototype)

1. Create a Custom GPT in ChatGPT.
2. In Actions, import `docs/openapi.yaml`.
3. Replace `https://YOUR-PUBLIC-URL` with your public API URL.
4. Paste `docs/gpt-instructions.md` into GPT instructions.

## 3b) Connect as MCP in ChatGPT (prototype)

Use this path if you want MCP instead of Actions.

1. Make sure both servers are running:
   - API: `npm run start` (port 8787)
   - MCP: `npm run mcp` (port 8788)
2. Expose MCP server publicly with Cloudflare Tunnel (free):
   - `cloudflared tunnel --url http://localhost:8788`
3. Copy the public `https://...trycloudflare.com` URL.
4. In ChatGPT, open your GPT configuration and add MCP server URL:
   - `https://YOUR-TUNNEL-URL/mcp`
5. Save and test with prompt:
   - "I want to sell my 2018 Toyota Camry, 82k miles, good condition, no damage, drivable, ZIP 30301."

The MCP server will call your local quote API and return offer info back inside chat.

### MCP UI behavior

This MCP server now includes an in-chat widget tool:

- `open_quote_form_ui`

To make ChatGPT open the form card instead of asking only text questions, add this instruction in your GPT:

- "When user intent is to sell/check price for a vehicle, call `open_quote_form_ui` first."

## 4) Expose local API to internet

Custom GPT Actions must call a public URL. For prototype you can use a tunnel tool:

- Option A: Cloudflare Tunnel
- Option B: ngrok

When you get the public URL, update `docs/openapi.yaml` server URL and re-import it into the GPT.

## 5) How acceptance works

The API response includes `acceptUrl`.
When user accepts in chat, GPT sends them to that URL so they continue on your website flow.

## Important notes

- This is a prototype pricing model, not production valuation.
- No database is used yet.
- Add auth/rate limiting/logging before production use.

## Deploy real MCP server

Use this guide:

- `docs/deploy-real-mcp-server.md`

## Free stack summary (prototype)

- Runtime: Node.js on your machine (free)
- Public URL: Cloudflare Tunnel free plan
- Chat side: ChatGPT custom GPT with MCP server
