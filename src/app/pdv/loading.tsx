/** Aparece na hora em que se troca de tela, enquanto os dados chegam (sem tela branca). */
export default function Carregando() {
  return (
    <div className="esqueleto" aria-busy="true" aria-label="Carregando">
      <div className="esqueleto-titulo" />
      <div className="esqueleto-linha" />
      <div className="esqueleto-grade">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="esqueleto-bloco" />)}
      </div>
    </div>
  );
}
