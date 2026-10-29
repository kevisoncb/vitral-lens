import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataBR, moeda } from "@/lib/formatar";
import { criarAtendimento } from "./actions";

const LINHAS = [0, 1, 2, 3, 4];
const CATEGORIAS: Record<string, string> = {
  armacao: "Armação",
  lente: "Lente",
  tratamento: "Tratamento",
  lente_contato: "Lente de contato",
  acessorio: "Acessório",
  servico: "Serviço",
};

export default async function NovoAtendimento({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; erro?: string }>;
}) {
  const { cliente, erro } = await searchParams;
  const supabase = await criarClienteServidor();
  const [clientes, catalogo, receitas] = await Promise.all([
    supabase.from("clientes").select("id, nome").order("nome").limit(500),
    supabase.from("catalogo_itens").select("id, nome, preco, categoria").eq("ativo", true).order("categoria").order("nome"),
    cliente
      ? supabase.from("receitas").select("id, data_receita, medico").eq("cliente_id", cliente).order("data_receita", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; data_receita: string; medico: string | null }[] }),
  ]);
  const porCategoria = Object.entries(CATEGORIAS).map(([cat, rotulo]) => ({
    rotulo,
    itens: (catalogo.data ?? []).filter((c) => c.categoria === cat),
  }));

  return (
    <>
      <h1>Novo atendimento</h1>
      <form action={criarAtendimento} className="formulario formulario-largo">
        {erro && <p className="erro" role="alert">{erro}</p>}
        <div className="linha">
          <label className="rotulo">Cliente
            <select className="campo" name="cliente_id" defaultValue={cliente ?? ""} required>
              <option value="" disabled>Escolha o cliente</option>
              {(clientes.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <small>Cliente novo? <Link href="/clientes/novo">Cadastre primeiro</Link>.</small>
          </label>
          {cliente && (
            <label className="rotulo">Receita
              <select className="campo" name="receita_id" defaultValue={receitas.data?.[0]?.id ?? ""}>
                <option value="">Sem receita</option>
                {(receitas.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{dataBR(r.data_receita)}{r.medico ? ` · ${r.medico}` : ""}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <label className="rotulo">Descrição (aparece no card)
          <input className="campo" name="descricao" placeholder="Ex.: Multifocal + armação" />
        </label>

        <h2>Orçamento</h2>
        <p className="vazio">
          Escolha do catálogo ou, se não achar, digite o produto novo com a categoria e o preço:
          ele entra no catálogo na hora. Armação nova pede foto depois; lente não precisa.
        </p>
        {LINHAS.map((i) => (
          <div key={i} className="item-orcamento">
            <label className="rotulo" style={{ flex: "2 1 240px" }}>Do catálogo
              <select className="campo" name={`catalogo_${i}`} defaultValue="">
                <option value="">— não está no catálogo —</option>
                {porCategoria.filter((g) => g.itens.length > 0).map((g) => (
                  <optgroup key={g.rotulo} label={g.rotulo}>
                    {g.itens.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome} ({moeda(c.preco)})</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <span className="ou">ou novo:</span>
            <label className="rotulo" style={{ flex: "2 1 200px" }}>Nome do produto
              <input className="campo" name={`descricao_${i}`} placeholder="Ex.: Armação Ray-X 5154 preta" />
            </label>
            <label className="rotulo" style={{ flex: "1 1 130px" }}>Categoria
              <select className="campo" name={`categoria_${i}`} defaultValue="armacao">
                {Object.entries(CATEGORIAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
            <label className="rotulo" style={{ flex: "0 1 70px" }}>Qtd
              <input className="campo" name={`qtd_${i}`} inputMode="decimal" defaultValue="1" />
            </label>
            <label className="rotulo" style={{ flex: "1 1 110px" }}>Preço (R$)
              <input className="campo" name={`preco_${i}`} inputMode="decimal" placeholder="do catálogo" />
            </label>
          </div>
        ))}
        <label className="marcar"><input type="checkbox" name="salvar_novos" defaultChecked /> Guardar os produtos novos no catálogo</label>

        <div className="janela-botoes">
          <Link className="botao-secundario" href="/vendas">Cancelar</Link>
          <button className="botao" type="submit">Criar atendimento</button>
        </div>
      </form>
    </>
  );
}
