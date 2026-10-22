export function Probe({ n, cats }: { n: number; cats: string[] }) {
  return (
    <div>
      {cats.length > 0 && (
        /* fila que se desliza con `shrink-0` y «comillas» —guion— */
        <div className="a">y</div>
      )}
      {n > 0 && (
        /* simple */
        <div className="b">z</div>
      )}
    </div>
  );
}
