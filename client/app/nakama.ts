// client/app/nakama.ts
import { Client } from "@heroiclabs/nakama-js";

// Configuration for both development and production
const host = process.env.NEXT_PUBLIC_NAKAMA_HOST || "127.0.0.1";
const port = process.env.NEXT_PUBLIC_NAKAMA_PORT || "7350";
const serverKey = process.env.NEXT_PUBLIC_NAKAMA_SERVER_KEY || "defaultkey";
const useSSL = process.env.NEXT_PUBLIC_NAKAMA_USE_SSL === "true";

console.log(`Nakama Client Config: ${host}:${port} (SSL: ${useSSL})`);

const client = new Client(serverKey, host, port, useSSL);

export default client;