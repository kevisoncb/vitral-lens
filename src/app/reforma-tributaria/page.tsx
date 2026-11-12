import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reforma tributária para óticas · Vitral",
  description: "O que muda em janeiro de 2027 para a ótica do Simples Nacional: CBS, IBS, nota fiscal e a escolha do Simples híbrido, explicado sem juridiquês.",
};

const ATUALIZADO = "4 de novembro de 2026";

// Linha do tempo da transição (EC 132/2023 e LC 214/2025), conforme as fontes no fim da página.
const LINHA_DO_TEMPO = [
  { ano: "2026", texto: "Ano de teste. A CBS e o IBS começam a aparecer nas notas, com alíquotas de teste, para empresas e sistemas se ajustarem." },
  { ano: "2027", texto: "A CBS (federal) passa a ser cobrada de verdade e substitui PIS e Cofins, que acabam. O IPI fica zerado para quase tudo (fica só o que concorre com a Zona Franca de Manaus) e começa o Imposto Seletivo, sobre produtos prejudiciais à saúde e ao meio ambiente. O IBS segue simbólico: 0,1%." },
  { ano: "2028", texto: "Igual a 2027. ICMS e ISS continuam como hoje." },
  { ano: "2029 a 2032", texto: "Troca gradual: o IBS sobe e o ICMS e o ISS caem na mesma proporção, 10% por ano (10%, 20%, 30% e 40%)." },
  { ano: "2033", texto: "Fim do ICMS e do ISS. Ficam CBS (federal) e IBS (estados e municípios), o chamado IVA dual." },
];

const FONTES = [
  { nome: "Câmara dos Deputados: reforma começa a transição com testes em 2026", url: "https://www.camara.leg.br/noticias/1237089-reforma-tributaria-comeca-fase-de-transicao-com-testes-de-novos-impostos-em-2026/" },
  { nome: "Senado: TCU calcula alíquota da CBS em 11,3% para 2027 (28/10/2026)", url: "https://www12.senado.leg.br/noticias/materias/2026/10/28/reforma-tributaria-tcu-calcula-aliquota-da-cbs-em-11-3-para-2027" },
  { nome: "Secretaria de Economia do DF: cronograma da reforma", url: "https://www.economia.df.gov.br/reforma-tributaria" },
  { nome: "Sefaz Amazonas: cronograma de implantação", url: "https://www.sefaz.am.gov.br/noticias/31733" },
  { nome: "Portal do Simples Nacional: CGSN atualiza regras para a reforma (12/08/2026)", url: "https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/NoticiaCompleta.aspx?id=e595d010-1e04-4c3b-95d9-185fc58594b5" },
  { nome: "Portal do Simples Nacional: roteiro da opção para 2027", url: "https://www8.receita.fazenda.gov.br/SimplesNacional/Noticias/NoticiaCompleta.aspx?id=bff8b291-7a89-42fa-94e7-8cacfd617f25" },
  { nome: "Ministério da Fazenda: reforma tributária (LC 214/2025)", url: "https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria" },
];

/** Guia da reforma tributária para donos de ótica (página pública: também atrai óticas para o Vitral). */
export default function ReformaTributaria() {
  return (
    <div className="site guia">
      <header className="site-topo">
        <Link href="/" style={{ textDecoration: "none" }}><strong>Vitral</strong></Link>
        <nav aria-label="Guia">
          <a href="#linha-do-tempo">Linha do tempo</a>
          <a href="#simples">Simples Nacional</a>
          <a href="#nota-fiscal">Nota fiscal</a>
          <a href="#o-que-fazer">O que fazer agora</a>
        </nav>
      </header>

      <section className="site-hero">
        <p className="guia-selo">Atualizado em {ATUALIZADO}</p>
        <h1>Reforma tributária: o que muda para a sua ótica em janeiro de 2027</h1>
        <p style={{ margin: 0, maxWidth: 680, lineHeight: 1.6, fontSize: 18 }}>
          Em uma frase: a partir de janeiro, PIS e Cofins dão lugar à CBS, a nota fiscal passa a mostrar os novos impostos e, se a sua ótica é do Simples
          Nacional, ela continua no Simples, mas precisa decidir com o contador como vai recolher os novos tributos.
        </p>
      </section>

      <section className="site-bloco" id="linha-do-tempo">
        <h2>Linha do tempo</h2>
        <p>A troca dos impostos sobre o consumo acontece aos poucos, de 2026 a 2033. Os nomes novos:</p>
        <ul className="guia-lista">
          <li><strong>CBS</strong> (Contribuição sobre Bens e Serviços): federal. Substitui PIS e Cofins.</li>
          <li><strong>IBS</strong> (Imposto sobre Bens e Serviços): de estados e municípios. Substitui, aos poucos, o ICMS e o ISS.</li>
          <li><strong>Imposto Seletivo</strong>: cobrado sobre produtos prejudiciais à saúde e ao meio ambiente.</li>
        </ul>
        <ol className="guia-tempo">
          {LINHA_DO_TEMPO.map((l) => (
            <li key={l.ano}><strong>{l.ano}</strong><span>{l.texto}</span></li>
          ))}
        </ol>
        <p className="guia-pendente">
          <strong>Ainda em aberto:</strong> a alíquota da CBS para 2027. O TCU propôs 11,3% em 28/10/2026, e o Senado tem até dezembro para confirmar; se não
          confirmar, vale a do TCU. Peça ao contador para refazer as contas da ótica quando o número sair.
        </p>
      </section>

      <section className="site-bloco" id="simples">
        <h2>Minha ótica é do Simples Nacional. E agora?</h2>
        <p><strong>O Simples continua.</strong> A CBS e o IBS passam a fazer parte dos tributos do Simples, cobrados no mesmo DAS de hoje. Quem não fizer nada continua assim.</p>
        <p>
          A novidade é o <strong>Simples híbrido</strong>: a ótica continua no Simples, mas paga CBS e IBS por fora do DAS, pelas regras do regime regular.
          A vantagem é que o cliente que é empresa aproveita crédito desses impostos. Para ótica, que vende quase só para pessoa física, ficar com tudo no DAS
          costuma ser o mais simples, mas a conta é do contador: depende das compras, dos clientes e da margem.
        </p>
        <div className="guia-prazos">
          <h3>Prazos da escolha para 2027</h3>
          <ul className="guia-lista">
            <li><strong>Para janeiro a junho de 2027:</strong> a escolha foi de 1º a 30 de setembro de 2026 (já fechou). Quem optou pelo híbrido pode desistir até <strong>30 de novembro de 2026</strong> (o Comitê Gestor pode adiar essa data).</li>
            <li><strong>Para julho a dezembro de 2027:</strong> nova janela de <strong>1º a 31 de março de 2027</strong>, com desistência até 31 de maio.</li>
            <li>A escolha vale para os semestres seguintes até a ótica desistir num desses prazos.</li>
          </ul>
        </div>
        <p>Outras mudanças do Simples em 2027: a receita passa a ser ligada às notas emitidas, e a Defis deixa de ser uma declaração separada (vai no PGDAS-D, de janeiro a março).</p>
      </section>

      <section className="site-bloco" id="nota-fiscal">
        <h2>Nota fiscal: o que muda na prática</h2>
        <ul className="guia-lista">
          <li><strong>Emita nota de toda venda.</strong> No Simples, a partir de 2027, a receita passa a ser ligada aos documentos fiscais emitidos. Venda sem nota fica fora do controle e vira problema.</li>
          <li><strong>Cada produto precisa dos dados fiscais certos:</strong> NCM (armações começam com 9003, óculos de sol com 9004, lentes com 9001), origem, CSOSN e a nova <strong>classificação tributária do IBS e da CBS</strong> (cClassTrib), que a nota passa a pedir.</li>
          <li><strong>A nota mostra os novos impostos.</strong> O emissor (no Vitral, a integração de nota fiscal) é quem monta os campos novos; o seu papel é ter o cadastro do produto certo.</li>
        </ul>
      </section>

      <section className="site-bloco" id="o-que-fazer">
        <h2>O que fazer agora (checklist)</h2>
        <ol className="guia-lista">
          <li><strong>Até 30/11/2026:</strong> confirme com o contador se a ótica fica com CBS e IBS dentro do DAS ou no híbrido (e se precisa desistir de uma escolha feita em setembro).</li>
          <li><strong>Revise o NCM e o CSOSN dos produtos</strong> e peça ao contador a classificação do IBS/CBS (cClassTrib) das armações, lentes e acessórios.</li>
          <li><strong>Garanta que toda venda sai com nota</strong>, inclusive sinal e saldo de óculos de grau.</li>
          <li><strong>Revise preços e margens</strong> quando a alíquota da CBS for confirmada (dezembro).</li>
          <li><strong>Marque março de 2027</strong> na agenda: é a próxima janela para mudar a escolha.</li>
        </ol>
      </section>

      <section className="site-bloco">
        <h2>Como o Vitral ajuda</h2>
        <ul className="guia-lista">
          <li>Cadastro do produto com NCM, CEST, origem, CFOP, CSOSN e a classificação do IBS/CBS.</li>
          <li>Entrada de mercadoria pelo XML da nota do fornecedor, que já traz NCM, CEST, origem, custo, frete e impostos da compra.</li>
          <li>Financeiro com os impostos do mês e a exportação para o contador.</li>
          <li>Emissão de nota fiscal ao consumidor (NFC-e) direto do caixa.</li>
        </ul>
        <p><Link href="/#lista">Quero conhecer o Vitral</Link></p>
      </section>

      <section className="site-bloco">
        <h2>Fontes</h2>
        <p className="guia-pendente">
          Este guia resume a lei e as notícias oficiais para donos de ótica, com data. Não substitui o contador: regras, prazos e alíquotas podem mudar, e a
          escolha do regime depende da situação de cada empresa.
        </p>
        <ul className="guia-lista guia-fontes">
          {FONTES.map((f) => (
            <li key={f.url}><a href={f.url} target="_blank" rel="noopener noreferrer">{f.nome}</a></li>
          ))}
        </ul>
      </section>

      <footer className="site-rodape">Vitral · sistema para óticas · guia atualizado em {ATUALIZADO}</footer>
    </div>
  );
}
