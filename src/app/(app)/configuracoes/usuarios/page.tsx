import { criarClienteServidor } from "@/lib/supabase/servidor";
import { obterSessao } from "@/lib/sessao";
import { Abas } from "../abas";
import { atualizarUsuario } from "./actions";
import { NovoUsuario } from "./novo-usuario";

export default async function ConfigUsuarios() {
  const sessao = await obterSessao();
  const supabase = await criarClienteServidor();
  const [usuariosR, perfisR, lojasR] = await Promise.all([
    supabase.from("usuarios").select("id, nome, email, ativo, perfil_id").order("nome"),
    supabase.from("perfis").select("id, nome").order("nome"),
    supabase.from("lojas").select("id, nome").eq("ativa", true).order("criado_em"),
  ]);
  const perfis = perfisR.data ?? [];
  const podeEditar = sessao?.pode("usuarios", "editar") ?? false;

  return (
    <>
      <h1>Configurações</h1>
      <Abas atual="/configuracoes/usuarios" />

      {sessao?.pode("usuarios", "criar") && (
        <section className="bloco">
          <h2>Novo funcionário</h2>
          <NovoUsuario perfis={perfis} lojas={lojasR.data ?? []} />
        </section>
      )}

      <section className="bloco">
        <h2>Equipe</h2>
        {(usuariosR.data ?? []).map((u) => (
          <form key={u.id} action={atualizarUsuario.bind(null, u.id)} className="linha">
            <span style={{ flex: "2 1 220px" }}>
              <strong>{u.nome}</strong>
              <br />
              <small className="vazio">{u.email}{u.id === sessao?.usuarioId ? " · você" : ""}</small>
            </span>
            <select className="campo" name="perfil_id" defaultValue={u.perfil_id} disabled={!podeEditar} aria-label="Perfil">
              {perfis.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            <label className="marcar">
              <input type="checkbox" name="ativo" defaultChecked={u.ativo} disabled={!podeEditar || u.id === sessao?.usuarioId} /> Ativo
            </label>
            {podeEditar && <button className="botao-secundario" type="submit">Salvar</button>}
          </form>
        ))}
        <small className="vazio">Funcionário que saiu: desmarque “Ativo”. O histórico dele continua guardado.</small>
      </section>
    </>
  );
}
