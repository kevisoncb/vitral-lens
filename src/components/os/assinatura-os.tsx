import { headers } from "next/headers";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { pedirAssinatura } from "@/app/acoes/os";
import { dataBR, dataHoraBR } from "@/lib/formatar";
import { linkWhatsApp } from "@/lib/whatsapp";

/** Bloco da OS na loja: pedir a assinatura do cliente pelo link, mandar no WhatsApp e ver a assinatura feita. */
export async function AssinaturaOS({ osId, clienteId, clienteNome, oticaNome, podePedir }: {
  osId: string; clienteId: string; clienteNome: string; oticaNome: string; podePedir: boolean;
}) {
  const supabase = await criarClienteServidor();
  const { data: lista } = await supabase
    .from("os_assinaturas")
    .select("token, expira_em, assinada_em, nome_assinante, assinatura, ip")
    .eq("os_id", osId)
    .order("criado_em", { ascending: false })
    .limit(5);
  const assinada = (lista ?? []).find((a) => a.assinada_em);
  const pendente = (lista ?? []).find((a) => !a.assinada_em && new Date(a.expira_em) > new Date());

  let zap: string | null = null;
  let endereco: string | null = null;
  if (pendente) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    endereco = `${protocolo}://${host}/assinar/${pendente.token}`;
    const { data: c } = await supabase.from("clientes").select("telefone").eq("id", clienteId).maybeSingle();
    const primeiro = clienteNome.split(" ")[0];
    zap = linkWhatsApp(c?.telefone, `Olá ${primeiro}, aqui é da ${oticaNome}. Confira os dados dos seus óculos (receita, lentes, prazo e valor) e assine por este link: ${endereco}`);
  }

  return (
    <section className="bloco">
      <h2>Assinatura do cliente</h2>
      {assinada ? (
        <>
          <p className="ok" role="status">Conferida e assinada por {assinada.nome_assinante} em {dataHoraBR(assinada.assinada_em!)}.</p>
          {assinada.assinatura && <img className="assinatura-feita" src={assinada.assinatura} alt={`Assinatura de ${assinada.nome_assinante}`} />}
          {assinada.ip && <small className="vazio">Assinado pelo celular do cliente (IP {assinada.ip}).</small>}
        </>
      ) : pendente ? (
        <>
          <p>O link está pronto e vale até {dataBR(pendente.expira_em)}. Mande para o cliente conferir e assinar no celular.</p>
          <div className="linha" style={{ gap: 12 }}>
            {zap && <a className="botao" href={zap} target="_blank" rel="noreferrer">Mandar no WhatsApp</a>}
            {endereco && <a className="botao-secundario" href={endereco} target="_blank" rel="noreferrer">Abrir o link</a>}
          </div>
          {endereco && <input className="campo" readOnly value={endereco} aria-label="Link para assinar" />}
        </>
      ) : podePedir ? (
        <form action={pedirAssinatura.bind(null, osId)} className="linha" style={{ gap: 12 }}>
          <p className="vazio" style={{ flex: "1 1 260px" }}>O cliente confere receita, lentes, armação, prazo e valor pelo celular e assina com o dedo. Evita o “não foi isso que eu pedi”.</p>
          <button className="botao" type="submit">Pedir assinatura do cliente</button>
        </form>
      ) : (
        <p className="vazio">Ainda não assinada.</p>
      )}
    </section>
  );
}
