import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataBR } from "@/lib/formatar";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function PaginaClientes({ searchParams }: Props) {
  const { q } = await searchParams;
  const busca = (q ?? "").trim().replace(/[%,()]/g, "");
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("clientes")
    .select("id, nome, telefone, criado_em")
    .order("nome")
    .limit(100);
  if (busca) consulta = consulta.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`);
  const { data: clientes } = await consulta;

  return (
    <>
      <div className="topo">
        <div>
          <h1>Clientes</h1>
          <p className="subtitulo">Cadastro, receitas e histórico de cada cliente.</p>
        </div>
        <div className="topo-acoes">
          <form action="/clientes" method="get">
            <input className="campo" type="search" name="q" defaultValue={busca} placeholder="Buscar nome ou telefone" aria-label="Buscar cliente" />
          </form>
          <Link className="botao" href="/clientes/novo">
            + Novo cliente
          </Link>
        </div>
      </div>

      <div className="lista">
        {(clientes ?? []).map((c) => (
          <Link key={c.id} className="lista-item" href={`/clientes/${c.id}`}>
            <strong>{c.nome}</strong>
            <span>{c.telefone ?? "sem telefone"}</span>
            <small>Desde {dataBR(c.criado_em)}</small>
          </Link>
        ))}
        {(clientes ?? []).length === 0 && (
          <p className="vazio">{busca ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</p>
        )}
      </div>
    </>
  );
}
