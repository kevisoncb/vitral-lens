import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./tipos";

let cliente: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente do Supabase no navegador (usa o login dos cookies). Um só por aba. */
export function clienteNavegador() {
  cliente ??= createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return cliente;
}
