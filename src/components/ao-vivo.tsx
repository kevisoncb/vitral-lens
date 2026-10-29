"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";

/**
 * Deixa a tela ao vivo: quando outra pessoa (de outra área) muda um card, a tela recarrega
 * os dados sozinha, sem piscar. O Supabase Realtime respeita o RLS: só chegam mudanças
 * da própria ótica que o usuário pode ver.
 */
export function AoVivo({ tabelas }: { tabelas: string[] }) {
  const router = useRouter();
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chave = tabelas.join(",");

  useEffect(() => {
    const supabase = clienteNavegador();
    const canal = supabase.channel(`ao-vivo:${chave}`);
    for (const tabela of chave.split(",")) {
      canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, () => {
        // várias mudanças seguidas viram uma recarga só
        if (espera.current) clearTimeout(espera.current);
        espera.current = setTimeout(() => router.refresh(), 250);
      });
    }
    canal.subscribe();
    return () => {
      if (espera.current) clearTimeout(espera.current);
      supabase.removeChannel(canal);
    };
  }, [chave, router]);

  return null;
}
