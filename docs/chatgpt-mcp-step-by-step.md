# Build This In ChatGPT: Step-by-Step (Beginner)

This guide helps you connect your prototype MCP server to ChatGPT.

## A) One-time setup

1. Install Node.js LTS.
2. Install Cloudflare Tunnel:
   - https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
3. In project folder, copy env:
   - `Copy-Item .env.example .env`
4. Install dependencies:
   - `npm install`

## B) Start both servers

Open terminal 1:

- `npm run start`

Open terminal 2:

- `npm run mcp`

Expected:

- API on `http://localhost:8787`
- MCP on `http://localhost:8788/mcp`

## C) Make MCP server public (free)

Open terminal 3:

- `cloudflared tunnel --url http://localhost:8788`

Copy the generated public URL like:

- `https://something.trycloudflare.com`

Your MCP URL becomes:

- `https://something.trycloudflare.com/mcp`

## D) Add MCP server inside ChatGPT

1. Open ChatGPT and go to your GPT builder/editor.
2. Find MCP servers/integrations section.
3. Add server URL:
   - `https://something.trycloudflare.com/mcp`
4. Save.

## E) Test in ChatGPT

Paste this test message:

"I want to sell my 2018 Toyota Camry with 82000 miles. Condition good, no damage, drivable yes, zip code 30301."

Expected behavior:

1. GPT asks for any missing fields.
2. GPT calls `create_vehicle_quote`.
3. GPT returns offer and acceptance link.
4. If you say "accept", GPT can call `accept_quote` and guide user to continue flow.

## F) If it fails

1. Check both local servers are still running.
2. Check tunnel URL has not changed.
3. Re-add updated tunnel URL in ChatGPT.
4. Test API directly:
   - `Invoke-RestMethod -Method Get -Uri http://localhost:8787/health`
5. Restart servers and tunnel.

## G) Production hardening later

- Add API auth between MCP and quote API.
- Add rate limiting.
- Add logging + persistence.
- Replace pricing model with real valuation service.
