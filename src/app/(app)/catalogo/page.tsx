import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { moeda } from "@/lib/formatar";
import { criarItem, salvarItem } from "./actions";

const CATEGORIAS: Record<string, string> = {
  lente: "Lentes",
  tratamento: "Tratamentos",
  armacao: "Armações",
  lente_contato: "Lentes de contato",
  acessorio: "Acessórios",
  servico: "Serviços",
};

export default async function PaginaCatalogo({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const { data: itens } = await supabase.from("catalogo_itens").select("id, categoria, nome, preco, ativo, foto_path, criado_na_venda").order("nome");
  const podeEditar = sessao?.pode("catalogo", "editar") ?? false;
  const podeCriar = sessao?.pode("catalogo", "criar") ?? false;

  return (
    <>
      <div>
        <h1>Catálogo</h1>
        <p className="subtitulo">Lentes, tratamentos, armações e serviços que aparecem no orçamento.</p>
      </div>
      {erro && <p className="erro" role="alert">{erro}</p>}

      {(() => {
        const semFoto = (itens ?? []).filter((i) => i.categoria === "armacao" && !i.foto_path && i.ativo);
        return semFoto.length > 0 ? (
          <div className="aviso">
            {semFoto.length} {semFoto.length === 1 ? "armação sem foto" : "armações sem foto"}.{" "}
            <Link href={`/catalogo/fotos?itens=${semFoto.slice(0, 10).map((i) => i.id).join(",")}`}>Fotografar agora</Link>
          </div>
        ) : null;
      })()}

      {podeCriar && (
        <section className="bloco">
          <h2>Novo item</h2>
          <form action={criarItem} className="linha">
            <label className="rotulo">Categoria
              <select className="campo" name="categoria" defaultValue="lente">
                {Object.entries(CATEGORIAS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </label>
            <label className="rotulo" style={{ flex: "3 1 240px" }}>Nome
              <input className="campo" name="nome" required placeholder="Ex.: Lente multifocal 1.67" />
            </label>
            <label className="rotulo">Preço (R$)
              <input className="campo" name="preco" inputMode="decimal" required />
            </label>
            <button className="botao" type="submit">Adicionar</button>
          </form>
        </section>
      )}

      {Object.entries(CATEGORIAS).map(([cat, rotulo]) => {
        const daCategoria = (itens ?? []).filter((i) => i.categoria === cat);
        if (daCategoria.length === 0) return null;
        return (
          <section key={cat} className="bloco">
            <h2>{rotulo}</h2>
            {daCategoria.map((i) =>
              podeEditar ? (
                <form key={i.id} action={salvarItem.bind(null, i.id)} className="linha">
                  {i.foto_path ? (
                    <img className="miniatura" src={supabase.storage.from("produtos").getPublicUrl(i.foto_path).data.publicUrl} alt="" />
                  ) : i.categoria === "armacao" ? (
                    <Link className="miniatura miniatura-vazia" href={`/catalogo/fotos?itens=${i.id}`}>+ foto</Link>
                  ) : null}
                  <input className="campo" name="nome" defaultValue={i.nome} aria-label="Nome" style={{ flex: "3 1 240px" }} />
                  {i.criado_na_venda && <span className="etiqueta">criado na venda</span>}
                  <input className="campo" name="preco" defaultValue={String(i.preco).replace(".", ",")} inputMode="decimal" aria-label="Preço" />
                  <label className="marcar"><input type="checkbox" name="ativo" defaultChecked={i.ativo} /> Ativo</label>
                  <button className="botao-secundario" type="submit">Salvar</button>
                </form>
              ) : (
                <div key={i.id} className="linha-valor">
                  <span>{i.nome}{i.ativo ? "" : " (inativo)"}</span>
                  <strong>{moeda(i.preco)}</strong>
                </div>
              ),
            )}
          </section>
        );
      })}
      {(itens ?? []).length === 0 && <p className="vazio">Catálogo vazio. Adicione os primeiros itens acima.</p>}
    </>
  );
}
