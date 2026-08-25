// constricao.js — a mecanica que faz esta cobra ser um roguelike.
//
// Se o corpo da serpente fecha um espaco (sozinho ou usando parede), tudo
// que ficou dentro e esmagado. Nao e ataque com botao: e consequencia de
// como voce andou.
//
// Como se detecta: as celulas livres formam um grafo. Sem a cobra, esse
// grafo e conexo por construcao (a arena garante isso ao nascer). Logo,
// qualquer componente extra que aparecer foi a cobra que criou. O maior
// componente e o "lado de fora"; os outros estao cercados.
//
// A checagem "encostou na cobra?" evita contar bolsao feito so de parede —
// que pode surgir quando um chefe ergue muro no meio da sala.

export function acharCercados(arena, cobra) {
  const cols = arena.cols, rows = arena.rows, n = cols * rows;
  const marca = new Uint8Array(n);        // 0 livre, 1 cobra, 2 parede
  for (let i = 0; i < n; i++) if (arena.paredes[i] === 1) marca[i] = 2;
  for (const s of cobra.segmentos) {
    if (arena.dentro(s.cx, s.cy)) marca[s.cy * cols + s.cx] = 1;
  }

  const comp = new Int32Array(n).fill(-1);
  const componentes = [];
  const fila = new Int32Array(n);

  for (let inicio = 0; inicio < n; inicio++) {
    if (marca[inicio] !== 0 || comp[inicio] !== -1) continue;
    const id = componentes.length;
    let cabeca = 0, cauda = 0;
    fila[cauda++] = inicio;
    comp[inicio] = id;
    const celulas = [];
    let tocaCobra = false;
    while (cabeca < cauda) {
      const at = fila[cabeca++];
      celulas.push(at);
      const x = at % cols, y = (at / cols) | 0;
      for (let d = 0; d < 4; d++) {
        const nx = x + (d === 0 ? 1 : d === 1 ? -1 : 0);
        const ny = y + (d === 2 ? 1 : d === 3 ? -1 : 0);
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (marca[ni] === 1) { tocaCobra = true; continue; }
        if (marca[ni] === 2 || comp[ni] !== -1) continue;
        comp[ni] = id;
        fila[cauda++] = ni;
      }
    }
    componentes.push({ celulas, tocaCobra });
  }

  if (componentes.length < 2) return null;

  let maior = 0;
  for (let i = 1; i < componentes.length; i++) {
    if (componentes[i].celulas.length > componentes[maior].celulas.length) maior = i;
  }

  const cercadas = [];
  for (let i = 0; i < componentes.length; i++) {
    if (i === maior || !componentes[i].tocaCobra) continue;
    for (const c of componentes[i].celulas) cercadas.push(c);
  }
  if (!cercadas.length) return null;

  return {
    celulas: cercadas,
    contem(cx, cy) {
      const i = cy * cols + cx;
      return cercadas.includes(i);
    },
    conjunto: new Set(cercadas),
  };
}
