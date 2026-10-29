import { exigirArea } from "@/lib/sessao";
import { BarraArea } from "@/components/barra-area";

/** Tela do financeiro (gerente, financeiro e contador): contas, custos, impostos e exportação. */
export default async function LayoutFinanceiro({ children }: { children: React.ReactNode }) {
  const sessao = await exigirArea("financeiro");
  const abas = [
    { href: "/financeiro", rotulo: "Visão do mês" },
    { href: "/financeiro/pagar", rotulo: "Contas a pagar" },
    { href: "/financeiro/receber", rotulo: "Contas a receber" },
    { href: "/financeiro/categorias", rotulo: "Categorias de custo" },
  ];
  if (sessao.pode("pdv")) abas.push({ href: "/pdv/caixas", rotulo: "Caixas" });
  return (
    <div className="area">
      <BarraArea sessao={sessao} titulo="Financeiro" abas={abas} />
      <main className="area-conteudo">{children}</main>
    </div>
  );
}
