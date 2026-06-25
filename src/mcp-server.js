import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import * as z from "zod/v4";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

dotenv.config();

const mcpPort = Number(process.env.PORT || process.env.MCP_PORT || 8788);
const allowedHosts = String(process.env.MCP_ALLOWED_HOSTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const transports = {};

async function requestQuote(args) {
  // Mock response for demonstration
  const body = {
    firmOffer: 3850,
    minOffer: 3500,
    maxOffer: 4200,
    confidence: "High",
    acceptUrl: "https://www.cashforcars.com/instaquote/",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  };

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
      :root {
        --primary: #059669;
        --primary-active: #047857;
        --primary-light: #ecfdf5;
        --primary-ring: rgba(5, 150, 105, 0.2);
        --bg: #f8fafc;
        --card-bg: #ffffff;
        --text-main: #0f172a;
        --text-muted: #64748b;
        --border: #cbd5e1;
        --border-hover: #94a3b8;
        --error: #ef4444;
        --error-bg: #fef2f2;
        --radius: 12px;
        --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        --transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        background: var(--bg);
        color: var(--text-main);
        -webkit-font-smoothing: antialiased;
      }
      .wrap {
        padding: 16px;
        max-width: 760px;
        margin: 0 auto;
      }
      .card {
        background: var(--card-bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 24px;
        box-shadow: 0 8px 32px -8px rgba(5, 150, 105, 0.2), 0 0 0 1px rgba(5, 150, 105, 0.05);
      }
      .trust-badge {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        background: rgba(5, 150, 105, 0.04);
        border: 1px solid var(--primary-ring);
        border-radius: 10px;
        padding: 16px;
        margin-top: 24px;
      }
      .trust-badge img {
        flex-shrink: 0;
        width: 32px;
        height: auto;
      }
      .legal-text {
        font-size: 12px;
        color: var(--text-muted);
        line-height: 1.5;
        text-align: left;
        margin: 0;
      }
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      .hidden {
        display: none !important;
      }
      .brand-row {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border);
      }
      .brand-logo {
        display: flex;
        align-items: center;
      }
      .brand-logo svg {
        max-height: 42px;
        width: auto;
      }
      .wizard-top {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;
      }
      .step-header {
        margin: 0;
        font-size: 15px;
        color: var(--text-muted);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .top-back-btn {
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: var(--text-muted);
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--transition);
        display: flex;
        align-items: center;
        width: auto;
        border: 1px solid var(--border);
      }
      .top-back-btn:hover {
        background: #f1f5f9;
        color: var(--text-main);
      }
      .back-icon {
        margin-right: 6px;
        font-size: 16px;
      }
      .progress-wrap {
        margin-bottom: 24px;
      }
      .progress-track {
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: #e2e8f0;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        width: 20%;
        background: var(--primary);
        transition: width 0.3s ease;
      }
      .progress-text {
        margin-top: 8px;
        font-size: 13px;
        color: var(--text-muted);
        text-align: right;
        font-weight: 500;
      }
      .step {
        animation: fadeIn 0.3s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .field {
        margin-bottom: 16px;
      }
      .field.full-width {
        grid-column: 1 / -1;
      }
      .dynamic-followup {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px dashed var(--border);
      }
      .choice-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 8px;
      }
      .choice-group.cols-3 {
        grid-template-columns: repeat(3, 1fr);
      }
      .choice-group.choice-list {
        display: flex;
        flex-direction: column;
      }
      .choice-group.choice-list .choice-btn {
        text-align: left;
        padding: 16px;
        height: auto;
      }
      .list-title {
        font-weight: 600;
        font-size: 16px;
        color: var(--text-main);
        display: block;
        margin-bottom: 4px;
      }
      .list-desc {
        font-size: 14px;
        color: var(--text-muted);
        font-weight: 400;
        display: block;
        line-height: 1.4;
        white-space: normal;
      }
      .choice-group.choice-list .choice-btn.selected .list-title {
        color: var(--primary);
      }
      .choice-group.cols-4 {
        grid-template-columns: repeat(4, 1fr);
      }
      .step2-grid {
        grid-template-columns: 1fr;
        gap: 20px;
      }
      .choice-btn {
        background: var(--card-bg);
        border: 2px solid var(--border);
        color: var(--text-muted);
        font-weight: 600;
        padding: 14px;
        border-radius: 10px;
        font-size: 14px;
        cursor: pointer;
        transition: var(--transition);
        text-align: center;
      }
      .choice-btn:hover {
        border-color: var(--border-hover);
        color: var(--text-main);
        background: #f8fafc;
      }
      .choice-btn.selected {
        background: var(--primary-light);
        border-color: var(--primary);
        color: var(--primary);
      }
      .choice-group.input-error .choice-btn {
        border-color: var(--error);
        background: var(--error-bg);
      }
      .step-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 32px;
        padding-top: 24px;
        border-top: 1px solid var(--border);
      }
      .step-actions button {
        width: 140px;
        margin-top: 0;
        padding: 12px;
        border-radius: 8px;
        font-size: 15px;
        box-shadow: var(--shadow-sm);
      }
      @media (max-width: 680px) {
        .grid { grid-template-columns: 1fr; }
        .step-actions { flex-direction: column; }
        .step-actions button { width: 100%; }
        .field.full-width { grid-column: auto; }
        .choice-group, .choice-group.cols-3, .choice-group.cols-4 {
          grid-template-columns: 1fr;
        }
        .brand-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
        }
      }
      label {
        display: block;
        font-size: 15px;
        font-weight: 600;
        color: var(--text-main);
        margin-bottom: 8px;
      }
      input, select, button {
        width: 100%;
        box-sizing: border-box;
        border: 2px solid var(--border);
        border-radius: 10px;
        padding: 12px;
        font-size: 15px;
        transition: var(--transition);
        color: var(--text-main);
        background: var(--card-bg);
      }
      input:focus, select:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-ring);
      }
      button {
        border: 0;
        background: var(--primary);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      button:hover {
        background: var(--primary-active);
        color: var(--primary-light)!important;
      }
      #status {
        margin-top: 20px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--bg);
        padding: 16px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .damage-map {
        position: relative;
        width: 100%;
        max-width: 300px;
        height: 380px;
        margin: 16px auto 0;
        background: #f1f5f9 url("https://raw.githubusercontent.com/PrudhviatCopart/gtp-iq-prototype/refs/heads/main/images/damaged_areas_bg.png") center/contain no-repeat;
        background-size: 160px;
        border-radius: 12px;
        border: 1px solid var(--border);
      }
      .damage-zone {
        position: absolute;
        border: 2px dashed var(--border-hover);
        border-radius: 8px;
        background: rgba(241, 245, 249, 0.5);
        color: var(--text-main);
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: var(--transition);
        padding: 0;
      }
      .damage-zone:hover {
        background: rgba(148, 163, 184, 0.2);
        border-color: var(--text-muted);
      }
      .damage-zone.selected {
        background: rgba(239, 68, 68, 0.15);
        border-color: var(--error);
        color: var(--error);
      }
      .zone-front {
        left: 50%;
        transform: translateX(-50%);
        top: 20px;
        width: 170px;
        height: 90px;
      }
      .zone-rear {
        left: 50%;
        transform: translateX(-50%);
        bottom: 20px;
        width: 170px;
        height: 60px;
      }
      .zone-top {
        left: 49%;
        transform: translateX(-50%);
        top: 120px;
        width: 60px;
        height: 170px;
      }
      .zone-side-left {
        left: 45px;
        top: 120px;
        width: 60px;
        height: 170px;
      }
      .zone-side-right {
        right: 50px;
        top: 120px;
        width: 60px;
        height: 170px;
      }
      .damage-hint {
        margin-top: 12px;
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
      }
      .full-offer-mode {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: var(--bg);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .offer-card {
        background: var(--card-bg);
        padding: 40px;
        border-radius: 20px;
        box-shadow: var(--shadow);
        text-align: center;
        width: 100%;
        max-width: 500px;
        margin: 24px auto 0;
      }
      .offer-label {
        font-size: 13px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-weight: 700;
        margin-bottom: 12px;
      }
      .offer-price {
        font-size: 52px;
        line-height: 1;
        font-weight: 800;
        color: var(--text-main);
        margin-bottom: 24px;
      }
      .accept-btn {
        display: inline-block;
        text-decoration: none;
        background: var(--primary);
        color: #ffffff;
        font-weight: 600;
        border-radius: 100px;
        padding: 16px 32px;
        font-size: 16px;
        transition: var(--transition);
      }
      .accept-btn:hover {
        background: var(--primary-active);
        box-shadow: var(--shadow);
      }
      #offerSlot {
        position: relative;
        overflow: hidden;
      }
      .offer-back-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0 0 4px;
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        padding: 8px 12px;
        border-radius: 8px;
        transition: var(--transition);
      }
      .offer-back-btn:hover {
        color: var(--text-main);
        background: #f1f5f9;
      }
      .offer-headline {
        font-size: 18px;
        line-height: 1.4;
        color: var(--text-main);
        margin-bottom: 20px;
      }
      .offer-vehicle {
        font-weight: 800;
        color: var(--primary);
      }
      .offer-benefits {
        max-width: 500px;
        margin: 28px auto 0;
        padding: 28px 24px 4px;
      }
      .benefit-list {
        list-style: none;
        margin: 0 0 28px;
        padding: 0;
      }
      .benefit-item {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 18px;
        font-size: 16px;
        color: var(--text-main);
        text-align: left;
      }
      .benefit-item:last-child {
        margin-bottom: 0;
      }
      .benefit-check {
        flex: 0 0 auto;
        display: inline-flex;
      }
      .offer-tagline {
        text-align: center;
        font-size: 22px;
        font-weight: 800;
        line-height: 1.3;
        color: var(--text-main);
      }
      .confetti-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 5;
      }
      .confetti-piece {
        position: absolute;
        top: -10px;
        width: 8px;
        height: 14px;
        border-radius: 2px;
        opacity: 0.9;
        animation-name: confetti-fall;
        animation-timing-function: ease-in;
        animation-iteration-count: 1;
        animation-fill-mode: forwards;
      }
      @keyframes confetti-fall {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(420px) rotate(720deg); opacity: 0; }
      }
      .input-error {
        border-color: #cf2e2e;
      }
      .field-error {
        margin-top: 4px;
        font-size: 13px;
        color: #b42318;
      }

    
      .tab-navigation {
        display: flex;
        width: 100%;
        background: #f1f5f9;
        padding: 4px;
        border-radius: 12px;
        position: relative;
        margin-bottom: 24px;
        border: 1px solid var(--border);
        box-sizing: border-box;
      }
      .tab-button {
        padding: 10px 24px;
        border-radius: 10px;
        font-weight: 600;
        color: var(--text-muted);
        border: none;
        background: transparent;
        cursor: pointer;
        transition: var(--transition);
        z-index: 2;
        font-size: 14px;
        flex: 1;
        text-align: center;
        margin: 0;
      }
      .tab-button.active {
        color: var(--primary);
      }
      .tab-indicator {
        position: absolute;
        top: 4px;
        left: 4px;
        height: calc(100% - 8px);
        background: #fff;
        border-radius: 10px;
        box-shadow: var(--shadow-sm);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 1;
        width: calc(50% - 4px);
      }
      .tab-content {
        display: none;
        animation: fadeIn 0.3s ease;
      }
      .tab-content.active {
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="brand-row">
          <div class="brand-logo" aria-label="Cashforcars.com logo">
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
          </div>
        <div id="offerSlot" class="hidden"></div>
        <div id="formBody">
        <div class="wizard-top">
          <button id="prevBtn" type="button" class="top-back-btn hidden"><span class="back-icon" aria-hidden="true">&#8592;</span>Back</button>
          <div id="stepHeader" class="step-header">Step 1 of 7</div>
        </div>
        <div class="progress-wrap" aria-label="Form progress">
          <div class="progress-track"><div id="progressFill" class="progress-fill" style="width: 14%;"></div></div>
          <div id="progressText" class="progress-text">14% complete</div>
        </div>

                <div class="step" data-step="1">
          <div class="tab-navigation">
            <div class="tab-indicator" id="tabIndicator"></div>
            <button type="button" class="tab-button active" data-tab="vin">VIN</button>
            <button type="button" class="tab-button" data-tab="license-plate">LICENSE PLATE</button>
          </div>
          <div class="tab-content active" id="vin-tab">
            <div class="field"><label for="vinNumber">VIN Number</label><input id="vinNumber" placeholder="Enter 17-character VIN" maxlength="17" style="text-transform: uppercase;" /></div>
          </div>
          <div class="tab-content" id="license-plate-tab">
            <div class="grid">
              <div class="field"><label for="licensePlate">License Plate</label><input id="licensePlate" placeholder="License Plate" style="text-transform: uppercase;" /></div>
              <div class="field"><label for="plateZipCode">ZIP Code</label><input id="plateZipCode" placeholder="ZIP Code" maxlength="5" /></div>
            </div>
          </div>
        </div>

        <div class="step hidden" data-step="2">
          <div class="grid step2-grid">
            <div class="field">
              <label for="titleType">What Is Your Title Type?</label>
              <div class="choice-group cols-4" data-field="titleType" role="group" aria-label="What Is Your Title Type?">
                <button type="button" class="choice-btn" data-value="clean" aria-pressed="false">Clean</button>
                <button type="button" class="choice-btn" data-value="salvage" aria-pressed="false">Salvage</button>
                <button type="button" class="choice-btn" data-value="rebuilt" aria-pressed="false">Rebuilt</button>
                <button type="button" class="choice-btn" data-value="no_title" aria-pressed="false">No Title</button>
              </div>
              <select id="titleType" class="hidden"><option value="" selected>Select</option><option>clean</option><option>salvage</option><option>rebuilt</option><option>no_title</option></select>
            </div>
            <div class="field">
              <label for="keysAvailable">Do You Have Keys Available?</label>
              <div class="choice-group" data-field="keysAvailable" role="group" aria-label="Do You Have Keys Available?">
                <button type="button" class="choice-btn" data-value="yes" aria-pressed="false">Yes</button>
                <button type="button" class="choice-btn" data-value="no" aria-pressed="false">No</button>
              </div>
              <select id="keysAvailable" class="hidden"><option value="" selected>Select</option><option>yes</option><option>no</option></select>
            </div>
            <div class="field">
              <label for="outstandingLoan">Do You Have Outstanding Loan?</label>
              <div class="choice-group" data-field="outstandingLoan" role="group" aria-label="Do You Have Outstanding Loan?">
                <button type="button" class="choice-btn" data-value="yes" aria-pressed="false">Yes</button>
                <button type="button" class="choice-btn" data-value="no" aria-pressed="false">No</button>
              </div>
              <select id="outstandingLoan" class="hidden"><option value="" selected>Select</option><option>yes</option><option>no</option></select>
            </div>
          </div>
        </div>

        <div class="step hidden" data-step="3">
          <div class="grid">
            <div class="field"><label for="zipCode">Zip Code</label><input id="zipCode" value="" /></div>
            <div class="field"><label for="mileage">Mileage/Odometer reading?</label><input id="mileage" value="" /></div>
          </div>
        </div>

        <div class="step hidden" data-step="4">
          <div class="grid">
            <div class="field full-width">
              <label for="startsDrives">Does Your Vehicle Start and Drive?</label>
              <div class="choice-group cols-3" data-field="startsDrives" role="group" aria-label="Does Your Vehicle Start and Drive?">
                <button type="button" class="choice-btn small-text" data-value="starts_and_drives" aria-pressed="false">Starts And Drives</button>
                <button type="button" class="choice-btn small-text" data-value="starts_no_drive" aria-pressed="false">Starts But Does Not Drive</button>
                <button type="button" class="choice-btn small-text" data-value="no_start" aria-pressed="false">Does Not Start</button>
              </div>
              <select id="startsDrives" class="hidden"><option value="" selected>Select</option><option>starts_and_drives</option><option>starts_no_drive</option><option>no_start</option></select>
            </div>
          </div>
          <div id="missingPartsWrap" class="field dynamic-followup hidden">
            <label for="missingReplacedParts">Any Missing Or Replaced Parts?</label>
            <div class="choice-group" data-field="missingReplacedParts" role="group" aria-label="Missing or replaced parts">
              <button type="button" class="choice-btn" data-value="yes" aria-pressed="false">Yes</button>
              <button type="button" class="choice-btn" data-value="no" aria-pressed="false">No</button>
            </div>
            <select id="missingReplacedParts" class="hidden"><option value="" selected>Select</option><option>yes</option><option>no</option></select>
          </div>
        </div>

        <div class="step hidden" data-step="5">
          <div class="grid">
            <div class="field full-width">
              <label for="hasDamage">What is the condition of the vehicle?</label>
              <div class="choice-group choice-list" data-field="hasDamage" role="group" aria-label="What is the condition of the vehicle?">
                <button type="button" class="choice-btn" data-value="frame_structural" aria-pressed="false">
                  <span class="list-title">Frame Or Structural Damage</span>
                  <span class="list-desc">Severe damage to the frame, engine, or major components, typically from a major impact.</span>
                </button>
                <button type="button" class="choice-btn" data-value="body_panel" aria-pressed="false">
                  <span class="list-title">Body Panel Damage</span>
                  <span class="list-desc">Moderate damage to doors, bumpers, hood, or other exterior panels.</span>
                </button>
                <button type="button" class="choice-btn" data-value="scratches_dents" aria-pressed="false">
                  <span class="list-title">Noticeable Scratches Or Dents</span>
                  <span class="list-desc">Surface damage such as scratches, dents, or paint issues.</span>
                </button>
                <button type="button" class="choice-btn" data-value="little_to_no" aria-pressed="false">
                  <span class="list-title">Little Or No Visible Damage</span>
                  <span class="list-desc">Minor dents & scratches or no damage at all.</span>
                </button>
              </div>
              <select id="hasDamage" class="hidden"><option value="" selected>Select</option><option value="frame_structural">Frame Or Structural</option><option value="body_panel">Body Panel</option><option value="scratches_dents">Scratches Or Dents</option><option value="little_to_no">Little Or No Visible</option></select>
            </div>
          </div>
        </div>

        <div class="step hidden" data-step="6">
          <div id="damageAreaWrap" class="field hidden">
            <label>Select the Damaged Area(s)</label>
            <div id="damageMap" class="damage-map" role="group" aria-label="Select damaged areas">
              <button type="button" class="damage-zone zone-front" data-zone="Front">Front</button>
              <button type="button" class="damage-zone zone-rear" data-zone="Rear">Rear</button>
              <button type="button" class="damage-zone zone-top" data-zone="Top">Top</button>
              <button type="button" class="damage-zone zone-side-left" data-zone="Side">Left</button>
              <button type="button" class="damage-zone zone-side-right" data-zone="Side">Right</button>
            </div>
            <div class="damage-hint">Tap the highlighted zones to mark damaged areas.</div>
          </div>
          <div id="airbagsDeployedWrap" class="field dynamic-followup hidden">
            <label for="airbagsDeployed">Has The Airbags Been Deployed?</label>
            <div class="choice-group" data-field="airbagsDeployed" role="group" aria-label="Has The Airbags Been Deployed?">
              <button type="button" class="choice-btn" data-value="yes" aria-pressed="false">Yes</button>
              <button type="button" class="choice-btn" data-value="no" aria-pressed="false">No</button>
            </div>
            <select id="airbagsDeployed" class="hidden"><option value="" selected>Select</option><option>yes</option><option>no</option></select>
          </div>
          <div id="fireFloodDamageWrap" class="field dynamic-followup hidden">
            <label for="fireFloodDamage">Has The Vehicle Had Fire or Flood Damage?</label>
            <div class="choice-group cols-3" data-field="fireFloodDamage" role="group" aria-label="Has The Vehicle Had Fire or Flood Damage?">
              <button type="button" class="choice-btn small-text" data-value="fire_damage" aria-pressed="false">Fire Damage</button>
              <button type="button" class="choice-btn small-text" data-value="flood_damage" aria-pressed="false">Flood Damage</button>
              <button type="button" class="choice-btn" data-value="no" aria-pressed="false">No</button>
            </div>
            <select id="fireFloodDamage" class="hidden"><option value="" selected>Select</option><option value="fire_damage">Fire Damage</option><option value="flood_damage">Flood Damage</option><option value="no">No</option></select>
          </div>
          <div id="mechanicalDamageWrap" class="field dynamic-followup hidden">
            <label for="mechanicalDamage">Is There Mechanical Damage?</label>
            <div class="choice-group" data-field="mechanicalDamage" role="group" aria-label="Is There Mechanical Damage?">
              <button type="button" class="choice-btn" data-value="yes" aria-pressed="false">Yes</button>
              <button type="button" class="choice-btn" data-value="no" aria-pressed="false">No</button>
            </div>
            <select id="mechanicalDamage" class="hidden"><option value="" selected>Select</option><option>yes</option><option>no</option></select>
          </div>
        </div>

        <div class="step hidden" data-step="7">
          <div class="grid">
            <div class="field full-width"><label for="phoneNumber">Phone Number</label><input id="phoneNumber" value="" /></div>
          </div>
          <div class="trust-badge">
            <img src="https://www.cashforcars.com/services/instaquote-ws/instaquote/assets/images/shield-icon.png" alt="Privacy Shield" width="32" height="32" />
            <div class="legal-text">
              <strong>By continuing, you agree and consent to</strong> receive communications from us via text message or other then-current methods of communication to assist with the sale of your vehicle. <strong>We value your privacy.</strong> To opt-out of text communications from us, respond with "STOP". Message and data rates apply. Messaging frequency may vary. Please review our <a href="https://www.cashforcars.com/privacy-policy/" target="_blank" style="color: var(--primary); font-weight: 600;">Privacy policy</a> to learn more.
            </div>
          </div>
        </div>

        <div class="step-actions">
          <button id="nextBtn" type="button">Next</button>
          <button id="quoteBtn" type="button" class="hidden">Get Quote</button>
        </div>
        </div>
        <div id="status" class="hidden"></div>
      </div>
    </div>
    <script>
      function byId(id) { return document.getElementById(id); }
      var currentStep = 1;
      var totalSteps = 7;
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
        var slot = byId("offerSlot");
        if (!slot) {
          return;
        }

        hideStatus();

        // Hide the wizard form so the offer takes its place in the widget body.
        var formBody = byId("formBody");
        if (formBody) {
          formBody.classList.add("hidden");
        }

        while (slot.firstChild) {
          slot.removeChild(slot.firstChild);
        }

        var back = document.createElement("button");
        back.type = "button";
        back.className = "offer-back-btn";
        var backIcon = document.createElement("span");
        backIcon.className = "back-icon";
        backIcon.setAttribute("aria-hidden", "true");
        backIcon.textContent = "←";
        back.appendChild(backIcon);
        back.appendChild(document.createTextNode("Back to edit details"));
        back.addEventListener("click", restoreForm);

        var card = document.createElement("div");
        card.className = "offer-card";

        var headline = document.createElement("div");
        headline.className = "offer-headline";
        var vehicle = getVehicleName();
        if (vehicle) {
          headline.appendChild(document.createTextNode("We're ready to pick up your "));
          var vehicleSpan = document.createElement("span");
          vehicleSpan.className = "offer-vehicle";
          vehicleSpan.textContent = vehicle;
          headline.appendChild(vehicleSpan);
          headline.appendChild(document.createTextNode(" and pay you"));
        } else {
          headline.textContent = "We're ready to pick up your vehicle and pay you";
        }

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

        card.appendChild(headline);
        card.appendChild(label);
        card.appendChild(price);
        card.appendChild(accept);

        slot.appendChild(back);
        slot.appendChild(card);
        slot.appendChild(buildOfferBenefits());
        slot.classList.remove("hidden");

        launchConfetti();
      }

      function getVehicleName() {
        var parts = [];
        var ids = ["year", "make", "model", "trim"];
        for (var i = 0; i < ids.length; i++) {
          var el = byId(ids[i]);
          var val = el ? String(el.value || "").trim() : "";
          if (val) {
            parts.push(val);
          }
        }
        if (parts.length) {
          return parts.join(" ");
        }
        // Demo fallback when the form has no decoded vehicle yet.
        return "2021 HONDA ACCORD EX";
      }

      function buildOfferBenefits() {
        var wrap = document.createElement("div");
        wrap.className = "offer-benefits";

        var items = [
          "Schedule a pickup time that's convenient for you",
          "Meet our licensed tower for a payment at pickup",
          "We can be there in as little as 24 hours"
        ];
        var list = document.createElement("ul");
        list.className = "benefit-list";
        for (var i = 0; i < items.length; i++) {
          var li = document.createElement("li");
          li.className = "benefit-item";
          var check = document.createElement("span");
          check.className = "benefit-check";
          check.setAttribute("aria-hidden", "true");
          check.appendChild(buildCheckIcon());
          var text = document.createElement("span");
          text.className = "benefit-text";
          text.textContent = items[i];
          li.appendChild(check);
          li.appendChild(text);
          list.appendChild(li);
        }

        var tagline = document.createElement("div");
        tagline.className = "offer-tagline";
        tagline.appendChild(document.createTextNode("The fastest, safest, easiest"));
        tagline.appendChild(document.createElement("br"));
        tagline.appendChild(document.createTextNode("way to sell your car"));

        wrap.appendChild(list);
        wrap.appendChild(tagline);
        return wrap;
      }

      function buildCheckIcon() {
        var ns = "http://www.w3.org/2000/svg";
        var svg = document.createElementNS(ns, "svg");
        svg.setAttribute("width", "22");
        svg.setAttribute("height", "22");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        var circle = document.createElementNS(ns, "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "10");
        circle.setAttribute("stroke", "#00A94F");
        circle.setAttribute("stroke-width", "2");
        var path = document.createElementNS(ns, "path");
        path.setAttribute("d", "M8 12.5l2.5 2.5L16 9");
        path.setAttribute("stroke", "#00A94F");
        path.setAttribute("stroke-width", "2");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(circle);
        svg.appendChild(path);
        return svg;
      }

      function restoreForm() {
        var slot = byId("offerSlot");
        if (slot) {
          slot.classList.add("hidden");
          while (slot.firstChild) {
            slot.removeChild(slot.firstChild);
          }
        }
        var formBody = byId("formBody");
        if (formBody) {
          formBody.classList.remove("hidden");
        }
        currentStep = totalSteps;
        renderStep();
      }

      function launchConfetti() {
        var host = byId("offerSlot");
        if (!host) {
          return;
        }
        var layer = document.createElement("div");
        layer.className = "confetti-layer";
        layer.setAttribute("aria-hidden", "true");
        var colors = ["#00A94F", "#22c55e", "#facc15", "#3b82f6", "#ef4444", "#a855f7"];
        for (var i = 0; i < 40; i++) {
          var piece = document.createElement("span");
          piece.className = "confetti-piece";
          piece.style.left = (Math.random() * 100) + "%";
          piece.style.background = colors[i % colors.length];
          piece.style.animationDelay = (Math.random() * 0.4) + "s";
          piece.style.animationDuration = (1.4 + Math.random() * 0.8) + "s";
          layer.appendChild(piece);
        }
        host.appendChild(layer);
        setTimeout(function() {
          if (layer.parentNode) {
            layer.parentNode.removeChild(layer);
          }
        }, 2800);
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

          if (/\bno\s+damage\b/i.test(text) || /\blittle\b/i.test(text)) {
            parsed.hasDamage = "little_to_no";
          } else if (/\bframe\b/i.test(text) || /\bstructural\b/i.test(text)) {
            parsed.hasDamage = "frame_structural";
          } else if (/\bbody\s+panel\b/i.test(text) || /\bmoderate\b/i.test(text)) {
            parsed.hasDamage = "body_panel";
          } else if (/\bscratch\b/i.test(text) || /\bdent\b/i.test(text)) {
            parsed.hasDamage = "scratches_dents";
          } else if (/\bdamage\b/i.test(text)) {
            parsed.hasDamage = "body_panel";
          }

          return parsed;
        }

        var parsedInput = parseFromUtterance(input.utterance);
        var mergedInput = {};
        if (input && input.vin) mergedInput.vinNumber = input.vin;
        for (var keyA in input) {
          mergedInput[keyA] = input[keyA];
        }
        for (var keyB in parsedInput) {
          mergedInput[keyB] = parsedInput[keyB];
        }

        var fields = [
          "vinNumber",
          "licensePlate",
          "plateZipCode",
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
        var airbagsDeployedWrap = byId("airbagsDeployedWrap");
        var fireFloodDamageWrap = byId("fireFloodDamageWrap");
        if (hasDamage === "frame_structural" || hasDamage === "body_panel" || hasDamage === "scratches_dents") {
          damageAreaWrap.classList.remove("hidden");
          mechanicalDamageWrap.classList.add("hidden");
          airbagsDeployedWrap.classList.remove("hidden");
          fireFloodDamageWrap.classList.remove("hidden");
          byId("mechanicalDamage").value = "";
          syncChoiceButtons("mechanicalDamage");
          clearFieldError(byId("mechanicalDamage"));
        } else if (hasDamage === "little_to_no") {
          mechanicalDamageWrap.classList.remove("hidden");
          airbagsDeployedWrap.classList.add("hidden");
          fireFloodDamageWrap.classList.add("hidden");
          damageAreaWrap.classList.add("hidden");
          clearDamageAreas();
          byId("airbagsDeployed").value = "";
          byId("fireFloodDamage").value = "";
          syncChoiceButtons("airbagsDeployed");
          syncChoiceButtons("fireFloodDamage");
          clearFieldError(byId("airbagsDeployed"));
          clearFieldError(byId("fireFloodDamage"));
          var oldDamageAreaError = byId("damageArea-error");
          if (oldDamageAreaError && oldDamageAreaError.parentNode) {
            oldDamageAreaError.parentNode.removeChild(oldDamageAreaError);
          }
        } else {
          damageAreaWrap.classList.add("hidden");
          mechanicalDamageWrap.classList.add("hidden");
          airbagsDeployedWrap.classList.add("hidden");
          fireFloodDamageWrap.classList.add("hidden");
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
          1: [],
          2: ["titleType", "keysAvailable", "outstandingLoan"],
          3: ["zipCode", "mileage"],
          4: ["startsDrives"],
          5: ["hasDamage"],
          6: [],
          7: ["phoneNumber"]
        };

        var requiredIds = requiredByStep[currentStep] || [];

        var hasError = false;
        if (currentStep === 1) {
          var activeTab = document.querySelector('.tab-button.active').getAttribute('data-tab');
          var vinEl = byId("vinNumber");
          var plateEl = byId("licensePlate");
          var plateZipEl = byId("plateZipCode");
          clearFieldError(vinEl);
          clearFieldError(plateEl);
          clearFieldError(plateZipEl);
          
          if (activeTab === 'vin') {
            var val = (vinEl.value || "").trim();
            if (!val || val.length !== 17) {
              setFieldError(vinEl, "Please enter a valid 17-character VIN.");
              hasError = true;
            }
          } else {
            if (!String(plateEl.value || "").trim()) {
              setFieldError(plateEl, "License Plate is required.");
              hasError = true;
            }
            var zipVal = String(plateZipEl.value || "").trim();
            if (!zipVal || zipVal.length !== 5) {
              setFieldError(plateZipEl, "Please enter a valid 5-digit ZIP.");
              hasError = true;
            }
          }
        }
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

        if (currentStep === 6) {
          var hasDamage = byId("hasDamage").value;
          if (hasDamage === "frame_structural" || hasDamage === "body_panel" || hasDamage === "scratches_dents") {
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
            if (!String(byId("airbagsDeployed").value || "").trim()) {
              setFieldError(byId("airbagsDeployed"), "This field is required.");
              hasError = true;
            }
            if (!String(byId("fireFloodDamage").value || "").trim()) {
              setFieldError(byId("fireFloodDamage"), "This field is required.");
              hasError = true;
            }
          } else if (hasDamage === "little_to_no") {
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
        var yearVal = byId("year") ? byId("year").value : null;
        var mileageVal = byId("mileage") ? byId("mileage").value : "";
        var damageAreas = getDamageAreas();
        return {
          vin: byId("vinNumber") ? byId("vinNumber").value : "",
          licensePlate: byId("licensePlate") ? byId("licensePlate").value : "",
          plateZipCode: byId("plateZipCode") ? byId("plateZipCode").value : "",
          year: yearVal ? Number(yearVal) : undefined,
          make: byId("make") ? byId("make").value : undefined,
          model: byId("model") ? byId("model").value : undefined,
          trim: byId("trim") ? byId("trim").value : undefined,
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
          airbagsDeployed: byId("airbagsDeployed").value,
          fireFloodDamage: byId("fireFloodDamage").value,
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

      var DEMO_OFFER = {
        ok: true,
        firmOffer: 3850,
        minOffer: 3500,
        maxOffer: 4200,
        confidence: "High",
        acceptUrl: "https://www.cashforcars.com/instaquote/"
      };

      async function getQuote() {
        try {
          currentStep = totalSteps;
          renderStep();
          updateConditionalFields();
          if (!validateRequiredFields()) {
            return;
          }

          // Demo mode: always render a mock instant offer with an Accept button.
          showStatus("Calculating...");
          setTimeout(function() { renderOffer(DEMO_OFFER); }, 800);
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
          syncChoiceButtons("outstandingLoan");
          syncChoiceButtons("startsDrives");
          syncChoiceButtons("missingReplacedParts");
          syncChoiceButtons("hasDamage");
          syncChoiceButtons("mechanicalDamage");
          syncChoiceButtons("airbagsDeployed");
          syncChoiceButtons("fireFloodDamage");

          
          var tabButtons = document.querySelectorAll('.tab-button');
          var tabContents = document.querySelectorAll('.tab-content');
          var tabIndicator = byId('tabIndicator');

          for (var i = 0; i < tabButtons.length; i++) {
            tabButtons[i].addEventListener('click', function(e) {
              var targetTab = this.getAttribute('data-tab');
              for (var j = 0; j < tabButtons.length; j++) {
                tabButtons[j].classList.remove('active');
                tabContents[j].classList.remove('active');
              }
              this.classList.add('active');
              byId(targetTab + '-tab').classList.add('active');
              
              if (targetTab === 'vin') {
                tabIndicator.style.transform = 'translateX(0)';
              } else {
                tabIndicator.style.transform = 'translateX(100%)';
              }
            });
          }
          
          var plateZip = byId("plateZipCode");
          var step3Zip = byId("zipCode");
          if(plateZip && step3Zip) {
            plateZip.addEventListener("input", function() { step3Zip.value = this.value; });
            step3Zip.addEventListener("input", function() { plateZip.value = this.value; });
          }

          prefillFromToolInput();

          syncChoiceButtons("titleType");
          syncChoiceButtons("keysAvailable");
          syncChoiceButtons("outstandingLoan");
          syncChoiceButtons("startsDrives");
          syncChoiceButtons("missingReplacedParts");
          syncChoiceButtons("hasDamage");
          syncChoiceButtons("mechanicalDamage");
          syncChoiceButtons("airbagsDeployed");
          syncChoiceButtons("fireFloodDamage");

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
        vin: z.string().min(17).max(17).optional(),
        licensePlate: z.string().optional(),
        plateZipCode: z.string().regex(/^[0-9]{5}$/).optional(),
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
        hasDamage: z.enum(["frame_structural", "body_panel", "scratches_dents", "little_to_no"]).optional(),
        damageArea: z.array(z.enum(["Top", "Front", "Rear", "Side"])).optional(),
        mechanicalDamage: z.enum(["yes", "no"]).optional(),
        airbagsDeployed: z.enum(["yes", "no"]).optional(),
        fireFloodDamage: z.enum(["fire_damage", "flood_damage", "no"]).optional(),
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
        vin: z.string().min(17).max(17).optional(),
        licensePlate: z.string().optional(),
        plateZipCode: z.string().regex(/^[0-9]{5}$/).optional(),
        year: z.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),
        make: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
        trim: z.string().min(1).optional(),
        titleType: z.enum(["clean", "salvage", "rebuilt", "no_title"]),
        zipCode: z.string().regex(/^[0-9]{5}$/),
        mileage: z.number().int().min(0).max(500000),
        startsDrives: z.enum(["starts_and_drives", "starts_no_drive", "no_start"]),
        missingReplacedParts: z.enum(["yes", "no"]).optional(),
        outstandingLoan: z.enum(["yes", "no"]),
        keysAvailable: z.enum(["yes", "no"]),
        hasDamage: z.enum(["frame_structural", "body_panel", "scratches_dents", "little_to_no"]),
        damageArea: z.array(z.enum(["Top", "Front", "Rear", "Side"])).optional(),
        mechanicalDamage: z.enum(["yes", "no"]).optional(),
        airbagsDeployed: z.enum(["yes", "no"]).optional(),
        fireFloodDamage: z.enum(["fire_damage", "flood_damage", "no"]).optional(),
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
        vin: z.string().min(17).max(17).optional(),
        licensePlate: z.string().optional(),
        plateZipCode: z.string().regex(/^[0-9]{5}$/).optional(),
        year: z.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),
        make: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
        trim: z.string().min(1).optional(),
        titleType: z.enum(["clean", "salvage", "rebuilt", "no_title"]),
        zipCode: z.string().regex(/^[0-9]{5}$/),
        mileage: z.number().int().min(0).max(500000),
        startsDrives: z.enum(["starts_and_drives", "starts_no_drive", "no_start"]),
        missingReplacedParts: z.enum(["yes", "no"]).optional(),
        outstandingLoan: z.enum(["yes", "no"]),
        keysAvailable: z.enum(["yes", "no"]),
        hasDamage: z.enum(["frame_structural", "body_panel", "scratches_dents", "little_to_no"]),
        damageArea: z.array(z.enum(["Top", "Front", "Rear", "Side"])).optional(),
        mechanicalDamage: z.enum(["yes", "no"]).optional(),
        airbagsDeployed: z.enum(["yes", "no"]).optional(),
        fireFloodDamage: z.enum(["fire_damage", "flood_damage", "no"]).optional(),
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
      // Mock acceptance for demonstration
      const body = {
        message: "Quote accepted successfully (Demo Mode).",
        quoteId,
        status: "accepted"
      };

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
  console.log(`Running in standalone Mock Mode (No external API needed)`);
});

process.on("SIGINT", async () => {
  for (const sessionId in transports) {
    await transports[sessionId].close();
    delete transports[sessionId];
  }
  process.exit(0);
});
