import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { criarAtendimento } from "./actions";

const LINHAS = [0, 1, 2, 3, 4];

export default async function NovoAtendimento({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; erro?: string }>;
}) {
  const { cliente, erro } = await searchParams;
  const supabase = await criarClienteServidor();
  const [clientes, catalogo] = await Promise.all([
    supabase.from("clientes").select("id, nome").order("nome").limit(500),
    supabase.from("catalogo_itens").select("id, nome, preco, categoria").eq("ativo", true).order("categoria").order("nome"),
  ]);

  return (
    <>
      <h1>Novo atendimento</h1>
      <form action={criarAtendimento} className="formulario formulario-largo">
        {erro && <p className="erro" role="alert">{erro}</p>}
        <label className="rotulo">Cliente
          <select className="campo" name="cliente_id" defaultValue={cliente ?? ""} required>
            <option value="" disabled>Escolha o cliente</option>
            {(clientes.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <small>Cliente novo? <Link href="/clientes/novo">Cadastre primeiro</Link>.</small>
        </label>
        <label className="rotulo">Descrição (aparece no card)
          <input className="campo" name="descricao" placeholder="Ex.: Multifocal + armação" />
        </label>

        <h2>Orçamento</h2>
        {LINHAS.map((i) => (
          <div key={i} className="linha">
            <label className="rotulo" style={{ flex: "2 1 220px" }}>Item do catálogo
              <select className="campo" name={`catalogo_${i}`} defaultValue="">
                <option value="">— ou digite abaixo —</option>
                {(catalogo.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} ({Number(c.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})</option>
                ))}
              </select>
            </label>
            <label className="rotulo" style={{ flex: "2 1 200px" }}>Descrição livre
              <input className="campo" name={`descricao_${i}`} />
            </label>
            <label className="rotulo" style={{ flex: "0 1 80px" }}>Qtd
              <input className="campo" name={`qtd_${i}`} inputMode="decimal" defaultValue="1" />
            </label>
            <label className="rotulo" style={{ flex: "1 1 110px" }}>Preço (R$)
              <input className="campo" name={`preco_${i}`} inputMode="decimal" placeholder="do catálogo" />
            </label>
          </div>
        ))}

        <div className="janela-botoes">
          <Link className="botao-secundario" href="/vendas">Cancelar</Link>
          <button className="botao" type="submit">Criar atendimento</button>
        </div>
      </form>
    </>
  );
}
