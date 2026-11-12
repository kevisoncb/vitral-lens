import { criarClienteServidor } from "@/lib/supabase/servidor";
import { dataHoraBR } from "@/lib/formatar";
import { linkWhatsApp } from "@/lib/whatsapp";

/** Quem se inscreveu no site do Vitral. O contato é pelo WhatsApp, com a mensagem pronta. */
export default async function ListaDeEspera() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("painel_lista_espera");
  const inscritos = data ?? [];

  return (
    <>
      <div>
        <h1>Lista de espera</h1>
        <p className="subtitulo">{inscritos.length} {inscritos.length === 1 ? "ótica inscrita" : "óticas inscritas"} pelo site do Vitral, das mais novas para as mais antigas.</p>
      </div>
      <section className="bloco">
        {inscritos.length > 0 ? (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Quando</th><th>Ótica</th><th>Contato</th><th>Cidade</th><th className="numero">Lojas</th><th /></tr>
              </thead>
              <tbody>
                {inscritos.map((i) => {
                  const zap = linkWhatsApp(i.telefone, `Olá ${i.nome.split(" ")[0]}, aqui é do Vitral! Você se inscreveu na lista de espera com a ${i.otica_nome}. Podemos conversar sobre a implantação?`);
                  return (
                    <tr key={i.id}>
                      <td>{dataHoraBR(i.criado_em)}</td>
                      <td><strong>{i.otica_nome}</strong></td>
                      <td>{i.nome}<br /><small className="vazio">{i.telefone}{i.email ? ` · ${i.email}` : ""}</small></td>
                      <td>{[i.cidade, i.uf].filter(Boolean).join(" / ") || "—"}</td>
                      <td className="numero">{i.lojas ?? "—"}</td>
                      <td>{zap && <a href={zap} target="_blank" rel="noopener noreferrer">Chamar no WhatsApp</a>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="vazio">Ninguém se inscreveu ainda.</p>
        )}
      </section>
    </>
  );
}
