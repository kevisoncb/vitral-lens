import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { mesDoParametro, proximoMes } from "@/lib/formatar";

const FORMAS: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito", boleto: "Boleto", outro: "Outro" };

type Pagamento = {
  pago_em: string;
  valor: number;
  forma: string;
  parcelas: number;
  atendimento_id: string | null;
  vendas: { numero: number | null; cancelada: boolean } | null;
};
type Recebida = { recebido_em: string; valor: number; recebido_forma: string | null; descricao: string };
type Paga = { pago_em: string; vencimento: string; valor: number; descricao: string; fornecedor: string | null; categorias_custo: { nome: string; tipo: string } | null };

/** Planilha do mês para o contador (abre no Excel): entradas e saídas, uma por linha. */
export async function GET(request: NextRequest) {
  const sessao = await obterSessao();
  if (!sessao || !sessao.pode("financeiro")) return new NextResponse("Sem acesso", { status: 403 });

  const mes = mesDoParametro(request.nextUrl.searchParams.get("mes") ?? undefined);
  const de = `${mes}-01`;
  const ate = `${proximoMes(mes)}-01`;
  const supabase = await criarClienteServidor();
  const [pagR, recR, pagasR] = await Promise.all([
    supabase.from("pagamentos").select("pago_em, valor, forma, parcelas, atendimento_id, vendas(numero, cancelada)")
      .gte("pago_em", `${de}T00:00:00-03:00`).lt("pago_em", `${ate}T00:00:00-03:00`).order("pago_em").returns<Pagamento[]>(),
    supabase.from("contas_receber").select("recebido_em, valor, recebido_forma, descricao")
      .gte("recebido_em", de).lt("recebido_em", ate).order("recebido_em").returns<Recebida[]>(),
    supabase.from("contas_pagar").select("pago_em, vencimento, valor, descricao, fornecedor, categorias_custo(nome, tipo)")
      .gte("pago_em", de).lt("pago_em", ate).order("pago_em").returns<Paga[]>(),
  ]);

  const celula = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const valor = (n: number) => Number(n).toFixed(2).replace(".", ",");
  const data = (iso: string) => {
    const dia = new Date(iso.length > 10 ? Date.parse(iso) - 3 * 3600_000 : Date.parse(`${iso}T12:00:00Z`)).toISOString().slice(0, 10);
    const [a, m, d] = dia.split("-");
    return `${d}/${m}/${a}`;
  };

  const linhas: string[][] = [["Data", "Tipo", "Categoria", "Descrição", "Fornecedor", "Forma", "Valor"]];
  for (const p of pagR.data ?? []) {
    if (p.vendas?.cancelada) continue;
    const desc = p.vendas ? `Venda PDV nº ${p.vendas.numero ?? ""}` : "Venda (sinal/saldo do atendimento)";
    linhas.push([data(p.pago_em), "Entrada", "Vendas", desc, "", `${FORMAS[p.forma] ?? p.forma}${p.parcelas > 1 ? ` ${p.parcelas}x` : ""}`, valor(p.valor)]);
  }
  for (const r of recR.data ?? []) {
    linhas.push([data(r.recebido_em), "Entrada", "Contas a receber", r.descricao, "", FORMAS[r.recebido_forma ?? ""] ?? "", valor(r.valor)]);
  }
  for (const c of pagasR.data ?? []) {
    linhas.push([data(c.pago_em), "Saída", c.categorias_custo?.nome ?? "Sem categoria", c.descricao, c.fornecedor ?? "", "", `-${valor(c.valor)}`]);
  }

  // BOM + ";" para o Excel brasileiro abrir certo
  const csv = "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vitral-financeiro-${mes}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
