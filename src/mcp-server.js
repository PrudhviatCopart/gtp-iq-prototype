import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

dotenv.config();

const mcpPort = Number(process.env.PORT || process.env.MCP_PORT || 8788);
const quoteApiBaseUrlRaw = process.env.QUOTE_API_BASE_URL || "http://localhost:8787";
const quoteApiBaseUrl = /^https?:\/\//i.test(quoteApiBaseUrlRaw)
  ? quoteApiBaseUrlRaw
  : `https://${quoteApiBaseUrlRaw}`;
const allowedHosts = String(process.env.MCP_ALLOWED_HOSTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const transports = {};

async function requestQuote(args) {
  const response = await fetch(`${quoteApiBaseUrl}/api/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args)
  });

  const body = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      error: body?.error || "Quote API returned an error."
    };
  }

  const summary = [
    `Firm Offer: $${body.firmOffer}`,
    `Range: $${body.minOffer} to $${body.maxOffer}`,
    `Confidence: ${body.confidence}`,
    `Accept URL: ${body.acceptUrl}`,
    `Expires At: ${body.expiresAt}`
  ].join("\n");

  return {
    ok: true,
    body,
    summary
  };
}

function createServer() {
  const server = new McpServer({
    name: "cashforcars-instaquote-mcp",
    version: "0.1.0"
  });

  server.registerResource(
    "quote-form-ui",
    "ui://quote/form.html",
    {
      mimeType: "text/html;profile=mcp-app",
      description: "Interactive vehicle quote form"
    },
    async () => {
      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CashForCars Quote</title>
    <style>
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        background: #f4f7f8;
        color: #13212c;
      }
      .wrap {
        padding: 12px;
      }
      .card {
        background: #fff;
        border: 1px solid #d7e2e7;
        border-radius: 12px;
        padding: 14px;
      }
      h3 {
        margin: 0 0 8px;
      }
      p {
        margin: 0 0 8px;
        color: #425563;
      }
      .hint {
        background: #eef4f7;
        border: 1px solid #d4e1e8;
        border-radius: 8px;
        padding: 10px;
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h3>Instant Vehicle Quote</h3>
        <p>This app is connected and ready.</p>
        <div class="hint">
          Tell the assistant your vehicle details (year, make, model, mileage, condition, damage, drivable, ZIP), and it will run the quote tool and return an offer here in chat.
        </div>
      </div>
    </div>
  </body>
</html>`;

      return {
        contents: [
          {
            uri: "ui://quote/form.html",
            mimeType: "text/html;profile=mcp-app",
            text: html,
            _meta: {
              ui: {
                prefersBorder: true
              },
              "openai/widgetDescription": "Vehicle quote form for make, model, mileage, condition, and ZIP.",
              "openai/widgetPrefersBorder": true
            }
          }
        ]
      };
    }
  );

  server.registerTool(
    "open_quote_form_ui",
    {
      title: "Open Quote Form UI",
      description: "Open an interactive vehicle quote form in chat.",
      inputSchema: {},
      _meta: {
        ui: {
          resourceUri: "ui://quote/form.html"
        },
        "openai/outputTemplate": "ui://quote/form.html",
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Opening quote form...",
        "openai/toolInvocation/invoked": "Quote form ready"
      }
    },
    async () => {
      return {
        content: [{ type: "text", text: "Quote form opened. Fill the fields to get an offer." }],
        structuredContent: {
          opened: true
        }
      };
    }
  );

  server.registerTool(
    "create_vehicle_quote",
    {
      title: "Create Vehicle Quote",
      description: "Generate a prototype vehicle offer using year, make, model, mileage, condition and location.",
      inputSchema: {
        year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
        make: z.string().min(1),
        model: z.string().min(1),
        mileage: z.number().int().min(0).max(500000),
        condition: z.enum(["excellent", "good", "fair", "poor"]),
        damageLevel: z.enum(["none", "minor", "moderate", "major"]),
        drivable: z.enum(["yes", "no"]),
        zipCode: z.string().regex(/^[0-9]{5}$/)
      }
    },
    async (args) => {
      const quote = await requestQuote(args);
      if (!quote.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: quote.error }]
        };
      }

      return {
        content: [{ type: "text", text: quote.summary }],
        structuredContent: quote.body
      };
    }
  );

  server.registerTool(
    "submit_vehicle_quote_from_ui",
    {
      title: "Submit Vehicle Quote From UI",
      description: "Used by the quote widget to submit form data and retrieve an offer.",
      inputSchema: {
        year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
        make: z.string().min(1),
        model: z.string().min(1),
        mileage: z.number().int().min(0).max(500000),
        condition: z.enum(["excellent", "good", "fair", "poor"]),
        damageLevel: z.enum(["none", "minor", "moderate", "major"]),
        drivable: z.enum(["yes", "no"]),
        zipCode: z.string().regex(/^[0-9]{5}$/)
      },
      _meta: {
        ui: {},
        "openai/widgetAccessible": true
      }
    },
    async (args) => {
      const quote = await requestQuote(args);
      if (!quote.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: quote.error }]
        };
      }

      return {
        content: [{ type: "text", text: quote.summary }],
        structuredContent: quote.body
      };
    }
  );

  server.registerTool(
    "accept_quote",
    {
      title: "Accept Quote",
      description: "Marks a quote as accepted in prototype mode.",
      inputSchema: {
        quoteId: z.string().min(1)
      }
    },
    async ({ quoteId }) => {
      const response = await fetch(`${quoteApiBaseUrl}/api/accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quoteId })
      });

      const body = await response.json();
      if (!response.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: body?.error || "Accept API returned an error." }]
        };
      }

      return {
        content: [{ type: "text", text: `${body.message} Quote ID: ${body.quoteId}` }],
        structuredContent: body
      };
    }
  );

  return server;
}

const app = createMcpExpressApp(
  allowedHosts.length > 0
    ? { host: "0.0.0.0", allowedHosts }
    : { host: "0.0.0.0" }
);

app.post("/mcp", async (req, res) => {
  try {
    const sessionId = req.headers["mcp-session-id"];
    let transport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId) => {
          transports[newSessionId] = transport;
        }
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
        }
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided"
        },
        id: null
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error"
        },
        id: null
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
});

app.listen(mcpPort, (error) => {
  if (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }

  console.log(`MCP server listening on http://localhost:${mcpPort}/mcp`);
  console.log(`Quote API target is ${quoteApiBaseUrl}`);
});

process.on("SIGINT", async () => {
  for (const sessionId in transports) {
    await transports[sessionId].close();
    delete transports[sessionId];
  }
  process.exit(0);
});
