import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataHoraBR } from "@/lib/formatar";
import { ROTULO_AREA, type Area } from "@/lib/areas";
import { enviarRecado } from "@/app/acoes/os";

/** Recados no card da OS: a loja e o laboratório conversam ali, cada um na sua tela. */
export async function RecadosOS({ osId }: { osId: string }) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("os_mensagens")
    .select("id, texto, area, criado_em, usuarios(nome)")
    .eq("os_id", osId)
    .order("criado_em")
    .returns<{ id: string; texto: string; area: Area | null; criado_em: string; usuarios: { nome: string } | null }[]>();

  return (
    <section className="bloco">
      <h2>Recados</h2>
      {(data ?? []).length === 0 && <p className="vazio">Nenhum recado. Use para combinar detalhes entre a loja e o laboratório.</p>}
      <div className="recados">
        {(data ?? []).map((m) => (
          <p key={m.id} className={`recado recado-${m.area ?? "loja"}`}>
            <small>{m.usuarios?.nome ?? "?"} · {m.area ? ROTULO_AREA[m.area] : ""} · {dataHoraBR(m.criado_em)}</small>
            {m.texto}
          </p>
        ))}
      </div>
      <form action={enviarRecado.bind(null, osId)} className="linha">
        <input className="campo" name="texto" maxLength={1000} placeholder="Escreva um recado" aria-label="Novo recado" required />
        <button className="botao" type="submit">Enviar</button>
      </form>
    </section>
  );
}
