// PROTOTYPE, throwaway. Part of "Does Knock hold up against Cadence?".
import { Knock, signUserToken } from "@knocklabs/node";

// Vite doesn't put non-VITE_ vars from .env into process.env.
try {
  process.loadEnvFile(".env");
} catch {}

export const knock = new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY });

// Knock recipient id for a Cadence user.
export const knockUserId = (userId: number) => String(userId);

export function signFeedToken(userId: number) {
  return signUserToken(knockUserId(userId), { expiresInSeconds: 60 * 60 });
}

export const knockPublicConfig = () => ({
  publicKey: process.env.KNOCK_PUBLIC_API_KEY!,
  feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID!,
});
