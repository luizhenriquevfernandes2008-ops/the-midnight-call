// motor3d.js — um motor 3D pequeno, escrito para este menu e mais nada.
//
// WebGL 1 puro: dois programas (malhas e pontos), luz direcional, luz de
// borda (rim), nevoa exponencial e textura vinda de canvas 2D. Nao tem
// sombra, nao tem PBR, nao precisa: o menu e feito de placas de pedra
// brilhando no escuro e de um anel de serpente girando no fundo.
//
// Alfa e premultiplicado no shader. Isso deixa a mesma passada servir para
// mistura normal (ONE, ONE_MINUS_SRC_ALPHA) e para aditiva (ONE, ONE) sem
// trocar de shader — que e como brasa e brilho sao desenhados por cima.

import * as M from './matriz.js';

const VS_MALHA = `
attribute vec3 aPos;
attribute vec3 aNor;
attribute vec2 aUV;
uniform mat4 uProj, uVista, uModelo, uNormal;
varying vec3 vNor, vMundo;
varying vec2 vUV;
void main() {
  vec4 mundo = uModelo * vec4(aPos, 1.0);
  vMundo = mundo.xyz;
  vNor = normalize((uNormal * vec4(aNor, 0.0)).xyz);
  vUV = aUV;
  gl_Position = uProj * uVista * mundo;
}`;

const FS_MALHA = `
precision mediump float;
varying vec3 vNor, vMundo;
varying vec2 vUV;
uniform vec3 uCor, uEmissao, uLuzDir, uLuzCor, uAmb, uNevoaCor, uOlho, uRimCor;
uniform float uAlfa, uNevoa, uRim, uUsaTex;
uniform sampler2D uTex;
void main() {
  vec3 N = normalize(vNor);
  vec3 V = normalize(uOlho - vMundo);
  float lam = max(dot(N, normalize(uLuzDir)), 0.0);
  float meia = lam * 0.75 + 0.25;
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5) * uRim;
  vec4 tex = vec4(1.0);
  if (uUsaTex > 0.5) tex = texture2D(uTex, vUV);
  vec3 base = uCor * tex.rgb;
  vec3 cor = base * (uAmb + uLuzCor * meia) + uEmissao * tex.a + uRimCor * rim;
  float d = length(uOlho - vMundo);
  float n = clamp(1.0 - exp(-uNevoa * d), 0.0, 1.0);
  cor = mix(cor, uNevoaCor, n);
  float a = uAlfa * (uUsaTex > 0.5 ? tex.a : 1.0);
  gl_FragColor = vec4(cor * a, a);
}`;

const VS_PONTOS = `
attribute vec3 aPos;
attribute vec3 aCor;
attribute float aTam;
attribute float aAlfa;
uniform mat4 uProj, uVista;
uniform float uEscala;
varying vec3 vCor;
varying float vAlfa;
void main() {
  vec4 p = uVista * vec4(aPos, 1.0);
  gl_Position = uProj * p;
  gl_PointSize = max(1.0, aTam * uEscala / max(0.25, -p.z));
  vCor = aCor;
  vAlfa = aAlfa;
}`;

const FS_PONTOS = `
precision mediump float;
varying vec3 vCor;
varying float vAlfa;
void main() {
  float d = length(gl_PointCoord - vec2(0.5));
  float a = smoothstep(0.5, 0.02, d) * vAlfa;
  gl_FragColor = vec4(vCor * a, a);
}`;

function compilar(gl, tipo, fonte) {
  const s = gl.createShader(tipo);
  gl.shaderSource(s, fonte);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(s));
  }
  return s;
}

function programa(gl, vs, fs, atributos, uniformes) {
  const p = gl.createProgram();
  gl.attachShader(p, compilar(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compilar(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('link: ' + gl.getProgramInfoLog(p));
  }
  const o = { p, a: {}, u: {} };
  for (const n of atributos) o.a[n] = gl.getAttribLocation(p, n);
  for (const n of uniformes) o.u[n] = gl.getUniformLocation(p, n);
  return o;
}

// ---------- geometria ----------

export function malhaCaixa() {
  const pos = [], nor = [], uv = [], idx = [];
  const faces = [
    [[1, 1, 1], [1, 1, -1], [1, -1, -1], [1, -1, 1], [1, 0, 0]],
    [[-1, 1, -1], [-1, 1, 1], [-1, -1, 1], [-1, -1, -1], [-1, 0, 0]],
    [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1], [0, 1, 0]],
    [[-1, -1, 1], [1, -1, 1], [1, -1, -1], [-1, -1, -1], [0, -1, 0]],
    [[-1, 1, 1], [1, 1, 1], [1, -1, 1], [-1, -1, 1], [0, 0, 1]],
    [[1, 1, -1], [-1, 1, -1], [-1, -1, -1], [1, -1, -1], [0, 0, -1]],
  ];
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  faces.forEach((f, i) => {
    const n = f[4];
    for (let v = 0; v < 4; v++) {
      pos.push(f[v][0] * 0.5, f[v][1] * 0.5, f[v][2] * 0.5);
      nor.push(n[0], n[1], n[2]);
      uv.push(uvs[v][0], uvs[v][1]);
    }
    // Ordem invertida de proposito: com a matriz de vista deste motor
    // (direita = cima x z_camera), a sequencia ingenua 0-1-2 sai horaria e
    // o WebGL descarta a face como se fosse o lado de dentro.
    const b = i * 4;
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  return { pos, nor, uv, idx };
}

export function malhaPlano() {
  return {
    pos: [-0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 0],
    nor: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    uv: [0, 0, 1, 0, 1, 1, 0, 1],
    idx: [0, 2, 1, 0, 3, 2],
  };
}

export function malhaEsfera(anelH = 12, anelV = 8) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let y = 0; y <= anelV; y++) {
    const v = y / anelV, phi = v * Math.PI;
    for (let x = 0; x <= anelH; x++) {
      const u = x / anelH, theta = u * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      pos.push(nx * 0.5, ny * 0.5, nz * 0.5);
      nor.push(nx, ny, nz);
      uv.push(u, v);
    }
  }
  for (let y = 0; y < anelV; y++) {
    for (let x = 0; x < anelH; x++) {
      const a = y * (anelH + 1) + x, b = a + anelH + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { pos, nor, uv, idx };
}

// ---------- motor ----------

class Motor3D {
  constructor() {
    this.ok = false;
    this.malhas = {};
    this.escalaPonto = 700;
  }

  iniciar(tela) {
    this.tela = tela;
    const op = { alpha: true, antialias: true, depth: true, premultipliedAlpha: true, powerPreference: 'high-performance' };
    const gl = tela.getContext('webgl', op) || tela.getContext('experimental-webgl', op);
    if (!gl) return false;
    this.gl = gl;

    try {
      this.progMalha = programa(gl, VS_MALHA, FS_MALHA,
        ['aPos', 'aNor', 'aUV'],
        ['uProj', 'uVista', 'uModelo', 'uNormal', 'uCor', 'uEmissao', 'uLuzDir',
          'uLuzCor', 'uAmb', 'uNevoaCor', 'uOlho', 'uRimCor', 'uAlfa', 'uNevoa', 'uRim', 'uUsaTex', 'uTex']);
      this.progPontos = programa(gl, VS_PONTOS, FS_PONTOS,
        ['aPos', 'aCor', 'aTam', 'aAlfa'], ['uProj', 'uVista', 'uEscala']);
    } catch (e) {
      console.warn('3D indisponivel:', e.message);
      return false;
    }

    this.malhas.caixa = this.criarMalha(malhaCaixa());
    this.malhas.plano = this.criarMalha(malhaPlano());
    this.malhas.esfera = this.criarMalha(malhaEsfera(14, 10));

    this.bufPontos = {
      pos: gl.createBuffer(), cor: gl.createBuffer(),
      tam: gl.createBuffer(), alfa: gl.createBuffer(), n: 0,
    };

    this.proj = new Float32Array(16);
    this.vista = new Float32Array(16);
    this.projVista = new Float32Array(16);
    this.tmp = new Float32Array(16);
    this.normal = new Float32Array(16);
    this.olho = [0, 0, 6];

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.ok = true;
    this.redimensionar();
    return true;
  }

  criarMalha(dados) {
    const gl = this.gl;
    const b = (dst, arr, tipo) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(dst, buf);
      gl.bufferData(dst, arr, gl.STATIC_DRAW);
      return buf;
    };
    return {
      pos: b(gl.ARRAY_BUFFER, new Float32Array(dados.pos)),
      nor: b(gl.ARRAY_BUFFER, new Float32Array(dados.nor)),
      uv: b(gl.ARRAY_BUFFER, new Float32Array(dados.uv)),
      idx: b(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(dados.idx)),
      n: dados.idx.length,
    };
  }

  criarTextura(canvas) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  atualizarTextura(tex, canvas) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  }

  redimensionar() {
    if (!this.ok) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.tela.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (this.tela.width !== w || this.tela.height !== h) {
      this.tela.width = w; this.tela.height = h;
    }
    this.largura = w; this.altura = h;
    this.gl.viewport(0, 0, w, h);
    this.atualizarEscalaPonto();
  }

  comecar(limpar = true) {
    const gl = this.gl;
    this.redimensionar();
    gl.depthMask(true);
    if (limpar) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    } else {
      gl.clear(gl.DEPTH_BUFFER_BIT);
    }
  }

  // gl_PointSize e em pixels, mas quem escreve particula pensa em tamanho
  // de MUNDO. Esta conta converte um do outro: um ponto de 0.05 unidades a
  // 10 de distancia sai com o mesmo tamanho aparente de um cubo de 0.05.
  atualizarEscalaPonto() {
    const fov = this.fov || 52;
    this.escalaPonto = (this.altura || 720) / (2 * Math.tan((fov * Math.PI) / 360));
  }

  camera(olho, alvo, fov = 52) {
    this.olho = olho;
    this.fov = fov;
    this.atualizarEscalaPonto();
    M.perspectiva(fov, this.largura / this.altura, 0.1, 160, this.proj);
    M.olhar(olho, alvo, [0, 1, 0], this.vista);
    M.multiplica(this.proj, this.vista, this.projVista);
  }

  // Ambiente da cena: luz, nevoa e cor de fundo do nevoeiro.
  ambiente(op = {}) {
    this.luzDir = op.luzDir || [0.4, 0.85, 0.6];
    this.luzCor = op.luzCor || [0.9, 0.78, 0.72];
    this.amb = op.amb || [0.16, 0.13, 0.2];
    this.nevoaCor = op.nevoaCor || [0.02, 0.01, 0.03];
    this.nevoa = op.nevoa ?? 0.012;
  }

  desenhar(nomeMalha, modelo, op = {}) {
    if (!this.ok) return;
    const gl = this.gl, pr = this.progMalha;
    const malha = typeof nomeMalha === 'string' ? this.malhas[nomeMalha] : nomeMalha;
    if (!malha) return;

    gl.useProgram(pr.p);
    if (op.aditivo) { gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); }
    else { gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(op.semProfundidade ? false : true); }
    if (op.doisLados) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);

    M.inverte(modelo, this.tmp);
    M.transpoe(this.tmp, this.normal);

    gl.uniformMatrix4fv(pr.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(pr.u.uVista, false, this.vista);
    gl.uniformMatrix4fv(pr.u.uModelo, false, modelo);
    gl.uniformMatrix4fv(pr.u.uNormal, false, this.normal);
    gl.uniform3fv(pr.u.uCor, op.cor || [1, 1, 1]);
    gl.uniform3fv(pr.u.uEmissao, op.emissao || [0, 0, 0]);
    gl.uniform3fv(pr.u.uLuzDir, this.luzDir);
    gl.uniform3fv(pr.u.uLuzCor, this.luzCor);
    gl.uniform3fv(pr.u.uAmb, this.amb);
    gl.uniform3fv(pr.u.uNevoaCor, this.nevoaCor);
    gl.uniform3fv(pr.u.uOlho, this.olho);
    gl.uniform3fv(pr.u.uRimCor, op.rimCor || [0.5, 0.2, 0.3]);
    gl.uniform1f(pr.u.uAlfa, op.alfa ?? 1);
    gl.uniform1f(pr.u.uNevoa, op.nevoa ?? this.nevoa);
    gl.uniform1f(pr.u.uRim, op.rim ?? 0.6);
    gl.uniform1f(pr.u.uUsaTex, op.textura ? 1 : 0);
    if (op.textura) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, op.textura);
      gl.uniform1i(pr.u.uTex, 0);
    }

    const liga = (buf, loc, n) => {
      if (loc < 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
    };
    liga(malha.pos, pr.a.aPos, 3);
    liga(malha.nor, pr.a.aNor, 3);
    liga(malha.uv, pr.a.aUV, 2);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, malha.idx);
    gl.drawElements(gl.TRIANGLES, malha.n, gl.UNSIGNED_SHORT, 0);
  }

  // Nuvem de pontos: brasa, poeira, faisca. Uma chamada de desenho para
  // milhares deles.
  pontos(pos, cor, tam, alfa, quantos) {
    if (!this.ok || quantos <= 0) return;
    const gl = this.gl, pr = this.progPontos, b = this.bufPontos;
    gl.useProgram(pr.p);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.uniformMatrix4fv(pr.u.uProj, false, this.proj);
    gl.uniformMatrix4fv(pr.u.uVista, false, this.vista);
    gl.uniform1f(pr.u.uEscala, this.escalaPonto);
    const sobe = (buf, arr, loc, n) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, n, gl.FLOAT, false, 0, 0);
    };
    sobe(b.pos, pos, pr.a.aPos, 3);
    sobe(b.cor, cor, pr.a.aCor, 3);
    sobe(b.tam, tam, pr.a.aTam, 1);
    sobe(b.alfa, alfa, pr.a.aAlfa, 1);
    gl.drawArrays(gl.POINTS, 0, quantos);
    gl.depthMask(true);
  }

  // Onde este ponto do mundo cai na tela, ja no espaco logico 960x540 que
  // o resto do jogo usa. Nao consulta o DOM: getBoundingClientRect no meio
  // do laco custa layout, e isso aqui roda quatro vezes por placa por
  // quadro.
  naTela(x, y, z, saida = {}) {
    return M.projetar(this.projVista, x, y, z, 960, 540, saida);
  }
}

export const motor = new Motor3D();
export { M as mat };
