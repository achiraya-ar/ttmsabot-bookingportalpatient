// Supabase client initialization — use environment variables instead of embedding secrets.
// Recommended for Vite projects: define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in a .env file
//
// Example .env (place at project root — DO NOT commit this file):
// VITE_SUPABASE_URL=https://your-project-id.supabase.co
// VITE_SUPABASE_ANON_KEY=eyJ... (anon/public key)
//
// Notes:
// - In Vite, environment variables exposed to the client must be prefixed with VITE_.
// - This file will throw if the required values are not provided to avoid using an invalid client.

import { createClient } from "@supabase/supabase-js";

/**
 * Read from import.meta.env (Vite) if available, otherwise fall back to process.env.
 * Using 'as any' for import.meta.env access to keep TypeScript happy in different runtimes.
 */
const metaEnv = (
  typeof import.meta !== "undefined" ? (import.meta as any).env : undefined
) as Record<string, any> | undefined;

const SUPABASE_URL =
  (metaEnv && metaEnv.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY =
  (metaEnv && metaEnv.VITE_SUPABASE_ANON_KEY) ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment (e.g. .env).",
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
