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
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }
      @media (max-width: 680px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
      label {
        display: block;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 4px;
      }
      input, select, button {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #bfd0d8;
        border-radius: 8px;
        padding: 8px;
        font-size: 14px;
      }
      button {
        margin-top: 10px;
        border: 0;
        background: #0f766e;
        color: #fff;
        font-weight: 700;
      }
      #status {
        margin-top: 10px;
        border: 1px solid #d7e2e7;
        border-radius: 8px;
        background: #f8fbfc;
        padding: 8px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      h3 {
        margin: 0 0 10px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h3>Instant Vehicle Quote</h3>
        <div class="grid">
          <div><label for="year">Year</label><input id="year" value="" /></div>
          <div><label for="make">Make</label><input id="make" value="" /></div>
          <div><label for="model">Model</label><input id="model" value="" /></div>
          <div><label for="trim">Trim</label><input id="trim" value="" /></div>
          <div><label for="titleType">Title Type</label><select id="titleType"><option value="" selected>Select</option><option>clean</option><option>salvage</option><option>rebuilt</option><option>no_title</option></select></div>
          <div><label for="zipCode">ZIP</label><input id="zipCode" value="" /></div>
          <div><label for="mileage">Mileage</label><input id="mileage" value="" /></div>
          <div><label for="startsDrives">Starts and Drives</label><select id="startsDrives"><option value="" selected>Select</option><option>starts_and_drives</option><option>starts_no_drive</option><option>no_start</option></select></div>
          <div><label for="outstandingLoan">Outstanding Loan</label><select id="outstandingLoan"><option value="" selected>Select</option><option>yes</option><option>no</option></select></div>
          <div><label for="keysAvailable">Keys Available</label><select id="keysAvailable"><option value="" selected>Select</option><option>yes</option><option>no</option></select></div>
          <div><label for="hasDamage">Any Damage</label><select id="hasDamage"><option value="" selected>Select</option><option>yes</option><option>no</option></select></div>
          <div><label for="phoneNumber">Phone Number</label><input id="phoneNumber" value="" /></div>
        </div>
        <button id="quoteBtn">Get Quote</button>
        <div id="status">Ready.</div>
      </div>
    </div>
    <script>
      function byId(id) { return document.getElementById(id); }

      function setStatus(text) {
        byId("status").textContent = text;
      }

      function prefillFromToolInput() {
        var input = (window.openai && window.openai.toolInput) ? window.openai.toolInput : null;
        if (!input) {
          return;
        }

        var fields = [
          "year",
          "make",
          "model",
          "trim",
          "titleType",
          "zipCode",
          "mileage",
          "startsDrives",
          "outstandingLoan",
          "keysAvailable",
          "hasDamage",
          "phoneNumber"
        ];

        for (var i = 0; i < fields.length; i++) {
          var key = fields[i];
          var value = input[key];
          if (value === undefined || value === null || value === "") {
            continue;
          }
          var el = byId(key);
          if (el) {
            el.value = String(value);
          }
        }
      }

      function toPayload() {
        return {
          year: Number(byId("year").value),
          make: byId("make").value,
          model: byId("model").value,
          trim: byId("trim").value,
          titleType: byId("titleType").value,
          zipCode: byId("zipCode").value,
          mileage: Number(byId("mileage").value),
          startsDrives: byId("startsDrives").value,
          outstandingLoan: byId("outstandingLoan").value,
          keysAvailable: byId("keysAvailable").value,
          hasDamage: byId("hasDamage").value,
          phoneNumber: byId("phoneNumber").value
        };
      }

      function formatResult(data) {
        if (data.eligible === false) {
          return "No instant offer generated. Reason: " + data.reason;
        }
        return "Firm Offer: $" + data.firmOffer + "\\n" +
          "Range: $" + data.minOffer + " to $" + data.maxOffer + "\\n" +
          "Confidence: " + data.confidence + "\\n" +
          "Accept URL: " + data.acceptUrl;
      }

      async function getQuote() {
        try {
          if (!window.openai || typeof window.openai.callTool !== "function") {
            setStatus("Bridge unavailable in this host.");
            return;
          }

          setStatus("Calculating...");
          var result = await window.openai.callTool("submit_vehicle_quote_from_ui", toPayload());

          if (result && result.structuredContent && result.structuredContent.ok) {
            setStatus(formatResult(result.structuredContent));
            return;
          }

          if (result && result.content && result.content[0] && result.content[0].text) {
            setStatus(result.content[0].text);
            return;
          }

          setStatus("Unexpected response from tool.");
        } catch (error) {
          setStatus(String(error));
        }
      }

      byId("quoteBtn").addEventListener("click", getQuote);
      prefillFromToolInput();
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
                prefersBorder: true
              },
              "openai/widgetDescription": "Vehicle quote form with title, starts/drives, loan, keys, damage, and phone fields.",
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
      inputSchema: {
        year: z.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),
        make: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
        trim: z.string().min(1).optional(),
        mileage: z.number().int().min(0).max(500000).optional()
      },
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
    async (args) => {
      return {
        content: [{ type: "text", text: "Quote form opened. Fill the fields to get an offer." }],
        structuredContent: { opened: true, ...args }
      };
    }
  );

  server.registerTool(
    "create_vehicle_quote",
    {
      title: "Create Vehicle Quote",
      description: "Generate a prototype vehicle offer using year, make, model, trim, title, location, and vehicle state.",
      inputSchema: {
        year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
        make: z.string().min(1),
        model: z.string().min(1),
        trim: z.string().min(1),
        titleType: z.enum(["clean", "salvage", "rebuilt", "no_title"]),
        zipCode: z.string().regex(/^[0-9]{5}$/),
        mileage: z.number().int().min(0).max(500000),
        startsDrives: z.enum(["starts_and_drives", "starts_no_drive", "no_start"]),
        outstandingLoan: z.enum(["yes", "no"]),
        keysAvailable: z.enum(["yes", "no"]),
        hasDamage: z.enum(["yes", "no"]),
        phoneNumber: z.string().min(10)
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
        trim: z.string().min(1),
        titleType: z.enum(["clean", "salvage", "rebuilt", "no_title"]),
        zipCode: z.string().regex(/^[0-9]{5}$/),
        mileage: z.number().int().min(0).max(500000),
        startsDrives: z.enum(["starts_and_drives", "starts_no_drive", "no_start"]),
        outstandingLoan: z.enum(["yes", "no"]),
        keysAvailable: z.enum(["yes", "no"]),
        hasDamage: z.enum(["yes", "no"]),
        phoneNumber: z.string().min(10)
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
