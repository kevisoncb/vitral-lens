import type { Metadata } from "next";
import Link from "next/link";
import { FormularioLista } from "./_vitral/formulario-lista";

export const metadata: Metadata = {
  title: "Vitral · sistema para óticas",
  description: "Consultório, loja e laboratório da sua ótica num fluxo só. Plano único de R$ 99 por mês.",
};

const AREAS = [
  {
    titulo: "Consultório",
    texto: "Fila do dia, exame com anamnese, acuidade e refração. Concluiu, a receita está pronta e o cliente aparece no balcão.",
  },
  {
    titulo: "Loja",
    texto: "Funil de vendas com orçamento, sinal e saldo. Recebeu o pagamento, a ordem de serviço nasce sozinha com a ficha técnica preenchida.",
  },
  {
    titulo: "Laboratório",
    texto: "Quadro de produção ao vivo, sem preços e sem cadastro de clientes. Chegou na loja, o balcão avisa o cliente pelo WhatsApp.",
  },
];

const VANTAGENS = [
  "Nada de redigitar: a receita vira orçamento, que vira ordem de serviço.",
  "Cada pessoa com seu login e só o que o perfil dela pode ver.",
  "Funciona no computador, no tablet e no celular.",
  "Site da ótica com pedido de orçamento e agendamento online.",
  "Clientes que não voltaram aparecem sozinhos para você chamar.",
  "Dados de saúde protegidos conforme a LGPD.",
];

/** Site do Vitral (quem está logado vai direto para o sistema, pelo middleware). */
export default function SiteDoVitral() {
  return (
    <div className="site">
      <header className="site-topo">
        <strong>Vitral</strong>
        <nav aria-label="Site do Vitral">
          <a href="#como-funciona">Como funciona</a>
          <a href="#preco">Preço</a>
          <a href="#lista">Lista de espera</a>
          <Link href="/login">Entrar</Link>
        </nav>
      </header>

      <section className="site-hero">
        <h1>Consultório, loja e laboratório da sua ótica num fluxo só.</h1>
        <p style={{ margin: 0, maxWidth: 640, lineHeight: 1.6, fontSize: 18 }}>
          Do exame à entrega do óculos, cada área com a sua tela e os cards passando de uma para outra em tempo real.
          Feito para óticas pequenas, que não têm tempo a perder.
        </p>
        <div className="site-hero-acoes">
          <a className="botao" href="#lista" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Entrar na lista de espera</a>
          <Link className="botao-secundario" href="/login" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Já sou cliente</Link>
        </div>
      </section>

      <section className="site-bloco" id="como-funciona">
        <h2>Como funciona</h2>
        <div className="site-grade">
          {AREAS.map((a, i) => (
            <div key={a.titulo}>
              <strong style={{ fontSize: 18 }}>{i + 1}. {a.titulo}</strong>
              <p>{a.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="site-bloco">
        <h2>O que muda no dia a dia</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, lineHeight: 1.5 }}>
          {VANTAGENS.map((v) => <li key={v}>{v}</li>)}
        </ul>
      </section>

      <section className="site-bloco" id="preco">
        <h2>Preço</h2>
        <p style={{ fontSize: 32, fontWeight: 700 }}>R$ 99<span style={{ fontSize: 16, fontWeight: 500 }}> por mês</span></p>
        <p>
          Plano único com tudo incluído: consultório, vendas, laboratório, agenda, clientes e receitas, catálogo,
          relatórios, site da ótica e usuários à vontade. Adicionais só para quem precisa: emissão de nota fiscal e lojas extras.
        </p>
      </section>

      <section className="site-bloco" id="lista">
        <h2>Lista de espera</h2>
        <p>Estamos abrindo aos poucos, uma ótica de cada vez, com a implantação feita junto com você. Deixe seu contato.</p>
        <FormularioLista />
      </section>

      <footer className="site-rodape">Vitral · sistema para óticas</footer>
    </div>
  );
}
