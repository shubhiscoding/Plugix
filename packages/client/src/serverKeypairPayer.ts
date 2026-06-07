import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getMint
} from "@solana/spl-token";
import type { Payer, ServerKeypairPayerConfig } from "./types.js";

const MemoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

function parseKeypair(json: string): Keypair {
  const arr = JSON.parse(json);
  if (!Array.isArray(arr)) throw new Error("keypairJson must be a JSON array of 64 bytes");
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

export function serverKeypairPayer(config: ServerKeypairPayerConfig): Payer {
  return async (quote) => {
    const commitment = config.commitment ?? "confirmed";
    const payer = parseKeypair(config.keypairJson);
    const connection = new Connection(config.rpcUrl, commitment);

    const mintPubkey = new PublicKey(quote.mint);
    const receiverPubkey = new PublicKey(quote.receiver);

    const mintInfo = await getMint(connection, mintPubkey, commitment);
    const decimals = mintInfo.decimals;

    const amountHuman = Number(quote.price);
    if (!Number.isFinite(amountHuman) || amountHuman <= 0)
      throw new Error(`serverKeypairPayer: invalid quote price: ${quote.price}`);
    const amountBaseUnits = BigInt(Math.round(amountHuman * 10 ** decimals));

    const payerAta = await getAssociatedTokenAddress(mintPubkey, payer.publicKey);
    const receiverAta = await getAssociatedTokenAddress(mintPubkey, receiverPubkey);

    const ix: TransactionInstruction[] = [];

    const payerAtaInfo = await connection.getAccountInfo(payerAta, commitment);
    if (!payerAtaInfo)
      throw new Error("Payer ATA does not exist for this mint. Fund the payer and create the ATA first.");

    const receiverAtaInfo = await connection.getAccountInfo(receiverAta, commitment);
    if (!receiverAtaInfo) {
      ix.push(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          receiverAta,
          receiverPubkey,
          mintPubkey
        )
      );
    }

    ix.push(
      createTransferCheckedInstruction(
        payerAta,
        mintPubkey,
        receiverAta,
        payer.publicKey,
        amountBaseUnits,
        decimals
      )
    );

    ix.push(
      new TransactionInstruction({
        programId: MemoProgramId,
        keys: [],
        data: Buffer.from(`x402:${quote.reference}`, "utf8")
      })
    );

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: payer.publicKey,
        lamports: 0
      }),
      ...ix
    );

    tx.feePayer = payer.publicKey;
    const latest = await connection.getLatestBlockhash(commitment);
    tx.recentBlockhash = latest.blockhash;
    tx.sign(payer);

    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await connection.confirmTransaction(
      { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      commitment
    );

    return sig;
  };
}
