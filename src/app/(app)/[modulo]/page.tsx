import { notFound } from "next/navigation";
import { MENU } from "@/lib/permissoes";

/** Módulos do menu que ainda não têm tela própria. */
export default async function ModuloEmConstrucao({
  params,
}: {
  params: Promise<{ modulo: string }>;
}) {
  const { modulo } = await params;
  const item = MENU.find((m) => m.href === `/${modulo}`);
  if (!item) notFound();

  return (
    <>
      <h1>{item.rotulo}</h1>
      <p className="subtitulo">Esta tela ainda está em construção.</p>
    </>
  );
}
