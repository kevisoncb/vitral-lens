import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataHoraBR, moeda } from "@/lib/formatar";

type Evento = { quando: string; area: "consultorio" | "loja" | "laboratorio"; titulo: string; detalhe?: string; href?: string };

/**
 * O caminho do cliente pelas três partes da ótica, numa tela só:
 * consulta → exame → receita → orçamento → pagamento → OS → entrega.
 * Cada parte só aparece para quem tem acesso a ela (o RLS esconde o resto).
 */
export async function LinhaDoTempo({ clienteId }: { clienteId: string }) {
  const supabase = await criarClienteServidor();
  const [consultas, exames, receitas, atendimentos, pagamentos, ordens] = await Promise.all([
    supabase.from("consultas").select("id, inicio, status, origem").eq("cliente_id", clienteId),
    supabase.from("exames").select("id, criado_em, concluido_em, status, usuarios(nome)").eq("cliente_id", clienteId)
      .returns<{ id: string; criado_em: string; concluido_em: string | null; status: string; usuarios: { nome: string } | null }[]>(),
    supabase.from("receitas").select("id, criado_em, data_receita, externa, medico").eq("cliente_id", clienteId),
    supabase.from("atendimentos").select("id, criado_em, descricao, valor_total, origem, funil_etapas(nome)").eq("cliente_id", clienteId)
      .returns<{ id: string; criado_em: string; descricao: string | null; valor_total: number; origem: string; funil_etapas: { nome: string } | null }[]>(),
    supabase.from("pagamentos").select("id, pago_em, valor, forma, sinal, atendimentos!inner(cliente_id)").eq("atendimentos.cliente_id", clienteId),
    supabase.from("ordens_servico").select("id, numero, criado_em, data_entrega, os_etapas(nome)").eq("cliente_id", clienteId)
      .returns<{ id: string; numero: number; criado_em: string; data_entrega: string | null; os_etapas: { nome: string } | null }[]>(),
  ]);

  const eventos: Evento[] = [
    ...(consultas.data ?? []).map((c) => ({
      quando: c.inicio, area: "consultorio" as const,
      titulo: `Consulta ${c.status}`, detalhe: c.origem === "site" ? "marcada pelo site" : undefined,
    })),
    ...(exames.data ?? []).map((e) => ({
      quando: e.concluido_em ?? e.criado_em, area: "consultorio" as const,
      titulo: e.status === "concluido" ? "Exame concluído" : "Exame em andamento", detalhe: e.usuarios?.nome,
      href: `/consultorio/exame/${e.id}`,
    })),
    ...(receitas.data ?? []).map((r) => ({
      quando: r.criado_em, area: "consultorio" as const,
      titulo: r.externa ? "Receita de fora cadastrada" : "Receita gerada", detalhe: r.medico ?? undefined,
    })),
    ...(atendimentos.data ?? []).map((a) => ({
      quando: a.criado_em, area: "loja" as const,
      titulo: `Orçamento ${moeda(a.valor_total)}`, detalhe: `${a.descricao ?? ""} · ${a.funil_etapas?.nome ?? ""}${a.origem !== "loja" ? ` · veio do ${a.origem}` : ""}`,
      href: `/vendas/${a.id}`,
    })),
    ...(pagamentos.data ?? []).map((p) => ({
      quando: p.pago_em, area: "loja" as const,
      titulo: `${p.sinal ? "Sinal" : "Pagamento"} ${moeda(p.valor)}`, detalhe: p.forma,
    })),
    ...(ordens.data ?? []).flatMap((o) => [
      { quando: o.criado_em, area: "laboratorio" as const, titulo: `OS ${o.numero} aberta`, detalhe: o.os_etapas?.nome, href: `/laboratorio/${o.id}` },
      ...(o.data_entrega ? [{ quando: `${o.data_entrega}T18:00:00-03:00`, area: "loja" as const, titulo: `OS ${o.numero} entregue` }] : []),
    ]),
  ].sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando));

  return (
    <section className="bloco">
      <h2>Linha do tempo</h2>
      {eventos.length === 0 && <p className="vazio">Nada registrado ainda.</p>}
      <ol className="linha-tempo">
        {eventos.slice(0, 40).map((e, i) => (
          <li key={i} className={`linha-tempo-${e.area}`}>
            <small>{dataHoraBR(e.quando)}</small>
            {e.href ? <Link href={e.href}><strong>{e.titulo}</strong></Link> : <strong>{e.titulo}</strong>}
            {e.detalhe && <span>{e.detalhe}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
