import { dataHoraBR, moeda } from "@/lib/formatar";
import { Imprimir } from "../../[id]/imprimir";

const FORMAS: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", debito: "Débito", credito: "Crédito" };

export type Resumo = {
  aberto_em: string;
  fechado_em: string | null;
  operador: string | null;
  loja: string | null;
  abertura: number;
  vendas_por_forma: Record<string, number>;
  recebimentos_por_forma: Record<string, number>;
  qtd_vendas: number;
  qtd_canceladas: number;
  sangrias: number;
  suprimentos: number;
  devolucoes_dinheiro: number;
  esperado: number;
  contado: number | null;
  diferenca: number | null;
  observacao: string | null;
};

/** Desenho do comprovante do fechamento (80 mm). */
export function Comprovante({ r, otica, ok }: { r: Resumo; otica: { nome: string; cnpj: string | null } | null; ok?: string }) {
  const totalForma = (m: Record<string, number>) => Object.values(m).reduce((s, v) => s + Number(v), 0);
  const dif = r.diferenca === null ? null : Number(r.diferenca);
  return (
    <main className="cupom">
      {ok && <p className="cupom-acoes" role="status">{ok}</p>}
      <Imprimir automatico={false} voltar="/pdv/caixas" />
      <header>
        <strong>{otica?.nome}</strong>
        {otica?.cnpj && <span>CNPJ {otica.cnpj}</span>}
      </header>
      <p className="cupom-titulo">{r.fechado_em ? "FECHAMENTO DE CAIXA" : "RESUMO PARCIAL DO CAIXA"}</p>
      <div className="cupom-linha"><span>Operador</span><span>{r.operador ?? "—"}</span></div>
      {r.loja && <div className="cupom-linha"><span>Loja</span><span>{r.loja}</span></div>}
      <div className="cupom-linha"><span>Abertura</span><span>{dataHoraBR(r.aberto_em)}</span></div>
      {r.fechado_em && <div className="cupom-linha"><span>Fechamento</span><span>{dataHoraBR(r.fechado_em)}</span></div>}
      <div className="cupom-linha"><span>Vendas</span><span>{r.qtd_vendas}{r.qtd_canceladas ? ` (+${r.qtd_canceladas} canceladas)` : ""}</span></div>

      <p className="cupom-titulo">VENDAS POR FORMA</p>
      {Object.entries(r.vendas_por_forma).map(([f, v]) => (
        <div key={f} className="cupom-linha"><span>{FORMAS[f] ?? f}</span><span>{moeda(v)}</span></div>
      ))}
      {Object.keys(r.vendas_por_forma).length === 0 && <div className="cupom-linha"><span>Nenhuma</span><span>{moeda(0)}</span></div>}
      <div className="cupom-linha cupom-total"><span>Total vendido</span><span>{moeda(totalForma(r.vendas_por_forma))}</span></div>

      {Object.keys(r.recebimentos_por_forma).length > 0 && (
        <>
          <p className="cupom-titulo">RECEBIDO (ÓCULOS E CREDIÁRIO)</p>
          {Object.entries(r.recebimentos_por_forma).map(([f, v]) => (
            <div key={f} className="cupom-linha"><span>{FORMAS[f] ?? f}</span><span>{moeda(v)}</span></div>
          ))}
          <div className="cupom-linha cupom-total"><span>Total recebido</span><span>{moeda(totalForma(r.recebimentos_por_forma))}</span></div>
        </>
      )}

      <p className="cupom-titulo">GAVETA (DINHEIRO)</p>
      <div className="cupom-linha"><span>Troco inicial</span><span>{moeda(r.abertura)}</span></div>
      <div className="cupom-linha"><span>Vendas em dinheiro</span><span>{moeda(r.vendas_por_forma.dinheiro ?? 0)}</span></div>
      {Number(r.recebimentos_por_forma.dinheiro ?? 0) > 0 && <div className="cupom-linha"><span>Recebido em dinheiro</span><span>{moeda(r.recebimentos_por_forma.dinheiro)}</span></div>}
      {Number(r.suprimentos) > 0 && <div className="cupom-linha"><span>Suprimentos</span><span>{moeda(r.suprimentos)}</span></div>}
      {Number(r.sangrias) > 0 && <div className="cupom-linha"><span>Sangrias</span><span>−{moeda(r.sangrias)}</span></div>}
      {Number(r.devolucoes_dinheiro) > 0 && <div className="cupom-linha"><span>Devoluções</span><span>−{moeda(r.devolucoes_dinheiro)}</span></div>}
      <div className="cupom-linha cupom-total"><span>Esperado</span><span>{moeda(r.esperado)}</span></div>
      {r.contado !== null && <div className="cupom-linha"><span>Contado</span><span>{moeda(r.contado)}</span></div>}
      {dif !== null && (
        <div className="cupom-linha cupom-total">
          <span>Diferença</span><span>{Math.abs(dif) < 0.005 ? "conferido" : `${dif > 0 ? "+" : "−"}${moeda(Math.abs(dif))}`}</span>
        </div>
      )}
      {r.observacao && <p>Obs.: {r.observacao}</p>}

      <footer>
        <span>______________________________</span>
        <small>Assinatura do operador</small>
        <span style={{ marginTop: 14 }}>______________________________</span>
        <small>Assinatura do gerente</small>
      </footer>
    </main>
  );
}
