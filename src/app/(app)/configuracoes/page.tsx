import { criarClienteServidor } from "@/lib/supabase/servidor";
import { Abas } from "./abas";
import { criarLoja, salvarOtica } from "./actions";

export default async function ConfigOtica({ searchParams }: { searchParams: Promise<{ erro?: string; ok?: string }> }) {
  const { erro, ok } = await searchParams;
  const supabase = await criarClienteServidor();
  const [oticaR, lojasR] = await Promise.all([
    supabase.from("oticas").select("*").maybeSingle(),
    supabase.from("lojas").select("id, nome, telefone, endereco, ativa").order("criado_em"),
  ]);
  const o = oticaR.data;
  if (!o) return <p>Ótica não encontrada.</p>;

  return (
    <>
      <h1>Configurações</h1>
      <Abas atual="/configuracoes" />
      {erro && <p className="erro" role="alert">{erro}</p>}
      {ok && <p className="ok" role="status">Salvo.</p>}

      <form action={salvarOtica} className="bloco formulario-largo">
        <h2>Dados da ótica</h2>
        <div className="linha">
          <label className="rotulo">Nome<input className="campo" name="nome" defaultValue={o.nome} required /></label>
          <label className="rotulo">CNPJ<input className="campo" name="cnpj" defaultValue={o.cnpj ?? ""} /></label>
          <label className="rotulo">Telefone<input className="campo" name="telefone" defaultValue={o.telefone ?? ""} /></label>
        </div>
        <p className="vazio">Plano Vitra (tudo incluído) · situação: {o.status}. Adicionais (nota fiscal, lojas extras) são contratados com o suporte do Vitra.</p>

        <h2>Site institucional</h2>
        <p className="vazio">
          {o.slug
            ? <>Endereço: <a href={`/site/${o.slug}`} target="_blank" rel="noreferrer">/site/{o.slug}</a> (o domínio próprio é ligado pelo suporte).</>
            : "O endereço do site ainda não foi definido. Peça ao suporte do Vitra."}
        </p>
        <label className="marcar"><input type="checkbox" name="site_publicado" defaultChecked={o.site_publicado} /> Site publicado</label>
        <label className="rotulo">Frase de destaque<input className="campo" name="site_titulo" defaultValue={o.site_titulo ?? ""} placeholder="Óculos e lentes com atendimento de verdade" /></label>
        <label className="rotulo">Sobre a ótica<textarea className="campo" name="site_sobre" rows={4} defaultValue={o.site_sobre ?? ""} /></label>
        <div className="linha">
          <label className="rotulo">Endereço<input className="campo" name="site_endereco" defaultValue={o.site_endereco ?? ""} /></label>
          <label className="rotulo">WhatsApp do site<input className="campo" name="site_whatsapp" defaultValue={o.site_whatsapp ?? ""} inputMode="tel" /></label>
        </div>
        <div className="linha">
          <label className="rotulo">Horário de funcionamento<textarea className="campo" name="site_horario" rows={2} defaultValue={o.site_horario ?? ""} placeholder={"Seg a sex 9h às 18h\nSáb 9h às 13h"} /></label>
          <label className="rotulo">Instagram<input className="campo" name="site_instagram" defaultValue={o.site_instagram ?? ""} placeholder="@oticaomega" /></label>
          <label className="rotulo">Cor principal<input className="campo" type="color" name="site_cor" defaultValue={o.site_cor ?? "#0f6e64"} /></label>
        </div>
        <div className="janela-botoes"><button className="botao" type="submit">Salvar</button></div>
      </form>

      <section className="bloco">
        <h2>Lojas</h2>
        {(lojasR.data ?? []).map((l) => (
          <div key={l.id} className="linha-valor">
            <span><strong>{l.nome}</strong> {l.endereco ? `· ${l.endereco}` : ""}</span>
            <span>{l.ativa ? "ativa" : "inativa"}</span>
          </div>
        ))}
        <form action={criarLoja} className="linha">
          <input className="campo" name="nome" placeholder="Nome da loja" aria-label="Nome da loja" required />
          <input className="campo" name="telefone" placeholder="Telefone" aria-label="Telefone" />
          <input className="campo" name="endereco" placeholder="Endereço" aria-label="Endereço" />
          <button className="botao-secundario" type="submit">Adicionar loja</button>
        </form>
        <small className="vazio">O plano inclui uma loja. Cada loja extra é um adicional.</small>
      </section>
    </>
  );
}
