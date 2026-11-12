import { exigirArea } from "@/lib/sessao";
import { BarraArea } from "@/components/barra-area";

/** Tela do caixa: só vendas. Quem é do PDV não abre o funil, os clientes nem o financeiro. */
export default async function LayoutPdv({ children }: { children: React.ReactNode }) {
  const sessao = await exigirArea("pdv");
  const abas = [
    { href: "/pdv", rotulo: "Caixa" },
    { href: "/pdv/vendas", rotulo: "Vendas" },
  ];
  if (sessao.area === "gestao" || sessao.pode("pdv", "editar") || sessao.pode("financeiro")) {
    abas.push({ href: "/pdv/caixas", rotulo: "Caixas fechados" });
  }
  return (
    <div className="area">
      <BarraArea sessao={sessao} titulo="PDV" abas={abas} />
      <main className="area-conteudo">{children}</main>
    </div>
  );
}
