// matriz.js — algebra 4x4 para o motor 3D. Coluna-maior, igual ao WebGL.
//
// Escrito na mao porque o projeto inteiro nao tem dependencia, e porque
// mat4 e um exercicio de meia pagina que a gente usa milhares de vezes por
// segundo — vale saber exatamente o que esta rodando ali.

export function identidade(o = new Float32Array(16)) {
  o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
  o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
  o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
  o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
  return o;
}

export function multiplica(a, b, o = new Float32Array(16)) {
  const r = o === a || o === b ? new Float32Array(16) : o;
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    r[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    r[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    r[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    r[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  if (r !== o) o.set(r);
  return o;
}

export function perspectiva(fovGraus, aspecto, perto, longe, o = new Float32Array(16)) {
  const f = 1 / Math.tan((fovGraus * Math.PI) / 360);
  o.fill(0);
  o[0] = f / aspecto;
  o[5] = f;
  o[10] = (longe + perto) / (perto - longe);
  o[11] = -1;
  o[14] = (2 * longe * perto) / (perto - longe);
  return o;
}

export function olhar(olho, alvo, cima, o = new Float32Array(16)) {
  let zx = olho[0] - alvo[0], zy = olho[1] - alvo[1], zz = olho[2] - alvo[2];
  let n = Math.hypot(zx, zy, zz) || 1;
  zx /= n; zy /= n; zz /= n;
  let xx = cima[1] * zz - cima[2] * zy;
  let xy = cima[2] * zx - cima[0] * zz;
  let xz = cima[0] * zy - cima[1] * zx;
  n = Math.hypot(xx, xy, xz) || 1;
  xx /= n; xy /= n; xz /= n;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
  o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
  o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
  o[12] = -(xx * olho[0] + xy * olho[1] + xz * olho[2]);
  o[13] = -(yx * olho[0] + yy * olho[1] + yz * olho[2]);
  o[14] = -(zx * olho[0] + zy * olho[1] + zz * olho[2]);
  o[15] = 1;
  return o;
}

export function transladar(m, x, y, z) {
  m[12] += m[0] * x + m[4] * y + m[8] * z;
  m[13] += m[1] * x + m[5] * y + m[9] * z;
  m[14] += m[2] * x + m[6] * y + m[10] * z;
  return m;
}

export function escalar(m, x, y = x, z = x) {
  m[0] *= x; m[1] *= x; m[2] *= x; m[3] *= x;
  m[4] *= y; m[5] *= y; m[6] *= y; m[7] *= y;
  m[8] *= z; m[9] *= z; m[10] *= z; m[11] *= z;
  return m;
}

function girar(m, rad, ax, ay, az) {
  const s = Math.sin(rad), c = Math.cos(rad), t = 1 - c;
  const b = [
    ax * ax * t + c, ay * ax * t + az * s, az * ax * t - ay * s, 0,
    ax * ay * t - az * s, ay * ay * t + c, az * ay * t + ax * s, 0,
    ax * az * t + ay * s, ay * az * t - ax * s, az * az * t + c, 0,
    0, 0, 0, 1,
  ];
  return multiplica(m, b, m);
}

export const girarX = (m, r) => girar(m, r, 1, 0, 0);
export const girarY = (m, r) => girar(m, r, 0, 1, 0);
export const girarZ = (m, r) => girar(m, r, 0, 0, 1);

export function inverte(a, o = new Float32Array(16)) {
  const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4];
  const b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5];
  const b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6];
  const b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12];
  const b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13];
  const b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return identidade(o);
  det = 1 / det;
  o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * det;
  o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * det;
  o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * det;
  o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * det;
  o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * det;
  o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * det;
  o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * det;
  o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * det;
  o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * det;
  o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * det;
  o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * det;
  o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * det;
  o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * det;
  o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * det;
  o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * det;
  o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * det;
  return o;
}

export function transpoe(a, o = new Float32Array(16)) {
  const t = [a[0], a[4], a[8], a[12], a[1], a[5], a[9], a[13], a[2], a[6], a[10], a[14], a[3], a[7], a[11], a[15]];
  o.set(t);
  return o;
}

// Ponto do mundo -> pixel na tela. E o que permite saber se o mouse esta em
// cima de uma placa 3D sem lancar raio nenhum: projeta os quatro cantos e
// testa o ponto dentro do quadrilatero.
export function projetar(m, x, y, z, largura, altura, saida = {}) {
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  saida.atras = cw <= 0.0001;
  const w = saida.atras ? 0.0001 : cw;
  saida.x = (cx / w * 0.5 + 0.5) * largura;
  saida.y = (0.5 - cy / w * 0.5) * altura;
  saida.w = w;
  return saida;
}

export function dentroDoQuadrilatero(px, py, q) {
  let dentro = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const xi = q[i].x, yi = q[i].y, xj = q[j].x, yj = q[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

// Ponto local -> mundo. Usado para achar os cantos de uma placa e saber se
// o mouse esta em cima dela.
export function transformaPonto(m, x, y, z, o = {}) {
  o.x = m[0] * x + m[4] * y + m[8] * z + m[12];
  o.y = m[1] * x + m[5] * y + m[9] * z + m[13];
  o.z = m[2] * x + m[6] * y + m[10] * z + m[14];
  return o;
}
