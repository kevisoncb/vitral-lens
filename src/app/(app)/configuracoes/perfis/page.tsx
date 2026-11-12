import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import type { Permissoes } from "@/lib/permissoes";
import { ROTULO_AREA, type Area } from "@/lib/areas";
import { Abas } from "../abas";
import { criarPerfil, salvarPerfil } from "./actions";
import { ACOES, MODULOS_CONFIGURAVEIS } from "./modulos";

export default async function ConfigPerfis({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const { data: perfis } = await supabase.from("perfis").select("id, chave, nome, area, permissoes").order("nome");
  const podeEditar = sessao?.pode("usuarios", "editar") ?? false;

  return (
    <>
      <h1>Configurações</h1>
      <Abas atual="/configuracoes/perfis" />
      <p className="subtitulo">
        A <strong>área</strong> decide a tela que a pessoa vê ao entrar: Loja (balcão), Consultório, Laboratório ou Gestão (tudo).
        As caixas decidem o que ela pode fazer dentro dela.
      </p>
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">Salvo.</p>}

      {(perfis ?? []).map((p) => {
        const perm = (p.permissoes ?? {}) as Permissoes;
        const travado = !podeEditar || p.chave === "dono";
        return (
          <form key={p.id} action={salvarPerfil.bind(null, p.id)} className="bloco">
            <div className="linha">
              <input className="campo" name="nome" defaultValue={p.nome} disabled={travado} aria-label="Nome do perfil" style={{ fontWeight: 700 }} />
              <select className="campo" name="area" defaultValue={p.area} disabled={travado} aria-label="Área do perfil">
                {(Object.keys(ROTULO_AREA) as Area[]).map((a) => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}
              </select>
              {!travado && <button className="botao-secundario" type="submit">Salvar perfil</button>}
              {p.chave === "dono" && <small className="vazio">Acesso total, não editável.</small>}
            </div>
            <div className="matriz" role="table" aria-label={`Permissões de ${p.nome}`}>
              <div className="matriz-linha matriz-cabecalho" role="row">
                <span className="th" role="columnheader">Módulo</span>
                {ACOES.map((a) => <span key={a} className="th" role="columnheader">{a}</span>)}
              </div>
              {MODULOS_CONFIGURAVEIS.map(({ modulo, rotulo }) => (
                <div key={modulo} className="matriz-linha" role="row">
                  <span role="rowheader">{rotulo}</span>
                  {ACOES.map((a) => (
                    <span key={a} role="cell">
                      <input
                        type="checkbox"
                        name={`${modulo}:${a}`}
                        defaultChecked={perm[modulo]?.includes(a) ?? false}
                        disabled={travado}
                        aria-label={`${rotulo}: ${a}`}
                      />
                    </span>
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
          <select className="campo" name="area" defaultValue="loja" aria-label="Área do novo perfil">
            {(Object.keys(ROTULO_AREA) as Area[]).map((a) => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}
          </select>
          <button className="botao" type="submit">Criar perfil</button>
        </form>
      )}
    </>
  );
}
