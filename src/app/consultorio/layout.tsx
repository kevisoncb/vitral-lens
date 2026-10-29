import { exigirArea } from "@/lib/sessao";
import { BarraArea } from "@/components/barra-area";

/** Tela do consultório: fila do dia, exame e histórico do paciente. Nada de vendas ou valores. */
export default async function LayoutConsultorio({ children }: { children: React.ReactNode }) {
  const sessao = await exigirArea("consultorio");
  return (
    <div className="area">
      <BarraArea sessao={sessao} titulo="Consultório" abas={[{ href: "/consultorio", rotulo: "Fila do dia" }]} />
      <main className="area-conteudo">{children}</main>
    </div>
  );
}
