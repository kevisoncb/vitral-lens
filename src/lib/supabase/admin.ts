import { createClient } from "@supabase/supabase-js";

/**
 * Cliente com a service role. SÓ no servidor e SÓ para o Auth (criar/remover login).
 * Dados de negócio continuam passando pelo cliente do usuário, para o RLS valer.
 */
export function criarClienteAdmin() {
  if (typeof window !== "undefined") throw new Error("criarClienteAdmin só pode rodar no servidor");
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY no .env.local");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
