export type Quote = {
  endpoint: string;
  method: string;
  price: string;
  token: string;
  mint: string;
  receiver: string;
  reference: string;
  expiresAt: string;
  name?: string;
  description?: string;
  category?: string;
  fiatEquivalent?: string;
  tokenName?: string;
};

export type Payer = (quote: Quote) => Promise<string>;

export type AuddClientConfig = {
  payer: Payer;
};

export type ServerKeypairPayerConfig = {
  keypairJson: string;
  rpcUrl: string;
  commitment?: "confirmed" | "finalized";
};
