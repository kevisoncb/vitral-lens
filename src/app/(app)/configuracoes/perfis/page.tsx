import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import type { Permissoes } from "@/lib/permissoes";
import { Abas } from "../abas";
import { criarPerfil, salvarPerfil } from "./actions";
import { ACOES, MODULOS_CONFIGURAVEIS } from "./modulos";

export default async function ConfigPerfis({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const { data: perfis } = await supabase.from("perfis").select("id, chave, nome, permissoes").order("nome");
  const podeEditar = sessao?.pode("usuarios", "editar") ?? false;

  return (
    <>
      <h1>Configurações</h1>
      <Abas atual="/configuracoes/perfis" />
      <p className="subtitulo">O que cada perfil pode fazer em cada módulo. O plano da ótica também precisa liberar o módulo.</p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">Salvo.</p>}

      {(perfis ?? []).map((p) => {
        const perm = (p.permissoes ?? {}) as Permissoes;
        const travado = !podeEditar || p.chave === "dono";
        return (
          <form key={p.id} action={salvarPerfil.bind(null, p.id)} className="bloco">
            <div className="linha">
              <input className="campo" name="nome" defaultValue={p.nome} disabled={travado} aria-label="Nome do perfil" style={{ fontWeight: 700 }} />
              {!travado && <button className="botao-secundario" type="submit">Salvar perfil</button>}
              {p.chave === "dono" && <small className="vazio">Acesso total, não editável.</small>}
            </div>
            <div className="matriz" role="table" aria-label={`Permissões de ${p.nome}`}>
              <span className="th">Módulo</span>
              {ACOES.map((a) => <span key={a} className="th">{a}</span>)}
              {MODULOS_CONFIGURAVEIS.map(({ modulo, rotulo }) => (
                <div key={modulo} className="matriz-linha" role="row">
                  <span>{rotulo}</span>
                  {ACOES.map((a) => (
                    <input
                      key={a}
                      type="checkbox"
                      name={`${modulo}:${a}`}
                      defaultChecked={perm[modulo]?.includes(a) ?? false}
                      disabled={travado}
                      aria-label={`${rotulo}: ${a}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </form>
        );
      })}

      {podeEditar && (
        <form action={criarPerfil} className="bloco linha">
          <input className="campo" name="nome" placeholder="Nome do novo perfil (ex.: Gerente de loja)" aria-label="Nome do novo perfil" required />
          <button className="botao" type="submit">Criar perfil</button>
        </form>
      )}
    </>
  );
}
