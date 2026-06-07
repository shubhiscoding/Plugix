# `@audd-x402/sdk`

**AUDD Pay-per-Use Gateway SDK**

Express middleware + Solana verification to monetize HTTP endpoints using AUDD (Australian Digital Dollar) through an x402-style payment flow:

1. Client calls an endpoint
2. Server responds `402 Payment Required` with a quote (price, receiver, reference)
3. Client pays (AUDD SPL transfer) and retries with headers
4. Server verifies the on-chain payment and serves the response

## Why x402?

- **HTTP-native payments**: Payment challenge embedded in HTTP flow (402 → pay → retry)
- **No API keys / accounts**: No signup or billing required
- **Agent-compatible**: AI agents can pay autonomously using standard HTTP
- **Micropayments viable**: Per-request pricing for small calls

## Why AUDD?

- **Stable pricing in Australian dollars**: Predictable costs and accounting
- **Real-world financial services**: AUD-denominated pricing for local use cases
- **Removes volatility**: No exposure to crypto price swings

## Install / use (workspace)

This repo uses npm workspaces. The SDK is consumed by `apps/api` as `@audd-x402/sdk`.

## API

### `paymentMiddleware(options)`

Wrap your Express app and configure pricing per route path.

```ts
import express from "express";
import { paymentMiddleware } from "@audd-x402/sdk";

const app = express();

app.use(
  paymentMiddleware({
    routes: {
      "/api/weather": { price: "0.01", token: "AUDD" }
    },
    receiverPubkey: process.env.RECEIVER_PUBKEY!,
    rpcUrl: process.env.SOLANA_RPC_URL!,
    commitment: "confirmed",
    // Optional:
    // auddMint: process.env.AUDD_MINT,
    // quoteTtlSeconds: 300,
    onPaid: (evt) => {
      console.log("paid", evt);
    }
  })
);

app.get("/api/weather", (_req, res) => res.json({ data: "Sunny 25°C" }));
```

#### `options.routes`

Route pricing is keyed by **exact path** (`req.path`), e.g. `"/api/weather"`.

```ts
{
  "/api/weather": { price: "0.01", token: "AUDD" },
  "/api/crypto-price": { price: "0.02", token: "AUDD" }
}
```

## Protocol contract

### Unpaid request → `402`

If the request is missing payment headers, the middleware returns:

- **Status**: `402 Payment Required`
- **Header**: `WWW-Authenticate: x402 token="AUDD", price="<price>"`
- **Body**: a `PaymentQuote` JSON object:

```json
{
  "endpoint": "/api/weather",
  "method": "GET",
  "price": "0.01",
  "token": "AUDD",
  "mint": "AUDDttiEpCydTm7joUMbYddm72jAWXZnCpPZtDoxqBSw",
  "receiver": "<receiver_pubkey>",
  "reference": "<unique_reference>",
  "expiresAt": "2026-04-22T12:34:56.000Z"
}
```

### Paid retry → headers

Client retries with:

- `x-payment-tx`: `<solana_transaction_signature>`
- `x-payment-reference`: `<reference_from_quote>`

If verification succeeds, the request continues to the route handler.

## Verification rules (Solana)

The SDK verifies payments by fetching the parsed transaction via RPC and checking:

- **Transaction status**: found + confirmed/finalized + no error
- **Quote validity**: quote not expired (`expiresAt`)
- **SPL transfer**: a `transferChecked` instruction exists (top-level or inner) where:
  - `mint` matches `auddMint` (defaults to official AUDD mint)
  - destination is the receiver’s **associated token account (ATA)** for that mint
  - transferred amount ≥ quote price (decimals read from the mint)
- **Memo binding (required)**: the transaction must include a Memo containing `x402:<reference>`
- **Replay protection**: middleware tracks tx signatures and rejects reuse with `409`

Source implementation:
- `packages/sdk/src/verifyPayment.ts`
- `packages/sdk/src/expressMiddleware.ts`

## Configuration notes

### AUDD mint

Default mint is the official AUDD mint on Solana:

- `AUDDttiEpCydTm7joUMbYddm72jAWXZnCpPZtDoxqBSw`

You can override with `auddMint` (or env `AUDD_MINT`) for testing.

Important: if you point at devnet and use a test mint, that mint must be a **standard SPL Token mint** owned by the classic token program (`Tokenkeg...`). If it’s a Token-2022 mint, `getMint()` from `@solana/spl-token` will throw.

### Required env (typical)

- `SOLANA_RPC_URL`
- `RECEIVER_PUBKEY`

## Example Use Case

A developer building a pay-per-use AI API:

1. User sends `POST /api/ai/generate` with a prompt
2. Server returns `402 Payment Required` with price in AUDD
3. User pays and retries
4. Server verifies payment and returns AI response

No signup. No billing. No API keys.

## What makes this different?

- No subscription model
- No API key management
- Payments happen inside HTTP
- Works for humans and AI agents

## Exports

- `paymentMiddleware`
- `verifyPayment`
- constants: `OFFICIAL_AUDD_MINT`, `PAYMENT_TX_HEADER`, `PAYMENT_REFERENCE_HEADER`
- types: `PaymentQuote`, `PaidEvent`, `PaymentMiddlewareOptions`, etc.

