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
      mimeType: "text/html+skybridge",
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
      .hidden {
        display: none !important;
      }
      .step-header {
        margin: 4px 0 10px;
        font-size: 13px;
        color: #4f6573;
        font-weight: 600;
      }
      .progress-wrap {
        margin: 0 0 12px;
      }
      .progress-track {
        width: 100%;
        height: 8px;
        border-radius: 999px;
        background: #dfe7ed;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        width: 20%;
        background: linear-gradient(90deg, #0a4f76 0%, #13ad4c 100%);
        transition: width 0.25s ease;
      }
      .progress-text {
        margin-top: 6px;
        font-size: 12px;
        color: #4f6573;
      }
      .step {
        margin-top: 4px;
      }
      .field {
        margin-bottom: 2px;
      }
      .field.full-width {
        grid-column: 1 / -1;
      }
      .dynamic-followup {
        margin-top: 14px;
      }
      .inline-options {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 6px;
      }
      .inline-options label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
        margin: 0;
      }
      .choice-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 2px;
      }
      .choice-group.cols-3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .choice-group.cols-4 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .choice-group .choice-btn {
        margin-top: 0;
        border: 1px solid #bfd0d8;
        background: #eef4f7;
        color: #163244;
        font-weight: 700;
      }
      .choice-group .choice-btn.small-text {
        font-size: 12px;
        line-height: 1.2;
      }
      .choice-group .choice-btn.selected {
        background: #0f766e;
        border-color: #0f766e;
        color: #ffffff;
      }
      .choice-group.input-error .choice-btn {
        border-color: #cf2e2e;
        background: #fff6f6;
      }
      .step-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      .btn-secondary {
        background: #e6eef3;
        color: #163244;
      }
      .brand-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 4%;
        margin-bottom: 12px;
        padding: 10px;
        border: 1px solid #d7e2e7;
        border-radius: 10px;
        background: linear-gradient(180deg, #ffffff 0%, #f7fbfd 100%);
      }
      .brand-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 34px;
      }
      .brand-logo svg {
        max-width: 100%;
        height: auto;
        display: block;
      }
      .brand-left {
        width: 48%;
      }
      .brand-right {
        width: 48%;
      }
      @media (max-width: 680px) {
        .grid { grid-template-columns: 1fr; }
        .step-actions { flex-direction: column; }
        .brand-left,
        .brand-right {
          width: 48%;
        }
        .field.full-width {
          grid-column: auto;
        }
        .choice-group.cols-3,
        .choice-group.cols-4 {
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
      .offer-wrap {
        margin-top: 10px;
        border: 1px solid #d5e2e8;
        border-radius: 12px;
        background: linear-gradient(180deg, #ffffff 0%, #f6fafb 100%);
        padding: 12px;
      }
      .offer-label {
        font-size: 12px;
        color: #4c6777;
        margin-bottom: 6px;
      }
      .damage-map {
        position: relative;
        width: min(100%, 300px);
        height: 360px;
        margin: 8px auto 0;
        background: #eef1f3 url("https://raw.githubusercontent.com/PrudhviatCopart/gtp-iq-prototype/refs/heads/main/images/damaged_areas_bg.png") center/contain no-repeat;
        background-size: 155px;
        border-radius: 12px;
      }
      .damage-zone {
        position: absolute;
        border: 2px dashed #0e9b87;
        border-radius: 10px;
        background: rgba(172, 186, 121, 0.25);
        color: #21414d;
        font-size: 11px;
        font-weight: 700;
        text-align: center;
        cursor: pointer;
      }
      .damage-zone:hover {
        background: rgba(152, 178, 89, 0.42);
      }
      .damage-zone.selected {
        background: rgba(43, 160, 118, 0.34);
        border-color: #0a7f6f;
      }
      .zone-front {
        left: 50px;
        top: 5px;
        width: 185px;
        height: 95px;
      }
      .zone-rear {
        left: 50px;
        bottom: 25px;
        width: 185px;
        height: 55px;
      }
      .zone-top {
        left: 110px;
        top: 105px;
        width: 70px;
        height: 160px;
      }
      .zone-side-left {
        left: 40px;
        top: 105px;
        width: 65px;
        height: 160px;
      }
      .zone-side-right {
        right: 45px;
        top: 105px;
        width: 65px;
        height: 160px;
      }
      .damage-hint {
        margin-top: 8px;
        font-size: 12px;
        color: #4f6573;
        text-align: center;
      }
      .full-offer-mode {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: linear-gradient(145deg, #f5fbff 0%, #eef7f1 100%);
        padding: 16px;
        overflow: auto;
      }
      .full-offer-mode .card {
        max-width: 680px;
        margin: 0 auto;
        min-height: calc(100vh - 32px);
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      .full-offer-mode .offer-wrap {
        margin-top: 18px;
        padding: 24px;
        border-radius: 18px;
      }
      .full-offer-mode .offer-price {
        font-size: 44px;
      }
      .full-offer-mode .accept-btn {
        font-size: 17px;
        padding: 13px 16px;
      }
      .offer-price {
        font-size: 32px;
        line-height: 1;
        font-weight: 800;
        color: #0f4b66;
        margin-bottom: 10px;
      }
      .accept-btn {
        display: inline-block;
        text-decoration: none;
        background: #0f766e;
        color: #ffffff;
        font-weight: 700;
        border-radius: 8px;
        padding: 10px 14px;
      }
      .input-error {
        border-color: #cf2e2e;
        background: #fff6f6;
      }
      .field-error {
        margin-top: 4px;
        font-size: 12px;
        color: #b42318;
      }
      h3 {
        margin: 0 0 10px;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="brand-row">
          <div class="brand-logo brand-left" aria-label="Cashforcars.com logo">
            <svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 308 66" style="enable-background:new 0 0 308 66; width:209px; height:45px;" xml:space="preserve">
              <style type="text/css">.st0{fill-rule:evenodd;clip-rule:evenodd;fill:#00A94F;}
                .st1{fill:#FFFFFF;}</style>
              <g>
                <g>
                <g>
                  <path class="st0" d="M15.5,43.7c0-3.4-1.9-5.2-5.2-5.2c0,0,0-23.4,0-23.3c3.4,0,5.2-2.2,5.2-5.2c0,0,47.8,0,47.8,0
                      c-5.6,2.5-9.6,8.7-9.6,16.8c0,8.1,4,14.4,9.6,16.8C63.4,43.7,15.6,43.8,15.5,43.7z M108.5,1.5H1.8v50.8h106.7v-8.6h-36
                      C78,41.2,82.7,35,82.7,26.9c0-8.1-4.7-14.4-10.3-16.8h36L108.5,1.5z"></path>
                </g>
                <g>
                  <g>
                  <path d="M27.3,22.5c0-4-0.5-5.8-2.6-5.8c-2.6,0-2.8,2.5-2.8,9.7c0,8.2,0.3,10.3,3,10.3c2.4,0,2.7-2.7,2.7-7h6.3v1
                        c0,5.9-1.7,10.4-9.7,10.4c-8.3,0-8.9-6.2-8.9-14.5c0-7.1,0.4-14.1,9.6-14.1c5.7,0,8.8,2.5,8.8,9v1.2H27.3z"></path>
                  <path d="M40,13h8.1l6.9,27.5h-6.7l-1-5.2h-6.6l-1,5.2h-6.7L40,13z M43.9,18L43.9,18l-2.4,12.3h4.7L43.9,18z"></path>
                  </g>
                </g>
                <g>
                  <path d="M83.9,13h6.5v10.3h5.2V13h6.5v27.5h-6.5V28.7h-5.2v11.8h-6.5V13z"></path>
                  <path d="M105.8,13h13.7v2.1h-11.2v10h10.5v2.1h-10.5v13.3h-2.5V13z"></path>
                  <path d="M129.6,12.5c5.6,0,8.8,4.4,8.8,14.2c0,9.9-3.2,14.2-8.8,14.2c-5.6,0-8.8-4.4-8.8-14.2C120.8,16.9,124,12.5,129.6,12.5z
                      M129.6,38.9c3.9,0,6.3-3.2,6.3-12.2c0-8.9-2.4-12.2-6.3-12.2c-3.9,0-6.3,3.2-6.3,12.2C123.3,35.7,125.7,38.9,129.6,38.9z"></path>
                  <path d="M141.4,13h8.2c4.6,0,7.1,2.6,7.1,6.9c0,3.3-1.3,6.3-5,7v0.1c3.4,0.3,4.6,2.3,4.7,6.5l0.1,3c0,1.5,0.2,3,1.2,4h-2.9
                      c-0.6-1-0.7-2.4-0.7-3.9l-0.1-2.3c-0.2-4.9-1-6.4-5.5-6.4h-4.7v12.6h-2.5V13z M143.9,25.9h4.2c3.9,0,6.2-1.8,6.2-5.4
                      c0-3.4-1.4-5.4-5.9-5.4h-4.5V25.9z"></path>
                  <path d="M171,22.5c0-4-0.5-5.8-2.6-5.8c-2.6,0-2.8,2.5-2.8,9.7c0,8.2,0.3,10.3,3,10.3c2.4,0,2.7-2.7,2.7-7h6.2v1
                      c0,5.9-1.7,10.4-9.7,10.4c-8.3,0-9-6.2-9-14.5c0-7.1,0.4-14.1,9.6-14.1c5.7,0,8.8,2.5,8.8,9v1.2H171z"></path>
                  <path d="M184.1,13h8.1l6.9,27.5h-6.7l-1-5.2h-6.6l-1,5.2h-6.7L184.1,13z M188.1,18L188.1,18l-2.4,12.3h4.7L188.1,18z"></path>
                  <path d="M200.2,13h10.9c5.5,0,7.4,3.4,7.4,7.2c0,4-1.6,6-4.6,6.7v0.1c4.1,0.6,4.4,3.2,4.4,6.9c0.1,5.4,0.3,6,1.2,6.4v0.3h-7
                      c-0.5-0.9-0.7-2.5-0.7-5.6c0-4.8-0.7-5.8-2.7-5.8h-2.5v11.4h-6.5V13z M206.7,24.6h2c2.6,0,3.3-2,3.3-3.6c0-2.1-0.8-3.5-3.4-3.5
                      h-2V24.6z"></path>
                  <path d="M226.1,32.1v1c0,2.1,0.6,3.7,2.8,3.7c2.3,0,2.9-1.7,2.9-3.3c0-5.9-11.8-2.6-11.8-12.9c0-4.4,2.4-8.1,9-8.1
                      c6.5,0,8.8,3.3,8.8,7.5v0.7h-6.3c0-1.3-0.2-2.3-0.5-2.9c-0.4-0.7-1-1-2-1c-1.6,0-2.6,1-2.6,3c0,5.8,11.8,2.9,11.8,12.6
                      c0,6.3-3.5,8.8-9.4,8.8c-4.7,0-9.1-1.4-9.1-7.2v-1.8H226.1z"></path>
                  <path d="M239.1,36.4h3.5v4.1h-3.5V36.4z"></path>
                  <path d="M259.6,31.2c-0.3,6.3-3.2,9.8-8.2,9.8c-5.6,0-8.8-4.4-8.8-14.2c0-9.9,3.2-14.2,8.8-14.2c5.6,0,7.9,4,7.9,8.5h-2.5
                      c0-3.7-1.9-6.4-5.4-6.4c-3.9,0-6.3,3.2-6.3,12.2c0,8.9,2.4,12.2,6.3,12.2c3.5,0,5.4-3,5.7-7.7H259.6z"></path>
                  <path d="M270.3,12.5c5.6,0,8.8,4.4,8.8,14.2c0,9.9-3.2,14.2-8.8,14.2c-5.6,0-8.8-4.4-8.8-14.2C261.5,16.9,264.6,12.5,270.3,12.5z
                      M270.3,38.9c3.9,0,6.3-3.2,6.3-12.2c0-8.9-2.4-12.2-6.3-12.2c-3.9,0-6.3,3.2-6.3,12.2C264,35.7,266.3,38.9,270.3,38.9z"></path>
                  <path d="M282.1,13h4.3l6.6,24.5h0.1l6.6-24.5h4.1v27.5h-2.5V15.3h-0.1l-7.1,25.2h-2.3l-7.1-25.2h-0.1v25.2h-2.5V13z"></path>
                </g>
                <g>
                  <path class="st1" d="M66.8,41.4c-4.3-0.2-8.1-1.9-8.1-7.2v-1.8h6.7v0.9c0,2.1,0.6,3.6,3,3.6c2.4,0,3.2-1.7,3.2-3.1
                      c0-6-12.7-2.7-12.7-13c0-4.2,2.2-7.6,8-8.1V9.9H70v2.8c5.8,0.4,7.9,3.5,7.9,7.5v0.7h-6.7c0-1.2-0.2-2.2-0.6-2.8
                      c-0.4-0.6-1.1-0.9-2.1-0.9c-1.7,0-2.8,0.9-2.8,2.8c0,5.8,12.7,2.9,12.7,12.6c0,5.8-3.1,8.4-8.5,8.8V44h-3.2V41.4z"></path>
                </g>
                </g>
              </g>
              <g>
                <path d="M122.6,50.2h1.7l-0.4,1.6h0c1.1-1.4,2.1-1.8,3.6-1.8c2.8,0,4.3,1.8,4.3,4.5c0,3.3-2.2,6.9-6,6.9c-1.3,0-3-0.5-3.4-1.9h0
                  l-1.2,5.8h-1.8L122.6,50.2z M127.2,51.5c-2.7,0-4.2,3.1-4.2,5.4c0,1.6,1,2.8,2.7,2.8c2.8,0,4.3-2.9,4.3-5.3
                  C130,52.6,129.2,51.5,127.2,51.5z"></path>
                <path d="M139.1,49.9c2.9,0,4.5,1.6,4.5,4.5c0,3.5-2.2,6.9-6,6.9c-2.9,0-4.6-1.9-4.6-4.5C133,53.2,135.3,49.9,139.1,49.9z
                  M137.8,59.7c2.6,0,4-3,4-5.1c0-1.7-0.9-3.1-2.9-3.1c-2.7,0-4.2,3-4.2,5.2C134.8,58.5,135.8,59.7,137.8,59.7z"></path>
                <path d="M154.6,61h-1.9l-0.5-8.4h0l-3.9,8.4h-1.9l-1.3-10.9h1.9l0.7,8.6h0l3.9-8.6h2l0.5,8.6h0l4.1-8.6h1.9L154.6,61z"></path>
                <path d="M161.6,56.1c0,0.3-0.1,0.6-0.1,0.9c0,1.7,1.4,2.6,2.8,2.6c1.6,0,2.6-0.7,3.1-2.1h1.8c-0.6,2.4-2.5,3.7-4.9,3.7
                  c-3.6,0-4.6-2.5-4.6-4.4c0-4.2,2.6-7,5.6-7c3.2,0,4.6,1.7,4.6,4.8c0,0.6-0.1,1.1-0.2,1.4H161.6z M168.2,54.6
                  c0.1-1.5-0.6-3.1-2.5-3.1c-2.1,0-3.2,1.4-3.8,3.1H168.2z"></path>
                <path d="M172.9,50.2h1.7l-0.5,2.3h0c0.8-1.5,2.1-2.6,3.9-2.6c0.2,0,0.4,0,0.6,0l-0.4,1.9c-0.2,0-0.4,0-0.5,0c-0.4,0-0.7,0-1.1,0.1
                  c-1,0.3-1.7,0.9-2.3,1.8c-0.5,0.7-0.7,1.7-0.9,2.5l-1,4.8h-1.8L172.9,50.2z"></path>
                <path d="M179.6,56.1c0,0.3-0.1,0.6-0.1,0.9c0,1.7,1.4,2.6,2.8,2.6c1.6,0,2.6-0.7,3.1-2.1h1.8c-0.6,2.4-2.5,3.7-4.9,3.7
                  c-3.6,0-4.6-2.5-4.6-4.4c0-4.2,2.6-7,5.6-7c3.2,0,4.6,1.7,4.6,4.8c0,0.6-0.1,1.1-0.2,1.4H179.6z M186.2,54.6
                  c0.1-1.5-0.6-3.1-2.5-3.1c-2.1,0-3.2,1.4-3.8,3.1H186.2z"></path>
                <path d="M198.3,61h-1.7l0.4-1.6h0c-1.1,1.4-2.1,1.8-3.6,1.8c-2.8,0-4.3-1.8-4.3-4.5c0-3.3,2.2-6.9,6-6.9c1.3,0,3,0.5,3.4,1.9h0
                  l1.2-5.8h1.8L198.3,61z M193.6,59.7c2.7,0,4.2-3.1,4.2-5.4c0-1.6-1-2.8-2.7-2.8c-2.8,0-4.3,2.9-4.3,5.3
                  C190.9,58.6,191.7,59.7,193.6,59.7z"></path>
                <path d="M209.6,46h1.8l-1.2,5.5l0,0c0.8-1,2-1.6,3.3-1.6c2.9,0,4.3,1.9,4.3,4.7c0,3.4-2.1,6.7-5.7,6.7c-2,0-3.4-1.2-3.7-2.3h0
                  l-0.4,2h-1.6L209.6,46z M213.6,51.5c-3.1,0-4.4,3.2-4.4,5.5c0,1.7,1.2,2.7,3,2.7c2.6,0,3.9-3,3.9-5.1
                  C216.1,52.9,215.3,51.5,213.6,51.5z"></path>
                <path d="M221.7,62.9c-0.9,1.4-1.7,2.6-3.5,2.6c-0.4,0-0.9-0.1-1.2-0.3l0.3-1.4c0.3,0.2,0.7,0.3,1,0.3c0.8,0,1.3-0.5,1.7-1.2
                  l1.1-1.8l-1.9-10.9h1.9l1.3,8.6h0l4.6-8.6h2L221.7,62.9z"></path>
                <path d="M245,51.4c0.2-1.4-0.6-2.5-2.4-2.5c-3,0-4.1,3.4-4.1,5.8c0,1.9,0.6,3.4,2.8,3.4c1.6,0,2.9-1.1,3.2-2.6h3.9
                  c-0.8,3.8-3.3,5.9-7.6,5.9c-2.4,0-6.1-1.2-6.1-6.8c0-4.8,3-8.9,8-8.9c3.8,0,6.3,1.8,6.3,5.7H245z"></path>
                <path d="M255.8,49.8c3,0,5.1,1.7,5.1,4.8c0,3.9-2.5,6.7-6.4,6.7c-3,0-5.2-1.5-5.2-4.7C249.3,52.7,251.9,49.8,255.8,49.8z
                  M254.6,58.7c2,0,2.8-2.3,2.8-3.9c0-1.4-0.5-2.3-1.8-2.3c-1.9,0-2.7,2.6-2.7,4C252.9,57.7,253.4,58.7,254.6,58.7z"></path>
                <path d="M263.6,50.1h3.5l-0.3,1.3h0c0.8-1,1.8-1.6,3.3-1.6c2.8,0,3.9,2.2,3.9,4.7c0,3.2-1.9,6.8-5.6,6.8c-1.4,0-2.5-0.4-3.2-1.7h0
                  l-1,5.1h-3.6L263.6,50.1z M270.4,54.7c0-1-0.3-2.2-1.9-2.2c-1.9,0-2.7,2.4-2.7,3.9c0,1.2,0.5,2.1,1.8,2.1
                  C269.7,58.6,270.4,56.4,270.4,54.7z"></path>
                <path d="M275.9,53.5c0.6-2.8,2.7-3.7,5.3-3.7c3,0,5,0.7,5,2.9c0,1.4-0.8,4.5-1.1,5.5c-0.2,0.8-0.3,1.4-0.3,2c0,0.4,0.1,0.7,0.1,0.8
                  h-3.5c-0.1-0.5-0.1-0.5-0.1-1h0c-0.7,1-1.7,1.4-3.3,1.4c-2,0-3.5-0.8-3.5-3.1c0-2.9,2.6-3.5,5.4-3.7c1.2-0.1,2.9,0,2.9-1.4
                  c0-0.6-0.4-1-1.5-1c-1.1,0-1.8,0.3-2,1.4H275.9z M279.5,59.2c2.2,0,2.6-2.1,2.7-3.1h0c-0.9,0.8-4.1-0.1-4.1,2
                  C278.1,58.9,278.8,59.2,279.5,59.2z"></path>
                <path d="M289,50.1h3.5l-0.4,1.8h0c0.7-1.3,2-2.1,3.4-2.1c0.5,0,0.8,0,1.2,0.2l-0.7,3.1c-0.5-0.1-0.9-0.2-1.6-0.2
                  c-2,0-2.7,1.2-3.1,3.1l-1,5h-3.6L289,50.1z"></path>
                <path d="M302.5,50.1h2.2l-0.5,2.3H302l-0.9,4.1c-0.1,0.5-0.2,0.9-0.2,1.3c0,0.5,0.5,0.6,1.1,0.6c0.4,0,0.7,0,1.1-0.1l-0.5,2.7
                  c-0.7,0-1.4,0.1-2.1,0.1c-1.7,0-3.4-0.2-3.4-1.9c0-0.8,0.1-1.6,0.4-2.9l0.8-3.9h-1.8l0.5-2.3h1.8l0.7-3.3h3.6L302.5,50.1z"></path>
              </g>
            </svg>
          </div>
          <div class="brand-logo brand-right" aria-label="Instaquote logo">
            <svg xmlns="http://www.w3.org/2000/svg" width="186" height="33" viewBox="0 0 186 33" fill="none">
              <path d="M102.877 6.12562C105.334 5.8589 107.279 6.96193 108.891 8.67913C108.93 8.19754 108.977 7.09698 109.222 6.72103C109.88 6.37973 113.141 6.51652 114.226 6.46426C114.119 8.53445 113.124 13.0018 112.738 15.1644L109.701 32.6458L104.5 32.6454L104.709 31.2043C105.058 29.4748 105.759 24.3443 106.235 23.0972C101.243 26.6923 93.8525 25.0815 93.0871 18.3402C92.751 15.2757 93.6599 12.2045 95.6098 9.81647C97.5361 7.42322 99.8806 6.45258 102.877 6.12562ZM103.019 21.0213C109.441 19.6264 109.835 9.43982 102.785 10.3057C96.3783 11.5937 95.7184 21.6441 103.019 21.0213Z" fill="#13AD4C"/>
              <path d="M105.813 12.9141C106.362 12.9513 106.729 13.2162 106.786 13.7697C106.511 14.6629 102.812 18.4922 101.971 19.2957C101.26 18.7072 100.915 18.1588 100.391 17.4202C99.92 16.8001 99.1638 16.0271 99.6782 15.2453C100.79 14.934 101.582 16.3978 102.106 17.1886C102.653 16.1012 104.881 13.8356 105.813 12.9141Z" fill="#13AD4C"/>
              <path d="M81.5765 6.12836C83.9095 5.99547 85.6892 6.53812 87.0827 8.4586L87.289 6.50891C89.0114 6.50891 90.8254 6.53678 92.5407 6.47879C91.7681 12.2938 90.2771 18.5417 89.544 24.3515C88.0536 24.4614 85.8934 24.402 84.3442 24.4236C84.3836 24.0531 84.5036 23.5091 84.5749 23.1295C84.6515 23.0017 84.6328 22.9274 84.6276 22.7783C84.2597 22.7846 82.9892 23.9479 82.4917 24.1512C80.2515 25.0669 77.0618 24.9826 75.1492 23.3579C71.2016 20.0048 72.4166 12.7642 75.4279 9.18979C77.0902 7.21274 79.056 6.35296 81.5765 6.12836ZM81.6504 20.4593C83.1963 20.0751 84.129 19.5561 84.9538 18.1434C86.4885 15.5147 86.8984 10.6917 82.6887 10.5236C81.2315 10.7013 80.5088 11.038 79.5587 12.1831C77.4991 14.6652 77.0331 20.6201 81.6504 20.4593Z" fill="#052450"/>
              <path d="M144.427 6.12934C157.313 5.57686 155.872 24.0389 143.951 24.7273C141.69 24.9153 139.167 24.5065 137.363 23.0436C132.543 19.1347 134.552 10.7768 139.324 7.72696C140.918 6.70878 142.567 6.32085 144.427 6.12934ZM143.375 20.5569C149.143 19.791 149.78 10.4616 144.853 10.541C143.919 10.6122 143.598 10.6289 142.731 11.0804C139.823 12.5961 138.437 19.1967 142.329 20.3571C142.572 20.4298 143.096 20.518 143.375 20.5569Z" fill="#13AD4C"/>
              <path d="M177.459 6.1308C180.848 5.92566 184.099 7.1788 185.368 10.5407C186.182 12.6932 186.05 14.5039 185.847 16.7458C181.421 16.7211 176.995 16.7256 172.569 16.7593C172.876 19.69 174.235 21.5115 177.584 20.6488C178.458 20.4237 179.33 19.6078 180.003 19.0151C181.543 19.0327 183.151 18.9508 184.692 19.0284C184.935 19.0406 184.881 19.0411 185.029 19.2254C184.036 22.608 181.278 24.1752 177.791 24.7113C168.003 26.216 164.685 17.0224 169.99 9.83262C171.714 7.49592 174.457 6.41349 177.459 6.1308ZM173.266 13.7478C174.11 13.6029 175.819 13.6557 176.747 13.6621C177.516 13.67 180.202 13.7592 180.838 13.574C181.087 13.3234 181.201 13.1438 181.08 12.7776C180.562 11.2047 179.256 10.0642 177.583 10.2212C175.033 10.492 174.248 11.5261 173.266 13.7478Z" fill="#13AD4C"/>
              <path d="M128.824 6.45692C130.425 6.50631 132.569 6.55662 134.143 6.42188C133.956 7.17816 133.843 8.05659 133.729 8.83327C133.348 11.4296 132.692 14.0697 132.416 16.673C132.095 18.8064 131.29 22.4306 131.146 24.4171C129.405 24.517 127.504 24.379 125.709 24.4761C125.82 23.6051 125.959 23.0254 126.166 22.1816C122.22 26.8174 113.768 25.2175 114.963 18.2631C115.616 14.4623 116.062 10.2107 116.943 6.48018C118.373 6.53961 120.686 6.53049 122.105 6.46665C122.254 6.53643 122.238 6.70632 122.218 6.83634C121.644 10.4639 120.931 14.098 120.481 17.7393C120.409 18.7424 120.834 19.7181 121.727 20.1087C123.226 20.7647 125.696 19.6899 126.379 18.2227C127.878 15.0025 127.611 9.72358 128.805 6.50815L128.824 6.45692Z" fill="#13AD4C"/>
              <path d="M34.5438 6.1209C38.033 5.80818 40.8286 6.89542 41.1452 10.7844C41.3005 12.6927 40.7589 14.2828 40.5032 16.1096C40.1271 18.7977 39.3844 21.6663 39.1862 24.3518C37.5067 24.4547 35.3733 24.4173 33.6636 24.4326C34.1255 22.9651 35.6052 14.4634 35.5812 13.0874C35.5691 12.4015 35.4138 11.812 34.8961 11.331C34.3476 10.8215 33.642 10.6507 32.9083 10.6916C31.6594 10.7612 30.7844 11.4153 29.9694 12.3082C28.6843 14.0959 27.7727 21.7133 27.3048 24.3501C25.522 24.4504 23.722 24.3801 21.9297 24.4419C22.2228 23.201 22.4349 21.4781 22.6631 20.1696L24.2768 10.9659C24.4464 10.0079 24.8024 7.43951 25.1097 6.65412C25.4944 6.38648 29.3814 6.50206 30.1581 6.4868L29.8935 8.60155C31.2296 7.15865 32.6245 6.42542 34.5438 6.1209Z" fill="#052450"/>
              <path d="M16.9079 0.0173171C18.7696 -0.0286893 20.7084 0.0362723 22.5994 0C21.7763 5.10999 20.908 10.2125 19.9947 15.3071C19.52 17.9685 18.7733 21.7473 18.4868 24.3825L12.7095 24.4227C12.8023 23.5092 13.133 22.0213 13.2974 21.0604C13.6634 18.8206 14.0454 16.5835 14.4433 14.3491L5.00341 14.3693C3.87691 14.3707 1.08781 14.444 0.128939 14.3004L0.000243429 14.0603C-0.0286517 12.2634 2.52211 12.6816 3.77793 12.7016L14.7908 12.701C14.8254 11.8644 14.9891 11.0942 15.2257 10.2951C14.119 10.3202 3.15688 10.443 2.82285 10.2873C2.60644 10.1863 2.60327 10.1026 2.53308 9.89055C2.62314 9.34401 2.86168 8.94348 3.45137 8.8902C4.84479 8.76406 6.29467 8.81058 7.6924 8.81437L15.4846 8.8403C15.5542 7.92212 15.6198 7.3226 15.7699 6.40811C14.6459 6.43885 6.07816 6.53455 5.73142 6.26701C5.71954 6.16895 5.7098 6.071 5.71195 5.97212C5.71943 5.63573 5.901 5.31779 6.1462 5.09564C6.8113 4.49305 14.7341 4.76417 16.1099 4.82473C16.2529 3.70828 16.6394 1.02526 16.9079 0.0173171Z" fill="#052450"/>
              <path d="M50.9796 6.13354C52.8638 6.04593 55.6138 6.28478 57.1609 7.47766C58.5228 8.52772 58.7838 9.61568 59.0125 11.2069C57.5107 11.5601 55.8312 11.7039 54.2783 12.0389C54.2446 11.8905 54.2064 11.7431 54.1635 11.5971C53.5298 9.48022 51.1146 9.85545 49.4867 10.377C49.1882 10.6509 48.5983 11.3808 48.7332 11.7704C49.3211 13.4689 52.5457 13.4004 54.017 14.0251C55.0852 14.4787 55.8295 14.5534 56.7101 15.3385C58.6978 17.0321 58.4846 20.4687 56.8033 22.3198C54.8343 24.4879 52.565 24.6298 49.8461 24.8346C45.7494 24.8512 42.4668 24.2228 41.9395 19.6167C43.1173 19.2965 45.5276 18.9708 46.79 18.8008C47.0807 20.6988 48.1286 21.0522 49.9129 21.106C51.0326 21.1397 52.9149 20.5977 52.9757 19.2679C52.9387 18.6511 52.1198 18.0166 51.6276 17.8519C48.5181 16.8118 43.7875 16.9057 43.5008 12.6479C43.3871 11.1161 43.9012 9.60379 44.9254 8.45886C46.4672 6.74279 48.7792 6.25045 50.9796 6.13354Z" fill="#052450"/>
              <path d="M159.336 1.07188C161.083 1.07669 162.831 1.06829 164.578 1.04688C164.352 2.64911 163.859 4.88118 163.502 6.487C164.685 6.51692 166.376 6.51958 167.53 6.40882C167.317 7.83287 167.088 9.25456 166.844 10.6736C165.556 10.6089 164.091 10.7317 162.878 10.6061C162.355 13.057 162.013 15.8299 161.63 18.3175C161.256 20.7399 163.916 20.2718 165.534 20.1973C165.331 21.1065 165.337 21.7697 165.059 22.8474C165.054 23.3447 164.94 23.8657 164.85 24.3579C160.695 25.1649 154.924 24.2819 156.182 18.6645C156.723 16.252 156.846 12.888 157.622 10.6342C157.129 10.6375 155.134 10.707 154.833 10.4955C154.795 9.65427 155.24 7.43121 155.558 6.68179C155.974 6.30789 157.631 6.49008 158.289 6.51149C158.51 4.98785 158.989 2.57052 159.336 1.07188Z" fill="#13AD4C"/>
              <path d="M64.7843 1.4052C65.8748 1.49558 68.7601 1.40776 69.8861 1.36719C69.6583 3.05703 69.3079 4.77627 69.0647 6.50197L72.9383 6.48773C72.7625 7.79947 72.4766 9.30611 72.2668 10.6299C70.9229 10.6319 69.5791 10.641 68.2354 10.6574C67.9155 13.3233 67.3118 15.8669 67.0246 18.5131C66.7862 20.711 69.5101 20.2695 70.8969 20.2196C70.8429 21.045 70.5553 22.5665 70.4157 23.4353C70.3877 23.7881 70.3901 23.9127 70.249 24.2352C69.2474 24.7812 65.7514 24.5234 64.6203 24.2069C61.4856 23.3848 61.2092 20.3872 61.8251 17.6819C62.3315 15.4573 62.4373 12.7984 63.0911 10.6224C62.0747 10.6654 61.3091 10.5946 60.2217 10.6955C60.3841 9.31451 60.6559 7.87294 60.8938 6.49654C61.7816 6.48015 62.8214 6.51857 63.7204 6.53005C64.0052 5.01952 64.3544 2.82812 64.7843 1.4052Z" fill="#052450"/>
            </svg>
          </div>
        </div>
        <div id="stepHeader" class="step-header">Step 1 of 6</div>
        <div class="progress-wrap" aria-label="Form progress">
          <div class="progress-track"><div id="progressFill" class="progress-fill" style="width: 17%;"></div></div>
          <div id="progressText" class="progress-text">17% complete</div>
        </div>

        <div class="step" data-step="1">
          <div class="grid">
            <div class="field"><label for="year">Year</label><input id="year" value="" /></div>
            <div class="field"><label for="make">Make</label><input id="make" value="" /></div>
            <div class="field"><label for="model">Model</label><input id="model" value="" /></div>
            <div class="field"><label for="trim">Trim</label><input id="trim" value="" /></div>
          </div>
        </div>

        <div class="step hidden" data-step="2">
          <div class="grid">
            <div class="field">
              <label for="titleType">Title Type</label>
              <div class="choice-group cols-4" data-field="titleType" role="group" aria-label="Title Type">
                <button type="button" class="choice-btn" data-value="clean" aria-pressed="false">Clean</button>
                <button type="button" class="choice-btn" data-value="salvage" aria-pressed="false">Salvage</button>
                <button type="button" class="choice-btn" data-value="rebuilt" aria-pressed="false">Rebuilt</button>
                <button type="button" class="choice-btn" data-value="no_title" aria-pressed="false">No Title</button>
              </div>
              <select id="titleType" class="hidden"><option value="" selected>Select</option><option>clean</option><option>salvage</option><option>rebuilt</option><option>no_title</option></select>
            </div>
            <div class="field">
              <label for="keysAvailable">Keys Available</label>
              <div class="choice-group" data-field="keysAvailable" role="group" aria-label="Keys Available">
                <button type="button" class="choice-btn" data-value="yes" aria-pressed="false">Yes</button>
                <button type="button" class="choice-btn" data-value="no" aria-pressed="false">No</button>
              </div>
              <select id="keysAvailable" class="hidden"><option value="" selected>Select</option><option>yes</option><option>no</option></select>
            </div>
          </div>
        </div>

        <div class="step hidden" data-step="3">
          <div class="grid">
            <div class="field"><label for="zipCode">ZIP</label><input id="zipCode" value="" /></div>
            <div class="field"><label for="mileage">Mileage</label><input id="mileage" value="" /></div>
          </div>
        </div>

        <div class="step hidden" data-step="4">
          <div class="grid">
            <div class="field full-width">
              <label for="startsDrives">Starts and Drives</label>
              <div class="choice-group cols-3" data-field="startsDrives" role="group" aria-label="Starts and Drives">
                <button type="button" class="choice-btn small-text" data-value="starts_and_drives" aria-pressed="false">Starts And Drives</button>
                <button type="button" class="choice-btn small-text" data-value="starts_no_drive" aria-pressed="false">Starts But Does Not Drive</button>
                <button type="button" class="choice-btn small-text" data-value="no_start" aria-pressed="false">Does Not Start</button>
              </div>
              <select id="startsDrives" class="hidden"><option value="" selected>Select</option><option>starts_and_drives</option><option>starts_no_drive</option><option>no_start</option></select>
            </div>
          </div>
          <div id="missingPartsWrap" class="field dynamic-followup hidden">
            <label for="missingReplacedParts">Any missing or replaced parts?</label>
            <div class="choice-group" data-field="missingReplacedParts" role="group" aria-label="Missing or replaced parts">
              <button type="button" class="choice-btn" data-value="yes" aria-pressed="false">Yes</button>
              <button type="button" class="choice-btn" data-value="no" aria-pressed="false">No</button>
            </div>
            <select id="missingReplacedParts" class="hidden"><option value="" selected>Select</option><option>yes</option><option>no</option></select>
          </div>
        </div>

        <div class="step hidden" data-step="5">
          <div class="grid">
            <div class="field">
              <label for="hasDamage">Damage</label>
              <div class="choice-group" data-field="hasDamage" role="group" aria-label="Damage">
                <button type="button" class="choice-btn" data-value="yes" aria-pressed="false">Yes</button>
                <button type="button" class="choice-btn" data-value="no" aria-pressed="false">No</button>
              </div>
              <select id="hasDamage" class="hidden"><option value="" selected>Select</option><option>yes</option><option>no</option></select>
            </div>
          </div>
          <div id="mechanicalDamageWrap" class="field dynamic-followup hidden">
            <label for="mechanicalDamage">Mechanical Damage?</label>
            <div class="choice-group" data-field="mechanicalDamage" role="group" aria-label="Mechanical Damage">
              <button type="button" class="choice-btn" data-value="yes" aria-pressed="false">Yes</button>
              <button type="button" class="choice-btn" data-value="no" aria-pressed="false">No</button>
            </div>
            <select id="mechanicalDamage" class="hidden"><option value="" selected>Select</option><option>yes</option><option>no</option></select>
          </div>
          <div id="damageAreaWrap" class="field hidden">
            <label>Damage area? (select all that apply)</label>
            <div id="damageMap" class="damage-map" role="group" aria-label="Select damaged areas">
              <button type="button" class="damage-zone zone-front" data-zone="Front">Front</button>
              <button type="button" class="damage-zone zone-rear" data-zone="Rear">Rear</button>
              <button type="button" class="damage-zone zone-top" data-zone="Top">Top</button>
              <button type="button" class="damage-zone zone-side-left" data-zone="Side">Left</button>
              <button type="button" class="damage-zone zone-side-right" data-zone="Side">Right</button>
            </div>
            <div class="damage-hint">Tap the highlighted zones to mark damaged areas.</div>
          </div>
        </div>

        <div class="step hidden" data-step="6">
          <div class="grid">
            <div class="field"><label for="phoneNumber">Phone Number</label><input id="phoneNumber" value="" /></div>
          </div>
        </div>

        <select id="outstandingLoan" class="hidden"><option value="no" selected>no</option><option>yes</option></select>

        <div class="step-actions">
          <button id="prevBtn" type="button" class="btn-secondary hidden">Back</button>
          <button id="nextBtn" type="button">Next</button>
          <button id="quoteBtn" type="button" class="hidden">Get Quote</button>
        </div>
        <div id="status" class="hidden"></div>
      </div>
    </div>
    <script>
      function byId(id) { return document.getElementById(id); }
      var currentStep = 1;
      var totalSteps = 6;
      var fullOfferMode = false;

      function setStatus(text) {
        var el = byId("status");
        if (!el) {
          return;
        }
        el.textContent = text;
      }

      function showStatus(text) {
        var el = byId("status");
        if (!el) {
          return;
        }
        el.classList.remove("hidden");
        setStatus(text);
      }

      function hideStatus() {
        var el = byId("status");
        if (!el) {
          return;
        }
        el.textContent = "";
        el.classList.add("hidden");
      }

      function setFullOfferMode(enabled) {
        if (fullOfferMode === enabled) {
          return;
        }
        fullOfferMode = enabled;
        var shell = byId("widgetShell");
        if (!shell) {
          return;
        }
        if (enabled) {
          shell.classList.add("full-offer-mode");
        } else {
          shell.classList.remove("full-offer-mode");
        }
      }

      function renderOffer(data) {
        var status = byId("status");
        if (!status) {
          return;
        }

        showStatus("");
        setFullOfferMode(true);

        while (status.firstChild) {
          status.removeChild(status.firstChild);
        }

        var wrap = document.createElement("div");
        wrap.className = "offer-wrap";

        var label = document.createElement("div");
        label.className = "offer-label";
        label.textContent = "Your Instant Offer";

        var price = document.createElement("div");
        price.className = "offer-price";
        price.textContent = "$" + String(data.firmOffer || "");

        var accept = document.createElement("a");
        accept.className = "accept-btn";
        accept.textContent = "Accept Offer";
        accept.target = "_blank";
        accept.rel = "noopener";
        accept.href = String(data.acceptUrl || "https://www.cashforcars.com/instaquote/");

        wrap.appendChild(label);
        wrap.appendChild(price);
        wrap.appendChild(accept);
        status.appendChild(wrap);
      }

      function prefillFromToolInput() {
        var input = (window.openai && window.openai.toolInput) ? window.openai.toolInput : null;
        if (!input) {
          return;
        }

        function parseFromUtterance(utterance) {
          if (!utterance) {
            return {};
          }

          var text = String(utterance);
          var lower = text.toLowerCase();
          var parsed = {};

          var yearMatch = lower.match(/\b(19\d{2}|20\d{2})\b/);
          if (yearMatch) {
            parsed.year = Number(yearMatch[1]);
          }

          var mileageMatch = lower.match(/\b(\d{1,3}(?:,\d{3})+|\d{4,6})\b\s*(?:miles|mile|mi|odometer|mileage)?/);
          if (mileageMatch) {
            var numeric = mileageMatch[1].replace(/,/g, "");
            if (numeric.length >= 4) {
              parsed.mileage = Number(numeric);
            }
          }

          var makes = [
            "acura","audi","bmw","buick","cadillac","chevrolet","chrysler","dodge","ford","gmc","honda","hyundai","infiniti","jeep","kia","lexus","lincoln","mazda","mercedes","mercedes-benz","mini","mitsubishi","nissan","ram","subaru","tesla","toyota","volkswagen","volvo"
          ];
          var makeFound = "";
          for (var m = 0; m < makes.length; m++) {
            var mk = makes[m];
            var re = new RegExp("\\b" + mk.replace("-", "[- ]") + "\\b", "i");
            if (re.test(text)) {
              makeFound = mk;
              break;
            }
          }
          if (makeFound) {
            parsed.make = makeFound === "mercedes-benz" ? "Mercedes-Benz" : (makeFound.charAt(0).toUpperCase() + makeFound.slice(1));

            var modelRegex = new RegExp("\\b" + makeFound.replace("-", "[- ]") + "\\s+([a-z0-9-]{1,20})(?:\\s+([a-z0-9-]{1,20}))?", "i");
            var modelMatch = text.match(modelRegex);
            if (modelMatch && modelMatch[1]) {
              var token1 = modelMatch[1];
              var token2 = modelMatch[2] || "";
              var stopWords = ["with", "mileage", "miles", "mile", "odometer", "title", "and", "keys", "loan", "no", "clean", "salvage", "rebuilt"];
              var token1Lower = token1.toLowerCase();
              if (stopWords.indexOf(token1Lower) === -1) {
                parsed.model = token1.toUpperCase() === "A4" ? "A4" : token1.charAt(0).toUpperCase() + token1.slice(1);
                var token2Lower = token2.toLowerCase();
                if (token2 && stopWords.indexOf(token2Lower) === -1 && /^(ex|lx|se|le|xle|sport|premium|limited|touring|platinum|s-line|sline)$/i.test(token2)) {
                  parsed.trim = token2.toUpperCase();
                }
              }
            }
          }

          if (/\bclean\s+title\b/i.test(text) || /\bclean\b/i.test(text)) {
            parsed.titleType = "clean";
          } else if (/\bsalvage\s+title\b/i.test(text) || /\bsalvage\b/i.test(text)) {
            parsed.titleType = "salvage";
          } else if (/\brebuilt\s+title\b/i.test(text) || /\brebuilt\b/i.test(text)) {
            parsed.titleType = "rebuilt";
          } else if (/\bno\s+title\b/i.test(text)) {
            parsed.titleType = "no_title";
          }

          if (/\bno\s+outstanding\s+loan\b/i.test(text) || /\bno\s+loan\b/i.test(text)) {
            parsed.outstandingLoan = "no";
          } else if (/\boutstanding\s+loan\b/i.test(text) || /\bhas\s+loan\b/i.test(text)) {
            parsed.outstandingLoan = "yes";
          }

          if (/\b(i\s+have\s+)?(my\s+)?keys\b/i.test(text) || /\bkeys\s+available\b/i.test(text)) {
            parsed.keysAvailable = "yes";
          } else if (/\bno\s+keys\b/i.test(text) || /\bwithout\s+keys\b/i.test(text) || /\bkeys\s+not\s+available\b/i.test(text)) {
            parsed.keysAvailable = "no";
          }

          if (/\bstarts?\s+but\s+does\s+not\s+drive\b/i.test(text) || /\bstarts?_no_drive\b/i.test(text)) {
            parsed.startsDrives = "starts_no_drive";
          } else if (/\bdoes\s+not\s+start\b/i.test(text) || /\bno\s+start\b/i.test(text) || /\bno_start\b/i.test(text)) {
            parsed.startsDrives = "no_start";
          } else if (/\bstarts?\s+and\s+drives?\b/i.test(text)) {
            parsed.startsDrives = "starts_and_drives";
          }

          if (/\bno\s+damage\b/i.test(text)) {
            parsed.hasDamage = "no";
          } else if (/\bdamage\b/i.test(text)) {
            parsed.hasDamage = "yes";
          }

          return parsed;
        }

        var parsedInput = parseFromUtterance(input.utterance);
        var mergedInput = {};
        for (var keyA in input) {
          mergedInput[keyA] = input[keyA];
        }
        for (var keyB in parsedInput) {
          mergedInput[keyB] = parsedInput[keyB];
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
          var value = mergedInput[key];
          if (value === undefined || value === null || value === "") {
            continue;
          }
          var el = byId(key);
          if (el) {
            el.value = String(value);
          }
        }

        if (Array.isArray(mergedInput.damageArea)) {
          setDamageAreas(mergedInput.damageArea);
        }

        updateConditionalFields();
      }

      function updateConditionalFields() {
        var startsDrives = byId("startsDrives").value;
        var hasDamage = byId("hasDamage").value;

        var missingPartsWrap = byId("missingPartsWrap");
        if (startsDrives === "starts_no_drive" || startsDrives === "no_start") {
          missingPartsWrap.classList.remove("hidden");
        } else {
          missingPartsWrap.classList.add("hidden");
          byId("missingReplacedParts").value = "";
          syncChoiceButtons("missingReplacedParts");
          clearFieldError(byId("missingReplacedParts"));
        }

        var damageAreaWrap = byId("damageAreaWrap");
        var mechanicalDamageWrap = byId("mechanicalDamageWrap");
        if (hasDamage === "yes") {
          damageAreaWrap.classList.remove("hidden");
          mechanicalDamageWrap.classList.add("hidden");
          byId("mechanicalDamage").value = "";
          syncChoiceButtons("mechanicalDamage");
          clearFieldError(byId("mechanicalDamage"));
        } else if (hasDamage === "no") {
          mechanicalDamageWrap.classList.remove("hidden");
          damageAreaWrap.classList.add("hidden");
          clearDamageAreas();
          var oldDamageAreaError = byId("damageArea-error");
          if (oldDamageAreaError && oldDamageAreaError.parentNode) {
            oldDamageAreaError.parentNode.removeChild(oldDamageAreaError);
          }
        } else {
          damageAreaWrap.classList.add("hidden");
          mechanicalDamageWrap.classList.add("hidden");
        }
      }

      function clearFieldError(el) {
        if (!el) {
          return;
        }
        el.classList.remove("input-error");
        var group = getChoiceGroup(el.id);
        if (group) {
          group.classList.remove("input-error");
        }
        var errorEl = byId(el.id + "-error");
        if (errorEl && errorEl.parentNode) {
          errorEl.parentNode.removeChild(errorEl);
        }
      }

      function setFieldError(el, message) {
        if (!el) {
          return;
        }
        el.classList.add("input-error");
        var group = getChoiceGroup(el.id);
        if (group) {
          group.classList.add("input-error");
        }

        var existing = byId(el.id + "-error");
        if (existing) {
          existing.textContent = message;
          return;
        }

        var errorEl = document.createElement("div");
        errorEl.id = el.id + "-error";
        errorEl.className = "field-error";
        errorEl.textContent = message;
        el.parentNode.appendChild(errorEl);
      }

      function getChoiceGroup(fieldId) {
        return document.querySelector('.choice-group[data-field="' + fieldId + '"]');
      }

      function syncChoiceButtons(fieldId) {
        var group = getChoiceGroup(fieldId);
        var field = byId(fieldId);
        if (!group || !field) {
          return;
        }
        var buttons = group.querySelectorAll(".choice-btn");
        var value = String(field.value || "");
        for (var i = 0; i < buttons.length; i++) {
          var active = buttons[i].getAttribute("data-value") === value;
          buttons[i].classList.toggle("selected", active);
          buttons[i].setAttribute("aria-pressed", active ? "true" : "false");
        }
      }

      function onChoiceButtonClick(event) {
        var btn = event.currentTarget;
        var group = btn && btn.closest(".choice-group");
        if (!btn || !group) {
          return;
        }
        var fieldId = group.getAttribute("data-field");
        var field = byId(fieldId);
        if (!field) {
          return;
        }
        field.value = String(btn.getAttribute("data-value") || "");
        syncChoiceButtons(fieldId);
        clearFieldError(field);
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }

      function getDamageButtons() {
        return document.querySelectorAll("#damageMap .damage-zone");
      }

      function clearDamageAreas() {
        var buttons = getDamageButtons();
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].classList.remove("selected");
          buttons[i].setAttribute("aria-pressed", "false");
        }
      }

      function setDamageAreas(areas) {
        clearDamageAreas();
        if (!Array.isArray(areas)) {
          return;
        }
        var wanted = {};
        for (var i = 0; i < areas.length; i++) {
          wanted[String(areas[i])] = true;
        }
        var buttons = getDamageButtons();
        for (var j = 0; j < buttons.length; j++) {
          var zone = buttons[j].getAttribute("data-zone");
          if (wanted[zone]) {
            buttons[j].classList.add("selected");
            buttons[j].setAttribute("aria-pressed", "true");
          }
        }
      }

      function getDamageAreas() {
        var buttons = getDamageButtons();
        var map = {};
        for (var i = 0; i < buttons.length; i++) {
          if (buttons[i].classList.contains("selected")) {
            map[buttons[i].getAttribute("data-zone")] = true;
          }
        }
        return Object.keys(map);
      }

      function toggleDamageArea(event) {
        var btn = event.currentTarget;
        if (!btn) {
          return;
        }
        var isSelected = btn.classList.contains("selected");
        btn.classList.toggle("selected", !isSelected);
        btn.setAttribute("aria-pressed", isSelected ? "false" : "true");

        var oldDamageAreaError = byId("damageArea-error");
        if (oldDamageAreaError && oldDamageAreaError.parentNode) {
          oldDamageAreaError.parentNode.removeChild(oldDamageAreaError);
        }
      }

      function validateRequiredFields() {
        var requiredByStep = {
          1: ["year", "make", "model", "trim"],
          2: ["titleType", "keysAvailable"],
          3: ["zipCode", "mileage"],
          4: ["startsDrives"],
          5: ["hasDamage"],
          6: ["phoneNumber"]
        };

        var requiredIds = requiredByStep[currentStep] || [];

        var hasError = false;
        for (var i = 0; i < requiredIds.length; i++) {
          var id = requiredIds[i];
          var el = byId(id);
          var value = el ? String(el.value || "").trim() : "";
          clearFieldError(el);

          if (!value) {
            setFieldError(el, "This field is required.");
            hasError = true;
          }
        }

        if (currentStep === 4) {
          var startsDrives = byId("startsDrives").value;
          if ((startsDrives === "starts_no_drive" || startsDrives === "no_start") && !String(byId("missingReplacedParts").value || "").trim()) {
            setFieldError(byId("missingReplacedParts"), "This field is required.");
            hasError = true;
          }
        }

        if (currentStep === 5) {
          var hasDamage = byId("hasDamage").value;
          if (hasDamage === "yes") {
            var anySelected = getDamageAreas().length > 0;
            var oldDamageAreaError = byId("damageArea-error");
            if (oldDamageAreaError && oldDamageAreaError.parentNode) {
              oldDamageAreaError.parentNode.removeChild(oldDamageAreaError);
            }
            if (!anySelected) {
              var damageAreaError = document.createElement("div");
              damageAreaError.id = "damageArea-error";
              damageAreaError.className = "field-error";
              damageAreaError.textContent = "Select at least one damage area.";
              byId("damageAreaWrap").appendChild(damageAreaError);
              hasError = true;
            }
          } else if (hasDamage === "no") {
            if (!String(byId("mechanicalDamage").value || "").trim()) {
              setFieldError(byId("mechanicalDamage"), "This field is required.");
              hasError = true;
            }
          }
        }

        if (hasError) {
          setStatus("Please fill all required fields in this step.");
          return false;
        }

        return true;
      }

      function toPayload() {
        var yearVal = byId("year").value;
        var mileageVal = byId("mileage").value;
        var damageAreas = getDamageAreas();
        return {
          year: yearVal ? Number(yearVal) : "",
          make: byId("make").value,
          model: byId("model").value,
          trim: byId("trim").value,
          titleType: byId("titleType").value,
          zipCode: byId("zipCode").value,
          mileage: mileageVal ? Number(mileageVal) : "",
          startsDrives: byId("startsDrives").value,
          missingReplacedParts: byId("missingReplacedParts").value,
          outstandingLoan: byId("outstandingLoan").value,
          keysAvailable: byId("keysAvailable").value,
          hasDamage: byId("hasDamage").value,
          damageArea: damageAreas,
          mechanicalDamage: byId("mechanicalDamage").value,
          phoneNumber: byId("phoneNumber").value
        };
      }

      function renderStep() {
        if (fullOfferMode) {
          setFullOfferMode(false);
        }
        var steps = document.querySelectorAll(".step");
        for (var i = 0; i < steps.length; i++) {
          var stepNum = Number(steps[i].getAttribute("data-step"));
          if (stepNum === currentStep) {
            steps[i].classList.remove("hidden");
          } else {
            steps[i].classList.add("hidden");
          }
        }

        byId("stepHeader").textContent = "Step " + currentStep + " of " + totalSteps;
        byId("prevBtn").classList.toggle("hidden", currentStep === 1);
        byId("nextBtn").classList.toggle("hidden", currentStep === totalSteps);
        byId("quoteBtn").classList.toggle("hidden", currentStep !== totalSteps);

        var progressPct = Math.round((currentStep / totalSteps) * 100);
        var progressFill = byId("progressFill");
        var progressText = byId("progressText");
        if (progressFill) {
          progressFill.style.width = String(progressPct) + "%";
        }
        if (progressText) {
          progressText.textContent = String(progressPct) + "% complete";
        }

        hideStatus();
      }

      function goNext() {
        updateConditionalFields();
        if (!validateRequiredFields()) {
          return;
        }
        if (currentStep < totalSteps) {
          currentStep += 1;
          renderStep();
        }
      }

      function goPrev() {
        if (currentStep > 1) {
          currentStep -= 1;
          renderStep();
        }
      }

      function formatResult(data) {
        if (data.eligible === false) {
          return "No instant offer generated. Reason: " + data.reason;
        }
        return "Offer Price: $" + data.firmOffer;
      }

      async function getQuote() {
        try {
          if (!window.openai || typeof window.openai.callTool !== "function") {
            setStatus("Bridge unavailable in this host.");
            return;
          }

          currentStep = totalSteps;
          renderStep();
          updateConditionalFields();
          if (!validateRequiredFields()) {
            return;
          }

          showStatus("Calculating...");
          var result = await window.openai.callTool("submit_vehicle_quote_from_ui", toPayload());

          if (result && result.structuredContent && result.structuredContent.ok) {
            if (result.structuredContent.eligible === false) {
              showStatus(formatResult(result.structuredContent));
            } else {
              renderOffer(result.structuredContent);
            }
            return;
          }

          if (result && result.content && result.content[0] && result.content[0].text) {
            showStatus(result.content[0].text);
            return;
          }

          showStatus("Unexpected response from tool.");
        } catch (error) {
          showStatus(String(error));
        }
      }

      (function initWidget() {
        try {
          var quoteBtn = byId("quoteBtn");
          var prevBtn = byId("prevBtn");
          var nextBtn = byId("nextBtn");
          if (quoteBtn) {
            quoteBtn.addEventListener("click", getQuote);
          }
          if (prevBtn) {
            prevBtn.addEventListener("click", goPrev);
          }
          if (nextBtn) {
            nextBtn.addEventListener("click", goNext);
          }
          var damageButtons = getDamageButtons();
          for (var i = 0; i < damageButtons.length; i++) {
            damageButtons[i].setAttribute("aria-pressed", "false");
            damageButtons[i].addEventListener("click", toggleDamageArea);
          }

          var choiceButtons = document.querySelectorAll(".choice-group .choice-btn");
          for (var c = 0; c < choiceButtons.length; c++) {
            choiceButtons[c].addEventListener("click", onChoiceButtonClick);
          }

          byId("startsDrives").addEventListener("change", updateConditionalFields);
          byId("hasDamage").addEventListener("change", updateConditionalFields);

          syncChoiceButtons("titleType");
          syncChoiceButtons("keysAvailable");
          syncChoiceButtons("startsDrives");
          syncChoiceButtons("missingReplacedParts");
          syncChoiceButtons("hasDamage");
          syncChoiceButtons("mechanicalDamage");

          prefillFromToolInput();

          syncChoiceButtons("titleType");
          syncChoiceButtons("keysAvailable");
          syncChoiceButtons("startsDrives");
          syncChoiceButtons("missingReplacedParts");
          syncChoiceButtons("hasDamage");
          syncChoiceButtons("mechanicalDamage");

          renderStep();
          updateConditionalFields();
        } catch (_error) {
          showStatus("Widget loaded in fallback mode.");
        }
      })();
    </script>
  </body>
</html>`;

      return {
        contents: [
          {
            uri: "ui://quote/form.html",
            mimeType: "text/html+skybridge",
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
        utterance: z.string().min(2).optional(),
        year: z.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),
        make: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
        trim: z.string().min(1).optional(),
        titleType: z.enum(["clean", "salvage", "rebuilt", "no_title"]).optional(),
        zipCode: z.string().regex(/^[0-9]{5}$/).optional(),
        mileage: z.number().int().min(0).max(500000).optional(),
        startsDrives: z.enum(["starts_and_drives", "starts_no_drive", "no_start"]).optional(),
        missingReplacedParts: z.enum(["yes", "no"]).optional(),
        outstandingLoan: z.enum(["yes", "no"]).optional(),
        keysAvailable: z.enum(["yes", "no"]).optional(),
        hasDamage: z.enum(["yes", "no"]).optional(),
        damageArea: z.array(z.enum(["Top", "Front", "Rear", "Side"])).optional(),
        mechanicalDamage: z.enum(["yes", "no"]).optional(),
        phoneNumber: z.string().min(10).optional()
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
        missingReplacedParts: z.enum(["yes", "no"]).optional(),
        outstandingLoan: z.enum(["yes", "no"]),
        keysAvailable: z.enum(["yes", "no"]),
        hasDamage: z.enum(["yes", "no"]),
        damageArea: z.array(z.enum(["Top", "Front", "Rear", "Side"])).optional(),
        mechanicalDamage: z.enum(["yes", "no"]).optional(),
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
        missingReplacedParts: z.enum(["yes", "no"]).optional(),
        outstandingLoan: z.enum(["yes", "no"]),
        keysAvailable: z.enum(["yes", "no"]),
        hasDamage: z.enum(["yes", "no"]),
        damageArea: z.array(z.enum(["Top", "Front", "Rear", "Side"])).optional(),
        mechanicalDamage: z.enum(["yes", "no"]).optional(),
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
