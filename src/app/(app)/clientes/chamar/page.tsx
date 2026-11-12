import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/servidor";
import { exigirArea } from "@/lib/sessao";
import { linkWhatsApp, mensagemChamar, ROTULO_MOTIVO, type MotivoChamar } from "@/lib/whatsapp";
import { BotaoChamar } from "./botao-chamar";

const ORDEM: MotivoChamar[] = ["aniversario", "receita_vencendo", "oculos_um_ano", "orcamento_perdido"];
const EXPLICA: Record<MotivoChamar, string> = {
  aniversario: "Fazem aniversário hoje ou nos próximos 7 dias.",
  receita_vencendo: "A última receita vence nos próximos 30 dias ou venceu há menos de 60: hora de um exame novo.",
  oculos_um_ano: "Levaram óculos há cerca de 1 ano e não voltaram a comprar.",
  orcamento_perdido: "Orçamento perdido entre 1 e 6 meses atrás: vale uma nova tentativa.",
};

/** Quem a loja deve chamar hoje, por motivo, com o WhatsApp pronto. */
export default async function ClientesParaChamar({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const sessao = await exigirArea("loja", "gestao");
  const { motivo } = await searchParams;
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("clientes_para_chamar", {});
  const lista = (data ?? []) as { cliente_id: string; nome: string; telefone: string; motivo: MotivoChamar; detalhe: string; quando: string }[];
  const filtro = ORDEM.includes(motivo as MotivoChamar) ? (motivo as MotivoChamar) : null;
  const contagem = Object.fromEntries(ORDEM.map((m) => [m, lista.filter((l) => l.motivo === m).length])) as Record<MotivoChamar, number>;
  const mostrados = ORDEM.filter((m) => !filtro || m === filtro);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Clientes para chamar</h1>
          <p className="subtitulo">Quem vale a pena procurar hoje. Clique em chamar: o WhatsApp abre com a mensagem pronta e o cliente sai da lista.</p>
        </div>
      </div>
      {error && <p className="erro" role="alert">{error.message}</p>}

      <nav className="abas" aria-label="Motivo">
        <Link href="/clientes/chamar" aria-current={!filtro ? "page" : undefined}>Todos ({lista.length})</Link>
        {ORDEM.map((m) => (
          <Link key={m} href={`/clientes/chamar?motivo=${m}`} aria-current={filtro === m ? "page" : undefined}>
            {ROTULO_MOTIVO[m]} ({contagem[m]})
          </Link>
        ))}
      </nav>

      {lista.length === 0 && !error && <p className="vazio">Ninguém para chamar hoje. A lista se atualiza sozinha todo dia.</p>}

      {mostrados.map((m) => {
        const doMotivo = lista.filter((l) => l.motivo === m);
        if (doMotivo.length === 0) return null;
        return (
          <section key={m} className="bloco">
            <h2>{ROTULO_MOTIVO[m]}</h2>
            <small className="vazio">{EXPLICA[m]}</small>
            {doMotivo.map((c) => (
              <div key={`${c.cliente_id}-${m}`} className="linha-chamar">
                <span>
                  <Link href={`/clientes/${c.cliente_id}`} style={{ fontWeight: 600 }}>{c.nome}</Link>
                  <small className="vazio" style={{ display: "block" }}>{c.detalhe} · {c.telefone}</small>
                </span>
                <BotaoChamar clienteId={c.cliente_id} motivo={m} link={linkWhatsApp(c.telefone, mensagemChamar(m, c.nome, sessao.oticaNome))} />
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}
