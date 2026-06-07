import type { RequestHandler } from "express";
import { paymentMiddleware } from "./expressMiddleware.js";
import { AUDD_MINT, AUDD_TOKEN_NAME } from "./constants.js";
import type { AuddPaywallOptions, AuddRouteConfig, PriceConfig } from "./types.js";

export function priceInAudd(amount: number): PriceConfig {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error(`priceInAudd: must be positive finite number, got ${amount}`);
  return { price: String(amount), token: AUDD_TOKEN_NAME };
}

export function auddPaywall(
  routes: Record<string, AuddRouteConfig>,
  receiverPubkey: string,
  rpcUrl: string,
  opts?: AuddPaywallOptions
): RequestHandler {
  const priceConfigs: Record<string, PriceConfig> = {};
  for (const [path, config] of Object.entries(routes)) {
    if (typeof config === "number") {
      priceConfigs[path] = priceInAudd(config);
    } else {
      const { price, ...meta } = config;
      priceConfigs[path] = { ...priceInAudd(price), ...meta };
    }
  }
  return paymentMiddleware({
    routes: priceConfigs,
    receiverPubkey,
    rpcUrl,
    tokenMint: AUDD_MINT,
    ...opts
  });
}
