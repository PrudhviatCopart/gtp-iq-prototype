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
    <title>CashForCars Quote Form</title>
    <style>
      :root {
        --bg: #f3f6f8;
        --card: #ffffff;
        --ink: #13212c;
        --muted: #5a6b78;
        --line: #d8e1e8;
        --brand: #0f766e;
      }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        background: radial-gradient(circle at top right, #e4ecef 0%, var(--bg) 44%, #edf1f4 100%);
        color: var(--ink);
      }
      .wrap {
        max-width: 900px;
        margin: 12px auto;
        padding: 10px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 14px;
        box-shadow: 0 8px 20px rgba(19, 33, 44, 0.08);
        padding: 14px;
      }
      h2 {
        margin: 0 0 6px;
        font-size: 20px;
      }
      p {
        margin: 0 0 12px;
        color: var(--muted);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      label {
        display: block;
        font-size: 12px;
        font-weight: 700;
        margin-bottom: 5px;
      }
      input, select, button {
        width: 100%;
        box-sizing: border-box;
        border-radius: 9px;
        border: 1px solid #bfccd7;
        font-size: 14px;
        padding: 10px;
      }
      button {
        margin-top: 10px;
        border: 0;
        background: var(--brand);
        color: #fff;
        font-weight: 700;
        cursor: pointer;
      }
      .result {
        margin-top: 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #f9fbfc;
        padding: 10px;
      }
      .result a {
        color: #0f5f84;
        word-break: break-all;
      }
      .error {
        color: #a11f1f;
        font-weight: 700;
      }
      @media (max-width: 720px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h2>Instant Vehicle Quote</h2>
        <p>Enter details and get your estimate in chat.</p>
        <div class="grid">
          <div><label for="year">Year</label><input id="year" value="2018" /></div>
          <div><label for="make">Make</label><input id="make" value="Honda" /></div>
          <div><label for="model">Model</label><input id="model" value="Accord" /></div>
          <div><label for="mileage">Mileage</label><input id="mileage" value="82000" /></div>
          <div>
            <label for="condition">Condition</label>
            <select id="condition">
              <option>excellent</option>
              <option selected>good</option>
              <option>fair</option>
              <option>poor</option>
            </select>
          </div>
          <div>
            <label for="damageLevel">Damage Level</label>
            <select id="damageLevel">
              <option selected>none</option>
              <option>minor</option>
              <option>moderate</option>
              <option>major</option>
            </select>
          </div>
          <div>
            <label for="drivable">Drivable</label>
            <select id="drivable">
              <option selected>yes</option>
              <option>no</option>
            </select>
          </div>
          <div><label for="zipCode">ZIP</label><input id="zipCode" value="30301" /></div>
        </div>
        <button id="submitBtn">Get Quote</button>
        <div id="result" class="result">Waiting for input.</div>
      </div>
    </div>
    <script>
      const resultEl = document.getElementById("result");

      function notifyHeight() {
        if (window.openai && typeof window.openai.notifyIntrinsicHeight === "function") {
          window.openai.notifyIntrinsicHeight(document.body.scrollHeight);
        }
      }

      function renderQuote(data) {
        resultEl.innerHTML =
          "<div><strong>Firm Offer:</strong> $" + data.firmOffer + "</div>" +
          "<div><strong>Range:</strong> $" + data.minOffer + " to $" + data.maxOffer + "</div>" +
          "<div><strong>Confidence:</strong> " + data.confidence + "</div>" +
          "<div><strong>Accept:</strong> <a href=\"" + data.acceptUrl + "\" target=\"_blank\" rel=\"noopener\">" + data.acceptUrl + "</a></div>";
      }

      function renderError(message) {
        resultEl.innerHTML = "<div class=\"error\">" + message + "</div>";
      }

      async function submitQuote() {
        if (!window.openai || typeof window.openai.callTool !== "function") {
          renderError("Widget bridge is unavailable in this environment.");
          notifyHeight();
          return;
        }

        const payload = {
          year: Number(document.getElementById("year").value),
          make: document.getElementById("make").value,
          model: document.getElementById("model").value,
          mileage: Number(document.getElementById("mileage").value),
          condition: document.getElementById("condition").value,
          damageLevel: document.getElementById("damageLevel").value,
          drivable: document.getElementById("drivable").value,
          zipCode: document.getElementById("zipCode").value
        };

        resultEl.textContent = "Calculating offer...";
        notifyHeight();

        try {
          const toolResult = await window.openai.callTool("submit_vehicle_quote_from_ui", payload);
          const structured = toolResult?.structuredContent || null;

          if (toolResult?.isError) {
            renderError((toolResult?.content && toolResult.content[0]?.text) || "Unable to get quote.");
          } else if (structured && structured.ok) {
            renderQuote(structured);
          } else {
            renderError("Unexpected response from quote tool.");
          }
        } catch (error) {
          renderError(String(error));
        }

        notifyHeight();
      }

      document.getElementById("submitBtn").addEventListener("click", submitQuote);
      notifyHeight();
    </script>
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
                prefersBorder: true,
                csp: {
                  connectDomains: [],
                  resourceDomains: []
                }
              },
              "openai/widgetDescription": "Vehicle quote form for make, model, mileage, condition, and ZIP.",
              "openai/widgetPrefersBorder": true,
              "openai/widgetCSP": {
                connect_domains: [],
                resource_domains: []
              }
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
