import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { FotoProduto } from "./foto-produto";

/** Logo depois da venda com armação nova: pede a foto (lente não precisa). */
export default async function FotosDosProdutos({ searchParams }: { searchParams: Promise<{ itens?: string; voltar?: string }> }) {
  const { itens, voltar } = await searchParams;
  const ids = (itens ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 10);
  const destino = voltar?.startsWith("/") && !voltar.startsWith("//") ? voltar : "/catalogo";
  const supabase = await criarClienteServidor();
  const { data } = ids.length
    ? await supabase.from("catalogo_itens").select("id, nome, foto_path").in("id", ids)
    : { data: [] as { id: string; nome: string; foto_path: string | null }[] };

  return (
    <>
      <div>
        <h1>Foto da armação</h1>
        <p className="subtitulo">Produto novo entrou no catálogo. Tire uma foto da armação para achar fácil depois (e para o laboratório conferir).</p>
      </div>
      <section className="bloco">
        {(data ?? []).map((i) => (
          <FotoProduto
            key={i.id}
            itemId={i.id}
            nome={i.nome}
            fotoAtual={i.foto_path ? supabase.storage.from("produtos").getPublicUrl(i.foto_path).data.publicUrl : null}
          />
        ))}
        {(data ?? []).length === 0 && <p className="vazio">Nenhum produto para fotografar.</p>}
      </section>
      <div className="janela-botoes">
        <Link className="botao-secundario" href={destino}>Depois</Link>
        <Link className="botao" href={destino}>Continuar</Link>
      </div>
    </>
  );
}
