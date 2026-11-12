"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CampoMascara } from "@/components/campo-mascara";
import { dataHoraBR, moeda } from "@/lib/formatar";
import { adicionarItem, pagar, removerItem, type DadosAtendimento, type ResultadoAtendimento } from "./actions";

type Produto = { id: string; nome: string; preco: number };

/**
 * Orçamento e pagamentos do atendimento. Cada ação devolve o estado novo (itens, total, pagamentos, OS) e a tela
 * mostra na hora; a recarga do resto da página vem depois e não sobrescreve o que já está certo.
 * O orçamento muda até o primeiro pagamento (o banco também confere, migração 0026).
 */
export function OrcamentoAtendimento({ atendimentoId, inicial, catalogo }: { atendimentoId: string; inicial: DadosAtendimento; catalogo: Produto[] }) {
  const router = useRouter();
  const [dados, setDados] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const pago = dados.pagamentos.reduce((s, p) => s + p.valor, 0);
  const saldo = Math.max(Math.round((dados.total - pago) * 100) / 100, 0);
  const orcamentoAberto = dados.pagamentos.length === 0;

  function aplicar(r: ResultadoAtendimento, mensagem: string, form?: HTMLFormElement) {
    if (!r.ok) {
      setErro(r.erro);
      setAviso(null);
      return;
    }
    setErro(null);
    setDados(r.dados);
    setAviso(mensagem);
    form?.reset();
    if (r.fotoDaArmacao) router.push(`/catalogo/fotos?itens=${r.fotoDaArmacao}&voltar=/vendas/${atendimentoId}`);
    else router.refresh(); // título, etapa e número da OS no topo
  }

  function enviar(e: React.FormEvent<HTMLFormElement>, acao: (f: FormData) => Promise<ResultadoAtendimento>, mensagem: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const formulario = new FormData(form);
    iniciar(async () => aplicar(await acao(formulario), mensagem, form));
  }

  return (
    <>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {aviso && <p className="ok" role="status">{aviso}</p>}

      <section className="bloco">
        <h2>Orçamento</h2>
        {dados.itens.map((i) => (
          <div key={i.id} className="linha-valor">
            <span>{i.quantidade}× {i.descricao}</span>
            <span className="linha" style={{ gap: 12, flexWrap: "nowrap" }}>
              <strong>{moeda(i.quantidade * i.preco_unitario)}</strong>
              {orcamentoAberto && (
                <button
                  type="button"
                  className="botao-link"
                  disabled={enviando}
                  aria-label={`Remover ${i.descricao}`}
                  onClick={() => iniciar(async () => aplicar(await removerItem(atendimentoId, i.id), "Item removido do orçamento."))}
                >
                  remover
                </button>
              )}
            </span>
          </div>
        ))}
        {dados.itens.length === 0 && <p className="vazio">Sem itens no orçamento. Acrescente abaixo o que o cliente vai levar.</p>}
        <div className="linha-valor total"><span>Total</span><strong>{moeda(dados.total)}</strong></div>
        {orcamentoAberto ? (
          <details className="acrescentar-item" open={dados.itens.length === 0}>
            <summary className="resumo-abrir">+ Acrescentar item</summary>
            <form onSubmit={(e) => enviar(e, (f) => adicionarItem(atendimentoId, f), "Item acrescentado ao orçamento.")} className="formulario" style={{ marginTop: 10 }}>
              <label className="rotulo">Do catálogo
                <select className="campo" name="catalogo_id" defaultValue="">
                  <option value="">— não está no catálogo (produto novo abaixo) —</option>
                  {catalogo.map((c) => <option key={c.id} value={c.id}>{c.nome} ({moeda(c.preco)})</option>)}
                </select>
              </label>
              <div className="grade-campos">
                <label className="rotulo">Ou produto novo<input className="campo" name="nome" placeholder="Ex.: Lente multifocal 1.67" /></label>
                <label className="rotulo">Categoria
                  <select className="campo" name="categoria" defaultValue="lente">
                    <option value="lente">Lente</option>
                    <option value="tratamento">Tratamento</option>
                    <option value="armacao">Armação</option>
                    <option value="lente_contato">Lente de contato</option>
                    <option value="acessorio">Acessório</option>
                    <option value="servico">Serviço</option>
                  </select>
                </label>
                <label className="rotulo">Quantidade<input className="campo" name="quantidade" inputMode="numeric" defaultValue="1" /></label>
                <label className="rotulo">Preço (R$)
                  <CampoMascara mascara="moeda" name="preco" placeholder="do catálogo" />
                </label>
              </div>
              <button className="botao-secundario" type="submit" disabled={enviando} style={{ alignSelf: "flex-start" }}>
                {enviando ? "Acrescentando…" : "Acrescentar ao orçamento"}
              </button>
            </form>
          </details>
        ) : (
          <small className="vazio">Orçamento fechado: já tem pagamento.</small>
        )}
      </section>

      <section className="bloco">
        <h2>Pagamentos</h2>
        {dados.pagamentos.map((p) => (
          <div key={p.id} className="linha-valor">
            <span>{p.sinal ? "Sinal" : "Pagamento"} · {p.forma}{p.parcelas > 1 ? ` ${p.parcelas}x` : ""} · {dataHoraBR(p.pago_em)}</span>
            <strong>{moeda(p.valor)}</strong>
          </div>
        ))}
        <div className="linha-valor total"><span>Falta pagar</span><strong>{moeda(saldo)}</strong></div>
        {dados.os && <p className="vazio">Ordem de serviço nº {dados.os.numero} criada no laboratório.</p>}

        {saldo > 0 && (
          <form key={`${dados.pagamentos.length}-${saldo}`} onSubmit={(e) => enviar(e, (f) => pagar(atendimentoId, f), "Pagamento registrado.")} className="linha">
            <label className="rotulo">Valor (R$)
              <CampoMascara mascara="moeda" name="valor" defaultValue={saldo} required />
            </label>
            <label className="rotulo">Forma
              <select className="campo" name="forma" defaultValue="pix">
                <option value="pix">Pix</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="credito">Cartão de crédito</option>
                <option value="debito">Cartão de débito</option>
                <option value="boleto">Boleto</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label className="rotulo">Parcelas
              <input className="campo" name="parcelas" inputMode="numeric" defaultValue="1" />
            </label>
            {!dados.os && (
              <label className="rotulo">Entrega prometida
                <input className="campo" type="date" name="data_prometida" />
              </label>
            )}
            <label className="marcar"><input type="checkbox" name="sinal" /> É sinal</label>
            <button className="botao" type="submit" disabled={enviando}>{enviando ? "Registrando…" : "Registrar pagamento"}</button>
          </form>
        )}
        <small className="vazio">No primeiro pagamento o atendimento vira “Recuperado/ganho” e a ordem de serviço é criada no laboratório.</small>
      </section>
    </>
  );
}
