# Deploy A Real MCP Server (Beginner Guide)

This guide gets you from local prototype to a public MCP URL you can connect in ChatGPT.

## Recommended free path: Render

Why Render:
- Supports long-running Node.js web services.
- Gives public HTTPS URL.
- Easy environment variable setup.

Your project already includes a Render blueprint file:
- `render.yaml`

## 1) Push project to GitHub

1. Create a new GitHub repo.
2. Push this folder (`gpt-instaquote-prototype`) to that repo.

## 2) Create Render account

1. Go to https://render.com
2. Sign in with GitHub.

## 3) Deploy from blueprint

1. In Render dashboard, click New +.
2. Choose Blueprint.
3. Select your GitHub repo.
4. Render reads `render.yaml` and creates 2 services:
   - `cfc-instaquote-api`
   - `cfc-instaquote-mcp`

## 4) Configure env vars after first deploy

1. Open `cfc-instaquote-api` service:
   - Set `CONTINUE_BASE_URL=https://www.cashforcars.com/instaquote/`
   - Set `CORS_ORIGIN=*`
   - Set strong `SECRET_KEY`
2. Open `cfc-instaquote-mcp` service:
   - Set `QUOTE_API_BASE_URL` to your API service URL
   - Example: `https://cfc-instaquote-api.onrender.com`
   - Set `MCP_ALLOWED_HOSTS` to your MCP hostname
   - Example: `cfc-instaquote-mcp.onrender.com`

Then click Manual Deploy for both services.

## 5) Verify endpoints

1. Check API health:
   - `https://YOUR-API-URL/health`
2. MCP endpoint is:
   - `https://YOUR-MCP-URL/mcp`

## 6) Connect in ChatGPT

1. Open your GPT builder/editor.
2. Add MCP server URL:
   - `https://YOUR-MCP-URL/mcp`
3. Save.
4. Test with vehicle details prompt.

## 7) Troubleshooting

- If MCP cannot quote:
  - Check `QUOTE_API_BASE_URL` points to correct API URL.
- If you get `Invalid Host` JSON error:
   - Set `MCP_ALLOWED_HOSTS` to your exact public MCP host.
   - Redeploy `cfc-instaquote-mcp` service.
- If deploy fails:
  - Confirm Node version is 20.
- If ChatGPT cannot connect:
  - Ensure MCP URL is HTTPS and public.

## Is WPEngine useful here?

Usually not for this MCP app.

Reason:
- This MCP server is a Node.js process that must stay running and accept HTTP requests.
- Typical WPEngine WordPress environments are optimized for PHP/WordPress, not persistent custom Node services.

Use WPEngine only if your specific plan includes a Node runtime or container service where you can run `node src/mcp-server.js` continuously and expose `/mcp` publicly via HTTPS.

If your WPEngine environment is WordPress-only, use Render/Railway/Fly.io for the MCP server.
