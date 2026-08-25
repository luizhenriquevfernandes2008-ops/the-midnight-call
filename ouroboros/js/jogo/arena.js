// arena.js — a sala: grade, paredes, perigos e a porta de saida.
//
// A sala inteira e uma grade de celulas. Cobra, bicho e chefe andam em
// celula; so o desenho interpola entre elas. Isso e o que permite a mecanica
// de constricao existir: "cercar" e uma pergunta sobre grade, e a resposta e
// um flood fill de 500 celulas — barato o suficiente para rodar todo passo.
//
// O chao e desenhado UMA vez num buffer quando a sala nasce. Redesenhar
// milhares de manchas de sujeira a 60 fps seria jogar quadro fora por nada:
// o chao nao muda, so o que anda em cima dele.

import { semente, inteiro, sorteia, chance, limita, misturaCor } from '../nucleo/util.js';
import { buffer } from '../nucleo/gfx.js';
import { luz, pintar, CONTORNO } from '../arte/pincel.js';

export const VAZIO = 0;
export const PAREDE = 1;

export class Arena {
  constructor(cfg) {
    this.cols = cfg.colunas;
    this.rows = cfg.linhas;
    this.celula = cfg.celula;
    this.ox = cfg.margemX;
    this.oy = cfg.margemY;
    this.largura = this.cols * this.celula;
    this.altura = this.rows * this.celula;
    this.paredes = new Uint8Array(this.cols * this.rows);
    this.perigos = new Uint8Array(this.cols * this.rows);
    this.perigoAte = new Float64Array(this.cols * this.rows);
    this.buf = buffer(this.largura, this.altura);
    this.porta = null;
    this.tempo = 0;
  }

  i(cx, cy) { return cy * this.cols + cx; }
  dentro(cx, cy) { return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows; }
  parede(cx, cy) { return !this.dentro(cx, cy) || this.paredes[this.i(cx, cy)] === PAREDE; }
  livre(cx, cy) { return this.dentro(cx, cy) && this.paredes[this.i(cx, cy)] !== PAREDE; }

  px(cx) { return this.ox + cx * this.celula + this.celula / 2; }
  py(cy) { return this.oy + cy * this.celula + this.celula / 2; }
  celulaEmX(x) { return Math.floor((x - this.ox) / this.celula); }
  celulaEmY(y) { return Math.floor((y - this.oy) / this.celula); }

  perigoEm(cx, cy) {
    if (!this.dentro(cx, cy)) return 0;
    const idx = this.i(cx, cy);
    const p = this.perigos[idx];
    if (!p) return 0;
    if (this.perigoAte[idx] > 0 && this.perigoAte[idx] < this.tempo) {
      this.perigos[idx] = 0;
      return 0;
    }
    return p;
  }

  porPerigo(nomes, cx, cy) {
    const p = this.perigoEm(cx, cy);
    return p ? nomes[p - 1] : null;
  }

  poePerigo(cx, cy, indice, duracao = 0) {
    if (!this.livre(cx, cy)) return;
    const i = this.i(cx, cy);
    this.perigos[i] = indice;
    this.perigoAte[i] = duracao > 0 ? this.tempo + duracao : 0;
  }

  poeParede(cx, cy, duracao = 0) {
    if (!this.dentro(cx, cy)) return;
    this.paredes[this.i(cx, cy)] = PAREDE;
    if (duracao > 0) {
      this.temporarias = this.temporarias || [];
      this.temporarias.push({ cx, cy, ate: this.tempo + duracao });
    }
    this.sujo = true;
  }

  tiraParede(cx, cy) {
    if (!this.dentro(cx, cy)) return;
    this.paredes[this.i(cx, cy)] = VAZIO;
    this.sujo = true;
  }

  atualizar(dt) {
    this.tempo += dt * 1000;
    if (this.temporarias && this.temporarias.length) {
      let mexeu = false;
      this.temporarias = this.temporarias.filter(t => {
        if (t.ate < this.tempo) { this.paredes[this.i(t.cx, t.cy)] = VAZIO; mexeu = true; return false; }
        return true;
      });
      if (mexeu) this.sujo = true;
    }
    if (this.sujo) { this.pintarChao(); this.sujo = false; }
  }

  // ---------- geracao ----------

  gerar(andar, numeroSala, sementeNum, nomesPerigo) {
    const r = semente(sementeNum);
    this.paredes.fill(VAZIO);
    this.perigos.fill(0);
    this.perigoAte.fill(0);
    this.temporarias = [];
    this.paleta = andar.paleta;
    this.nomesPerigo = nomesPerigo;
    this.porta = null;

    // borda
    for (let x = 0; x < this.cols; x++) { this.paredes[this.i(x, 0)] = PAREDE; this.paredes[this.i(x, this.rows - 1)] = PAREDE; }
    for (let y = 0; y < this.rows; y++) { this.paredes[this.i(0, y)] = PAREDE; this.paredes[this.i(this.cols - 1, y)] = PAREDE; }

    const estilo = sorteia(r, andar.estilos);
    this.estilo = estilo;
    const d = andar.densidadeParede;
    if (estilo === 'pilares') this._pilares(r, d);
    else if (estilo === 'cruz') this._cruz(r);
    else if (estilo === 'camaras') this._camaras(r);
    else if (estilo === 'ilhas') this._ilhas(r, d);
    else if (estilo === 'serpente') this._serpente(r);
    else if (estilo === 'fornalha') this._fornalha(r);
    else if (estilo === 'corredores') this._corredores(r);
    else if (estilo === 'favo') this._favo(r);
    else if (estilo === 'anel') this._anelSala(r);
    // 'vazio' nao poe nada: so a borda

    // perigos espalhados
    if (andar.perigos && andar.perigos.length) {
      const quantos = andar.poucosPerigos ? inteiro(r, 2, 5) : inteiro(r, 5, 12);
      for (let k = 0; k < quantos; k++) {
        const nome = sorteia(r, andar.perigos);
        const idx = nomesPerigo.indexOf(nome) + 1;
        const cx = inteiro(r, 2, this.cols - 3), cy = inteiro(r, 2, this.rows - 3);
        // Mancha pequena de proposito: perigo que machuca ocupando um quinto
        // da sala deixa de ser obstaculo e vira pedagio.
        const tam = inteiro(r, 1, 2);
        for (let a = 0; a < tam; a++) {
          for (let b = 0; b < tam; b++) {
            if (chance(r, 0.65)) this.poePerigo(cx + a, cy + b, idx, 0);
          }
        }
      }
    }

    // a cobra nasce a esquerda, olhando para a direita: limpa a pista
    this.nascimento = { cx: 4, cy: (this.rows / 2) | 0 };
    for (let x = 1; x <= 10; x++) {
      for (let y = -1; y <= 1; y++) {
        const cy = this.nascimento.cy + y;
        this.paredes[this.i(x, cy)] = VAZIO;
        this.perigos[this.i(x, cy)] = 0;
      }
    }

    this._garantirConexao();
    this.pintarChao();
  }

  _pilares(r, d) {
    const passo = inteiro(r, 3, 4);
    for (let x = 2; x < this.cols - 2; x += passo) {
      for (let y = 2; y < this.rows - 2; y += passo) {
        if (!chance(r, 0.55 + d)) continue;
        const w = inteiro(r, 1, 2), h = inteiro(r, 1, 2);
        for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) this.paredes[this.i(x + a, y + b)] = PAREDE;
      }
    }
  }

  _cruz(r) {
    const mx = (this.cols / 2) | 0, my = (this.rows / 2) | 0;
    const braco = inteiro(r, 3, 6);
    for (let i = -braco; i <= braco; i++) {
      if (Math.abs(i) > 1) {
        this.paredes[this.i(mx + i, my)] = PAREDE;
        this.paredes[this.i(mx, limita(my + i, 1, this.rows - 2))] = PAREDE;
      }
    }
    for (const [sx, sy] of [[5, 4], [this.cols - 6, 4], [5, this.rows - 5], [this.cols - 6, this.rows - 5]]) {
      if (chance(r, 0.7)) {
        for (let i = 0; i < 3; i++) this.paredes[this.i(sx + i, sy)] = PAREDE;
      }
    }
  }

  _camaras(r) {
    const divisorias = inteiro(r, 2, 3);
    for (let k = 0; k < divisorias; k++) {
      const vertical = chance(r, 0.6);
      if (vertical) {
        const x = inteiro(r, 6, this.cols - 7);
        const buraco = inteiro(r, 2, this.rows - 3);
        for (let y = 1; y < this.rows - 1; y++) {
          if (Math.abs(y - buraco) > 1) this.paredes[this.i(x, y)] = PAREDE;
        }
      } else {
        const y = inteiro(r, 4, this.rows - 5);
        const buraco = inteiro(r, 3, this.cols - 4);
        for (let x = 1; x < this.cols - 1; x++) {
          if (Math.abs(x - buraco) > 2) this.paredes[this.i(x, y)] = PAREDE;
        }
      }
    }
  }

  _ilhas(r, d) {
    const n = inteiro(r, 4, 7);
    for (let k = 0; k < n; k++) {
      const cx = inteiro(r, 3, this.cols - 4), cy = inteiro(r, 3, this.rows - 4);
      const raio = inteiro(r, 1, 2);
      for (let x = -raio; x <= raio; x++) {
        for (let y = -raio; y <= raio; y++) {
          if (x * x + y * y <= raio * raio + 1 && chance(r, 0.8)) {
            const px = cx + x, py = cy + y;
            if (px > 0 && py > 0 && px < this.cols - 1 && py < this.rows - 1) this.paredes[this.i(px, py)] = PAREDE;
          }
        }
      }
    }
  }

  _serpente(r) {
    let y = inteiro(r, 3, this.rows - 4);
    for (let x = 2; x < this.cols - 2; x++) {
      if (chance(r, 0.3)) y += chance(r, 0.5) ? 1 : -1;
      y = limita(y, 2, this.rows - 3);
      if (x % 5 !== 0) this.paredes[this.i(x, y)] = PAREDE;
    }
  }

  _fornalha(r) {
    for (let k = 0; k < 4; k++) {
      const x = inteiro(r, 4, this.cols - 8);
      const y = inteiro(r, 2, this.rows - 6);
      const w = inteiro(r, 3, 5), h = inteiro(r, 2, 4);
      for (let a = 0; a < w; a++) {
        for (let b = 0; b < h; b++) {
          const borda = a === 0 || b === 0 || a === w - 1 || b === h - 1;
          if (borda && chance(r, 0.85)) this.paredes[this.i(x + a, y + b)] = PAREDE;
        }
      }
    }
  }

  _corredores(r) {
    for (let x = 4; x < this.cols - 4; x += 4) {
      const buraco = inteiro(r, 2, this.rows - 3);
      for (let y = 1; y < this.rows - 1; y++) {
        if (Math.abs(y - buraco) > 1) this.paredes[this.i(x, y)] = PAREDE;
      }
    }
  }

  _favo(r) {
    for (let y = 2; y < this.rows - 2; y += 3) {
      const desloca = ((y / 3) | 0) % 2 ? 2 : 0;
      for (let x = 3 + desloca; x < this.cols - 3; x += 4) {
        if (!chance(r, 0.75)) continue;
        this.paredes[this.i(x, y)] = PAREDE;
        this.paredes[this.i(x + 1, y)] = PAREDE;
        if (chance(r, 0.5)) this.paredes[this.i(x, y + 1)] = PAREDE;
      }
    }
  }

  _anelSala(r) {
    const cx = (this.cols / 2) | 0, cy = (this.rows / 2) | 0;
    const raio = 5;
    for (let a = 0; a < 360; a += 4) {
      const rad = (a * Math.PI) / 180;
      const x = Math.round(cx + Math.cos(rad) * raio);
      const y = Math.round(cy + Math.sin(rad) * raio * 0.62);
      if (a % 60 < 16) continue;   // portas do anel
      if (x > 1 && y > 1 && x < this.cols - 2 && y < this.rows - 2) this.paredes[this.i(x, y)] = PAREDE;
    }
  }

  // Toda celula livre precisa ser alcancavel a partir do nascimento; se nao
  // for, ela vira parede. Alma inalcancavel e sala que nunca limpa.
  _garantirConexao() {
    const vis = new Uint8Array(this.cols * this.rows);
    const fila = [this.i(this.nascimento.cx, this.nascimento.cy)];
    vis[fila[0]] = 1;
    while (fila.length) {
      const at = fila.pop();
      const x = at % this.cols, y = (at / this.cols) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!this.dentro(nx, ny)) continue;
        const ni = this.i(nx, ny);
        if (vis[ni] || this.paredes[ni] === PAREDE) continue;
        vis[ni] = 1;
        fila.push(ni);
      }
    }
    for (let i = 0; i < this.paredes.length; i++) {
      if (this.paredes[i] !== PAREDE && !vis[i]) this.paredes[i] = PAREDE;
    }
    this.livres = [];
    for (let i = 0; i < vis.length; i++) if (vis[i]) this.livres.push(i);
  }

  celulaLivreAleatoria(r, longeDe = null, distanciaMinima = 6) {
    for (let tentativa = 0; tentativa < 90; tentativa++) {
      const idx = this.livres[Math.floor(r() * this.livres.length)];
      const cx = idx % this.cols, cy = (idx / this.cols) | 0;
      if (this.perigoEm(cx, cy)) continue;
      if (longeDe) {
        const d = Math.abs(cx - longeDe.cx) + Math.abs(cy - longeDe.cy);
        if (d < distanciaMinima) continue;
      }
      return { cx, cy };
    }
    const idx = this.livres[Math.floor(r() * this.livres.length)];
    return { cx: idx % this.cols, cy: (idx / this.cols) | 0 };
  }

  abrirPorta(r) {
    const p = this.celulaLivreAleatoria(r, this.nascimento, 10);
    this.porta = { cx: p.cx, cy: p.cy, nascida: this.tempo };
    return this.porta;
  }

  // ---------- desenho ----------

  pintarChao() {
    const x = this.buf.x, c = this.celula, p = this.paleta;
    x.clearRect(0, 0, this.largura, this.altura);
    const g = x.createLinearGradient(0, 0, 0, this.altura);
    g.addColorStop(0, p.chao);
    g.addColorStop(1, p.fundo);
    x.fillStyle = g;
    x.fillRect(0, 0, this.largura, this.altura);

    // grade
    x.strokeStyle = p.grade;
    x.lineWidth = 1;
    x.beginPath();
    for (let i = 1; i < this.cols; i++) { x.moveTo(i * c + 0.5, 0); x.lineTo(i * c + 0.5, this.altura); }
    for (let j = 1; j < this.rows; j++) { x.moveTo(0, j * c + 0.5); x.lineTo(this.largura, j * c + 0.5); }
    x.stroke();

    // Luz vinda do meio da sala: sem isso o chao e um retangulo chapado e a
    // arena parece papel de parede.
    const luz = x.createRadialGradient(this.largura / 2, this.altura / 2, 20,
      this.largura / 2, this.altura / 2, this.largura * 0.62);
    luz.addColorStop(0, 'rgba(255,255,255,0.055)');
    luz.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = luz;
    x.fillRect(0, 0, this.largura, this.altura);

    // sujeira determinada pela posicao: mesma sala, mesma sujeira
    let s = this.cols * 7919 + this.rows * 104729 + (this.estilo ? this.estilo.length * 31 : 0);
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < 1800; i++) {
      const px = rnd() * this.largura, py = rnd() * this.altura;
      const v = rnd();
      x.fillStyle = v > 0.55 ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.22)';
      const t = 1 + rnd() * 2.6;
      x.fillRect(px, py, t, t);
    }

    // Sombra que a parede joga no chao. Vem ANTES de desenhar as paredes,
    // senao a sombra de um bloco cai por cima do vizinho.
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        if (this.paredes[this.i(cx, cy)] !== PAREDE) continue;
        if (this.parede(cx, cy + 1)) continue;
        const sombra = x.createLinearGradient(0, (cy + 1) * c, 0, (cy + 1) * c + c * 0.55);
        sombra.addColorStop(0, 'rgba(0,0,0,0.55)');
        sombra.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = sombra;
        x.fillRect(cx * c, (cy + 1) * c, c, c * 0.55);
      }
    }

    // paredes: base escura + topo iluminado, para dar volume
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        if (this.paredes[this.i(cx, cy)] !== PAREDE) continue;
        const bx = cx * c, by = cy * c;
        const temTopo = !this.parede(cx, cy - 1);
        const g2 = x.createLinearGradient(0, by, 0, by + c);
        g2.addColorStop(0, p.paredeTopo);
        g2.addColorStop(0.45, p.parede);
        g2.addColorStop(1, misturaCor(p.parede, '#000000', 0.45));
        x.fillStyle = g2;
        x.fillRect(bx, by, c, c);
        if (temTopo) {
          // Faixa de topo grossa e clara: e o que faz o bloco parecer que
          // tem altura, e o que separa parede de chao a um metro da tela.
          x.fillStyle = p.paredeLuz;
          x.fillRect(bx, by, c, Math.max(3, Math.round(c * 0.22)));
          x.fillStyle = 'rgba(255,255,255,0.16)';
          x.fillRect(bx, by, c, 2);
        }
        // contorno preto em volta do bloco inteiro
        x.strokeStyle = 'rgba(4,2,8,0.75)';
        x.lineWidth = 1.5;
        x.strokeRect(bx + 0.75, by + 0.75, c - 1.5, c - 1.5);
        // quinas: claro a esquerda, escuro a direita — a luz vem de cima e
        // um pouco da esquerda, igual ao brilho do menu
        if (!this.parede(cx - 1, cy)) {
          x.fillStyle = 'rgba(255,255,255,0.055)';
          x.fillRect(bx, by, 1, c);
        }
        if (!this.parede(cx + 1, cy)) {
          x.fillStyle = 'rgba(0,0,0,0.45)';
          x.fillRect(bx + c - 2, by, 2, c);
        }
        if (!this.parede(cx, cy + 1)) {
          x.fillStyle = 'rgba(0,0,0,0.5)';
          x.fillRect(bx, by + c - 2, c, 2);
        }
        // textura da pedra
        for (let k = 0; k < 7; k++) {
          const v = rnd();
          x.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.26)';
          x.fillRect(bx + rnd() * c, by + rnd() * c, 2, 2);
        }
      }
    }
  }

  desenhar(ctx, tempo) {
    ctx.drawImage(this.buf.c, this.ox, this.oy);
    const c = this.celula;

    // perigos animados por cima
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const p = this.perigoEm(cx, cy);
        if (!p) continue;
        const nome = this.nomesPerigo[p - 1];
        const x = this.ox + cx * c, y = this.oy + cy * c;
        desenharPerigo(ctx, nome, x, y, c, tempo, cx * 3 + cy * 7);
      }
    }
  }
}

export function desenharPerigo(ctx, nome, x, y, c, tempo, fase) {
  // Perigo mora NO CHAO: sem sombra projetada, sem flutuar. E assim que o
  // olho separa "piso ruim" de "bicho" sem precisar pensar.
  //
  // E nada de createRadialGradient aqui dentro: isto roda uma vez por
  // celula, por quadro. Com quarenta celulas de fogo eram quarenta
  // gradientes novos por quadro — um dos motivos do jogo travar.
  ctx.save();
  if (nome === 'espinho') {
    // Espinho tem cor propria, fora da paleta do andar: perigo nao pode
    // mudar de aparencia de fase para fase, senao o jogador reaprende do
    // zero toda vez que desce um circulo.
    const sobe = (Math.sin(tempo * 2.4 + fase) + 1) / 2;
    ctx.fillStyle = 'rgba(12,6,10,0.8)';
    ctx.beginPath();
    ctx.ellipse(x + c / 2, y + c * 0.72, c * 0.42, c * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    const h = c * 0.62 * (0.35 + sobe * 0.65);
    for (let i = 0; i < 3; i++) {
      const px = x + c * 0.26 + i * c * 0.24;
      ctx.beginPath();
      ctx.moveTo(px - c * 0.13, y + c * 0.78);
      ctx.lineTo(px, y + c * 0.78 - h);
      ctx.lineTo(px + c * 0.13, y + c * 0.78);
      ctx.closePath();
      pintar(ctx, sobe > 0.55 ? '#ffd0d6' : '#b8909c', CONTORNO, 1.8);
    }
    if (sobe > 0.55) luz(ctx, x + c / 2, y + c * 0.5, c * 0.7, '#ff6a7a', 0.3 * sobe);
  } else if (nome === 'fogo') {
    const t = (Math.sin(tempo * 5 + fase) + 1) / 2;
    luz(ctx, x + c / 2, y + c / 2, c * 1.1, '#ff9a3a', 0.5 + t * 0.3);
    ctx.fillStyle = 'rgba(50,16,6,0.55)';
    ctx.fillRect(x + 2, y + 2, c - 4, c - 4);
    for (let i = 0; i < 2; i++) {
      const px = x + c * (0.34 + i * 0.32);
      const alt = c * (0.4 + 0.22 * Math.sin(tempo * 7 + fase + i * 2));
      ctx.beginPath();
      ctx.moveTo(px - c * 0.13, y + c * 0.78);
      ctx.quadraticCurveTo(px - c * 0.08, y + c * 0.78 - alt * 0.6, px, y + c * 0.78 - alt);
      ctx.quadraticCurveTo(px + c * 0.08, y + c * 0.78 - alt * 0.6, px + c * 0.13, y + c * 0.78);
      ctx.closePath();
      ctx.fillStyle = i ? '#ffd05a' : '#ff8a2a';
      ctx.fill();
    }
  } else if (nome === 'lodo') {
    ctx.fillStyle = 'rgba(26,72,60,0.85)';
    ctx.fillRect(x, y, c, c);
    ctx.strokeStyle = 'rgba(110,220,180,0.3)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(x + c / 2, y + c / 2, c * 0.3, c * 0.16,
      fase + Math.sin(tempo + fase) * 0.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(150,255,210,0.18)';
    ctx.beginPath();
    ctx.arc(x + c * 0.3, y + c * 0.62, c * 0.07 * (1 + Math.sin(tempo * 3 + fase) * 0.3), 0, Math.PI * 2);
    ctx.fill();
  } else if (nome === 'teia') {
    ctx.strokeStyle = 'rgba(226,222,208,0.42)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + fase * 0.2;
      ctx.moveTo(x + c / 2, y + c / 2);
      ctx.lineTo(x + c / 2 + Math.cos(a) * c * 0.5, y + c / 2 + Math.sin(a) * c * 0.5);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + c / 2, y + c / 2, c * 0.26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + c / 2, y + c / 2, c * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  } else if (nome === 'vazio') {
    const t = (Math.sin(tempo * 1.4 + fase) + 1) / 2;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x + c / 2, y + c / 2, c * 0.5, c * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,255,' + (0.32 + t * 0.3) + ')';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(160,140,255,' + (0.5 * t) + ')';
    const a = tempo * 1.6 + fase;
    ctx.fillRect(x + c / 2 + Math.cos(a) * c * 0.3 - 1, y + c / 2 + Math.sin(a) * c * 0.26 - 1, 2, 2);
  }
  ctx.restore();
}
