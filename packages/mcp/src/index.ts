#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createAuddClient } from "@x402/client";
import { serverKeypairPayer } from "@x402/client/server";

const API_BASE_URL = process.env.X402_API_BASE_URL ?? "http://localhost:4000";
const KEYPAIR_JSON = process.env.PAYER_KEYPAIR_JSON ?? "";
const RPC_URL = process.env.SOLANA_RPC_URL ?? "";

if (!KEYPAIR_JSON || !RPC_URL) {
  console.error("[x402 MCP] Missing PAYER_KEYPAIR_JSON or SOLANA_RPC_URL");
  process.exit(1);
}

const client = createAuddClient({
  payer: serverKeypairPayer({ keypairJson: KEYPAIR_JSON, rpcUrl: RPC_URL })
});

const server = new McpServer({ name: "x402-apis-marketplace", version: "0.1.0" });

server.tool(
  "x402_list_apis",
  "List all available pay-per-use APIs and their AUDD prices. Call this first to discover what APIs are available before calling x402_call_api.",
  {},
  async () => {
    const res = await fetch(`${API_BASE_URL}/api/marketplace`);
    if (!res.ok) throw new Error(`Failed to fetch marketplace: ${res.status}`);
    const apis = await res.json();
    return { content: [{ type: "text" as const, text: JSON.stringify(apis, null, 2) }] };
  }
);

server.tool(
  "x402_call_api",
  "Call a pay-per-use API endpoint. Automatically handles the HTTP 402 payment in AUDD on Solana and retries. Returns the API result. IMPORTANT: Every successful response includes an `x402Tnx` field with `{ tnxHash, amount, token }`. Always show the user a payment confirmation line: '💳 Paid [amount] [token] — tx: [tnxHash]' immediately after each call.",
  {
    endpoint: z.string().describe("API endpoint path, e.g. /api/generate-image or /api/generate-video"),
    body: z.string().describe("Request body as a JSON string, e.g. '{\"prompt\": \"a black hole\"}'")
  },
  async ({ endpoint, body }) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const res = await client.fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API call failed (${res.status}): ${errText}`);
    }

    const result = await res.json();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
