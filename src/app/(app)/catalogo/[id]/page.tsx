import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { moeda } from "@/lib/formatar";
import { salvarProduto } from "./actions";
import { Precificacao } from "./precificacao";
import { CampoMascara } from "@/components/campo-mascara";

const CATEGORIAS: Record<string, string> = {
  armacao: "Armação",
  lente: "Lente",
  tratamento: "Tratamento",
  lente_contato: "Lente de contato",
  acessorio: "Acessório",
  servico: "Serviço",
};

// tabela de origem da mercadoria (NF-e)
const ORIGENS: Record<string, string> = {
  "0": "0 – Nacional",
  "1": "1 – Estrangeira, importação direta",
  "2": "2 – Estrangeira, comprada no mercado interno",
  "3": "3 – Nacional com mais de 40% de conteúdo importado",
  "4": "4 – Nacional, processo produtivo básico",
  "5": "5 – Nacional com até 40% de conteúdo importado",
  "6": "6 – Estrangeira, importação direta, sem similar nacional",
  "7": "7 – Estrangeira, mercado interno, sem similar nacional",
  "8": "8 – Nacional com mais de 70% de conteúdo importado",
};

// os CSOSN mais usados no comércio do Simples Nacional
const CSOSN: Record<string, string> = {
  "102": "102 – Tributada pelo Simples, sem crédito para o cliente (o mais comum)",
  "101": "101 – Tributada pelo Simples, com crédito para o cliente",
  "103": "103 – Isenção do ICMS no Simples para a faixa de receita",
  "500": "500 – ICMS já cobrado antes por substituição tributária (ST)",
  "300": "300 – Imune",
  "400": "400 – Não tributada pelo Simples",
  "900": "900 – Outros",
};

type Produto = {
  id: string;
  nome: string;
  categoria: string;
  marca: string | null;
  codigo: string | null;
  preco: number;
  ativo: boolean;
  unidade: string;
  custo: number | null;
  insumos_pct: number;
  impostos_pct: number;
  custo_final: number | null;
  ncm: string | null;
  cest: string | null;
  origem: number | null;
  cfop: string | null;
  csosn: string | null;
  cst_icms: string | null;
  aliquota_icms: number | null;
  cclass_trib: string | null;
};

/** Cadastro completo do produto: dados, custo e margem, e impostos (para a nota fiscal). */
export default async function Produto({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const [{ id }, { erro, ok }] = await Promise.all([params, searchParams]);
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("catalogo_itens")
    .select("id, nome, categoria, marca, codigo, preco, ativo, unidade, custo, insumos_pct, impostos_pct, custo_final, ncm, cest, origem, cfop, csosn, cst_icms, aliquota_icms, cclass_trib")
    .eq("id", id)
    .returns<Produto[]>()
    .maybeSingle();
  if (!data) notFound();
  const p = data;
  const podeEditar = sessao?.pode("catalogo", "editar") ?? false;
  // custo é informação do gerente: o balcão vê só o preço
  const veCusto = podeEditar || (sessao?.pode("estoque", "criar") ?? false);
  const faltaFiscal = !p.ncm || (!p.csosn && !p.cst_icms);

  return (
    <>
      <div>
        <Link href="/catalogo">← Catálogo</Link>
        <h1>{p.nome}</h1>
        <p className="subtitulo">{CATEGORIAS[p.categoria] ?? p.categoria}{p.marca ? ` · ${p.marca}` : ""}{p.codigo ? ` · código ${p.codigo}` : ""} · {moeda(p.preco)}</p>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">Produto salvo.</p>}
      {faltaFiscal && podeEditar && <p className="aviso">Faltam dados fiscais (NCM e CSOSN ou CST). Sem eles, este produto não sai na nota fiscal.</p>}

      <form action={salvarProduto.bind(null, p.id)} className="formulario-largo" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <fieldset className="bloco" disabled={!podeEditar}>
          <legend className="rotulo">Produto</legend>
          <div className="linha">
            <label className="rotulo" style={{ flex: "3 1 240px" }}>Nome<input className="campo" name="nome" defaultValue={p.nome} required /></label>
            <label className="rotulo">Categoria
              <select className="campo" name="categoria" defaultValue={p.categoria}>
                {Object.entries(CATEGORIAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
          </div>
          <div className="linha">
            <label className="rotulo">Marca<input className="campo" name="marca" defaultValue={p.marca ?? ""} /></label>
            <label className="rotulo">Código (barras ou referência)<input className="campo" name="codigo" defaultValue={p.codigo ?? ""} /></label>
            <label className="rotulo" style={{ flex: "0 1 110px" }}>Unidade<input className="campo" name="unidade" defaultValue={p.unidade} placeholder="UN" /></label>
            <label className="marcar"><input type="checkbox" name="ativo" defaultChecked={p.ativo} /> Ativo</label>
          </div>
        </fieldset>

        <fieldset className="bloco" disabled={!podeEditar}>
          <legend className="rotulo">Custo, preço e margem</legend>
          {veCusto ? (
            <Precificacao inicial={{ custo: p.custo === null ? null : Number(p.custo), insumosPct: Number(p.insumos_pct), impostosPct: Number(p.impostos_pct), preco: Number(p.preco) }} podeEditar={podeEditar} />
          ) : (
            <>
              <input type="hidden" name="preco" value={String(p.preco)} />
              <p className="vazio">Preço de venda: {moeda(p.preco)}. Custo e margem são do gerente.</p>
            </>
          )}
        </fieldset>

        <fieldset className="bloco" disabled={!podeEditar}>
          <legend className="rotulo">Impostos (para a nota fiscal)</legend>
          <p className="vazio">
            Tudo opcional, mas sem NCM e CSOSN (ou CST) o produto não sai na nota. Na dúvida, peça ao contador: ele tem esses códigos.
            A entrada pela nota do fornecedor já preenche NCM, CEST e origem.
          </p>
          <div className="linha">
            <label className="rotulo" title="Nomenclatura Comum do Mercosul: 8 números. Armações 9003…, óculos de sol 9004…, lentes 9001…">NCM
              <CampoMascara mascara="ncm" name="ncm" defaultValue={p.ncm} placeholder="9003.11.00" />
            </label>
            <label className="rotulo" title="Código Especificador da Substituição Tributária: 7 números, quando o produto tem ST">CEST
              <CampoMascara mascara="cest" name="cest" defaultValue={p.cest} placeholder="28.054.00" />
            </label>
            <label className="rotulo" title="Código Fiscal de Operações: venda dentro do estado é 5102 (ou 5405 com ST)">CFOP da venda
              <CampoMascara mascara="cfop" name="cfop" defaultValue={p.cfop} placeholder="5102" />
            </label>
          </div>
          <div className="linha">
            <label className="rotulo" style={{ flex: "2 1 260px" }}>Origem da mercadoria
              <select className="campo" name="origem" defaultValue={p.origem === null ? "" : String(p.origem)}>
                <option value="">Não informada</option>
                {Object.entries(ORIGENS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
          </div>
          <div className="linha">
            <label className="rotulo" style={{ flex: "2 1 260px" }}>CSOSN (Simples Nacional)
              <select className="campo" name="csosn" defaultValue={p.csosn ?? ""}>
                <option value="">Não informado</option>
                {Object.entries(CSOSN).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                {p.csosn && !CSOSN[p.csosn] && <option value={p.csosn}>{p.csosn}</option>}
              </select>
            </label>
            <label className="rotulo" title="Só para quem não é do Simples Nacional (regime normal): 2 números, ex.: 00, 10, 60">CST do ICMS (regime normal)
              <CampoMascara mascara="digitos" name="cst_icms" defaultValue={p.cst_icms} placeholder="00" maxLength={2} />
            </label>
            <label className="rotulo" title="Só no regime normal; no Simples o ICMS vai no DAS">Alíquota ICMS (%)
              <CampoMascara mascara="porcentagem" name="aliquota_icms" defaultValue={p.aliquota_icms} />
            </label>
          </div>
          <div className="linha">
            <label className="rotulo" title="Classificação tributária do IBS e da CBS (cClassTrib): 6 números, da tabela oficial da reforma. O contador informa.">
              Classificação IBS/CBS (cClassTrib)
              <CampoMascara mascara="digitos" name="cclass_trib" defaultValue={p.cclass_trib} placeholder="000001" maxLength={6} />
            </label>
          </div>
          <small className="vazio">
            Com a reforma tributária, a nota passa a destacar IBS e CBS. Veja o <Link href="/reforma-tributaria">guia da reforma para óticas</Link>.
          </small>
        </fieldset>

        {podeEditar && <div className="janela-botoes"><button className="botao" type="submit">Salvar produto</button></div>}
      </form>
    </>
  );
}
