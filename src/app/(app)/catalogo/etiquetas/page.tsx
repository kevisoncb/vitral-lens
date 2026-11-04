import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { Etiquetas, type ProdutoEtiqueta } from "./etiquetas";

/** Etiquetas com código de barras para as peças da vitrine; o leitor do PDV lê o mesmo código. */
export default async function PaginaEtiquetas() {
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const [itensR, saldosR] = await Promise.all([
    supabase.from("catalogo_itens").select("id, nome, marca, codigo, preco, controla_estoque").eq("ativo", true)
      .neq("categoria", "servico").order("nome").limit(2000),
    sessao?.pode("estoque") ? supabase.from("estoque_saldos").select("item_id, quantidade") : Promise.resolve({ data: [] as { item_id: string; quantidade: number }[] }),
  ]);
  const saldo = new Map<string, number>();
  for (const s of saldosR.data ?? []) saldo.set(s.item_id, (saldo.get(s.item_id) ?? 0) + s.quantidade);
  const produtos: ProdutoEtiqueta[] = (itensR.data ?? []).map((i) => ({
    id: i.id,
    nome: i.nome,
    marca: i.marca,
    codigo: i.codigo,
    preco: Number(i.preco),
    saldo: i.controla_estoque ? (saldo.get(i.id) ?? 0) : null,
  }));

  return (
    <>
      <div className="nao-imprimir">
        <Link href="/catalogo">← Produtos</Link>
        <h1>Etiquetas com código de barras</h1>
        <p className="subtitulo">Escolha quantas etiquetas de cada produto. No PDV, o leitor lê o código e o produto entra na venda.</p>
      </div>
      <Etiquetas produtos={produtos} otica={sessao?.oticaNome ?? ""} podeGerar={sessao?.pode("catalogo", "editar") ?? false} />
    </>
  );
}
