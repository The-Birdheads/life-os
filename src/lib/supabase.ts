import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

/**
 * Habitas のテーブルを置いている Postgres スキーマ。
 * Memory Calendar と Supabase プロジェクト(= ログイン基盤)を共有しており、
 * Memory Calendar の public スキーマと混ざらないよう habitas スキーマに分けている。
 * `.from()` はこのスキーマを向く。public スキーマの RPC は `supabase.schema("public").rpc()` で呼ぶ
 * (src/lib/accountApi.ts)。
 */
export const HABITAS_SCHEMA = "habitas";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: { schema: HABITAS_SCHEMA },
});
