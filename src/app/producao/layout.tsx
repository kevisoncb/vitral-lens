import { exigirArea } from "@/lib/sessao";
import { BarraArea } from "@/components/barra-area";

/** Tela do laboratório: só produção. Ninguém daqui vê vendas, valores ou o cadastro de clientes. */
export default async function LayoutProducao({ children }: { children: React.ReactNode }) {
  const sessao = await exigirArea("laboratorio");
  const gerente = sessao.area === "gestao" || sessao.pode("laboratorio", "excluir");
  const abas = [{ href: "/producao", rotulo: "Quadro de produção" }];
  if (gerente) abas.push({ href: "/producao/indicadores", rotulo: "Indicadores do laboratório" });

  return (
    <div className="area">
      <BarraArea sessao={sessao} titulo="Laboratório" abas={abas} />
      <main className="area-conteudo">{children}</main>
    </div>
  );
}
