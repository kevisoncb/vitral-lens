import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { dataBR, dataHoraBR, moeda } from "@/lib/formatar";
import { Imprimir } from "./imprimir";

const FORMAS: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito" };

type Venda = {
  numero: number | null;
  subtotal: number;
  desconto: number;
  total: number;
  cancelada: boolean;
  criado_em: string;
  clientes: { nome: string; cpf: string | null } | null;
  vendedor: { nome: string } | null;
  lojas: { nome: string; endereco: string | null; telefone: string | null } | null;
  venda_itens: { descricao: string; quantidade: number; preco_unitario: number }[];
  pagamentos: { forma: string; valor: number; parcelas: number }[];
  contas_receber: { valor: number; vencimento: string }[];
};

/** Cupom da venda do PDV (sem valor fiscal), no tamanho da impressora térmica de 80 mm. */
export default async function Cupom({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ imprimir?: string }> }) {
  const [{ id }, { imprimir }] = await Promise.all([params, searchParams]);
  await exigirArea("pdv", "financeiro");
  const supabase = await criarClienteServidor();
  const [vendaR, oticaR] = await Promise.all([
    supabase
      .from("vendas")
      .select("numero, subtotal, desconto, total, cancelada, criado_em, clientes(nome, cpf), vendedor:usuarios!vendas_vendedor_id_fkey(nome), lojas(nome, endereco, telefone), venda_itens(descricao, quantidade, preco_unitario), pagamentos(forma, valor, parcelas), contas_receber(valor, vencimento)")
      .eq("id", id)
      .returns<Venda[]>()
      .maybeSingle(),
    supabase.from("oticas").select("nome, cnpj, telefone, site_endereco").maybeSingle(),
  ]);
  const v = vendaR.data;
  if (!v) notFound();
  const o = oticaR.data;

  return (
    <main className="cupom">
      <Imprimir automatico={imprimir === "1"} />
      <header>
        <strong>{o?.nome}</strong>
        {o?.cnpj && <span>CNPJ {o.cnpj}</span>}
        {(v.lojas?.endereco ?? o?.site_endereco) && <span>{v.lojas?.endereco ?? o?.site_endereco}</span>}
        {(v.lojas?.telefone ?? o?.telefone) && <span>{v.lojas?.telefone ?? o?.telefone}</span>}
      </header>
      <p className="cupom-titulo">CUPOM SEM VALOR FISCAL</p>
      {v.cancelada && <p className="cupom-titulo">VENDA CANCELADA</p>}
      <div className="cupom-linha"><span>Venda nº {v.numero}</span><span>{dataHoraBR(v.criado_em)}</span></div>
      {v.vendedor && <div className="cupom-linha"><span>Vendedor</span><span>{v.vendedor.nome}</span></div>}
      {v.clientes && <div className="cupom-linha"><span>Cliente</span><span>{v.clientes.nome}</span></div>}

      <table>
        <tbody>
          {v.venda_itens.map((i, n) => (
            <tr key={n}>
              <td>{i.quantidade} × {i.descricao}<br /><small>{moeda(i.preco_unitario)} un.</small></td>
              <td>{moeda(i.quantidade * i.preco_unitario)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="cupom-linha"><span>Subtotal</span><span>{moeda(v.subtotal)}</span></div>
      {Number(v.desconto) > 0 && <div className="cupom-linha"><span>Desconto</span><span>−{moeda(v.desconto)}</span></div>}
      <div className="cupom-linha cupom-total"><span>TOTAL</span><span>{moeda(v.total)}</span></div>

      {v.pagamentos.map((p, n) => (
        <div key={n} className="cupom-linha"><span>{FORMAS[p.forma] ?? p.forma}{p.parcelas > 1 ? ` ${p.parcelas}x` : ""}</span><span>{moeda(p.valor)}</span></div>
      ))}
      {v.contas_receber.map((c, n) => (
        <div key={`c${n}`} className="cupom-linha"><span>Crediário, vence {dataBR(c.vencimento)}</span><span>{moeda(c.valor)}</span></div>
      ))}

      <footer>
        <span>Obrigado pela preferência!</span>
        <small>Trocas com este cupom em até 7 dias.</small>
      </footer>
    </main>
  );
}
