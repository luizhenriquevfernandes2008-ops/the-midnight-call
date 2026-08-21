// audio.js — música e efeitos sintetizados em WebAudio. Zero arquivo de som.
//
// O jogo inteiro cabe num HTML de dois cliques, e isso só é possível porque
// nada aqui é gravado: cada pulo, cada moeda e cada nota das quatro músicas
// nascem de um oscilador criado na hora e destruído depois.
//
// A música é um sequenciador de passos com agendamento antecipado. O laço
// do jogo chama `atualizar(dt)` e, se o relógio do WebAudio está a menos de
// 0,25 s do próximo passo, as notas daquele passo são agendadas. Agendar no
// futuro é o que impede a música de tremer quando o navegador engasga num
// frame — o áudio já está marcado na linha do tempo e não depende mais do
// requestAnimationFrame.
//
// Notação das trilhas: cada token é UMA COLCHEIA.
//   'c5'  toca dó da quinta oitava        'f#4' aceita sustenido
//   '-'   segura a nota anterior          '.'   silêncio
// Oito tokens por compasso, quatro compassos por volta. Escrever música
// assim é feio, mas é editável por qualquer pessoa que saiba contar até
// oito, e cabe numa linha.

const NOTAS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

function midi(nome) {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(nome);
  if (!m) return null;
  let n = NOTAS[m[1]];
  if (m[2] === '#') n++;
  if (m[2] === 'b') n--;
  return n + (parseInt(m[3], 10) + 1) * 12;
}

const freq = n => 440 * Math.pow(2, (n - 69) / 12);

// Acordes como intervalos a partir da tônica da escala.
const ACORDE = {
  I:   [0, 4, 7],   ii:  [2, 5, 9],   iii: [4, 7, 11],
  IV:  [5, 9, 12],  V:   [7, 11, 14], vi:  [9, 12, 16],
  VII: [11, 14, 17], bVI: [8, 12, 15], bVII: [10, 14, 17],
  i:   [0, 3, 7],   iv:  [5, 8, 12],  v:   [7, 10, 14],
  III: [3, 7, 10],  VI:  [8, 12, 15],
};

function passos(str) { return str.trim().split(/\s+/); }

// ---------------------------------------------------------------------------
// as trilhas
// ---------------------------------------------------------------------------
// `tom` é a nota MIDI da tônica (60 = dó central). `giro` é a sequência de
// acordes, um por compasso. `melodia` tem 8 tokens por compasso.

const TRILHAS = {
  menu: {
    bpm: 84, tom: 60, giro: ['I', 'V', 'vi', 'IV'],
    lead: 'sino', baixo: 'triangulo', arpejo: 0.30, bateria: null,
    melodia:
      'e5 .  g5 -  a5 -  g5 -   ' +
      'd5 .  b4 -  d5 -  g5 -   ' +
      'e5 .  c5 -  e5 -  a5 -   ' +
      'c5 .  a4 -  f4 -  -  .   ',
  },

  // Praia: rápida, saltitante, tudo em maior. É a fase de aprender a pular.
  praia: {
    bpm: 140, tom: 65, giro: ['I', 'V', 'vi', 'IV'],
    lead: 'pulso', baixo: 'triangulo', arpejo: 0.22, bateria: 'animada',
    melodia:
      'f5 g5 a5 -  c6 -  a5 g5  ' +
      'c5 d5 e5 -  g5 -  e5 d5  ' +
      'd5 e5 f5 -  a5 -  f5 e5  ' +
      'a#4 c5 d5 -  f5 -  -  .   ',
  },

  // Floresta: mais lenta, menor, respirando. Aqui o cenário é escuro e a
  // música tem que deixar o vaga-lume ser o barulho.
  floresta: {
    bpm: 100, tom: 57, giro: ['i', 'VI', 'III', 'v'],
    lead: 'triangulo', baixo: 'triangulo', arpejo: 0.26, bateria: 'suave',
    melodia:
      'a4 .  c5 -  e5 -  d5 -   ' +
      'f5 .  e5 -  c5 -  -  .   ' +
      'c5 .  e5 -  g5 -  e5 -   ' +
      'e5 .  d5 -  b4 -  -  .   ',
  },

  // Cidade na chuva: síncope, baixo andando, sensação de atravessar algo.
  cidade: {
    bpm: 122, tom: 62, giro: ['i', 'bVII', 'VI', 'v'],
    lead: 'pulso', baixo: 'serra', arpejo: 0.20, bateria: 'chuva',
    melodia:
      'd5 .  f5 g5 a5 -  g5 f5  ' +
      'c5 .  e5 f5 g5 -  f5 e5  ' +
      'a#4 .  d5 f5 a5 -  -  .   ' +
      'a4 .  c5 e5 g5 -  -  .   ',
  },

  // Céu: aberto, tudo em notas longas. É a subida final.
  ceu: {
    bpm: 108, tom: 67, giro: ['IV', 'I', 'V', 'vi'],
    lead: 'sino', baixo: 'triangulo', arpejo: 0.32, bateria: 'suave',
    melodia:
      'c5 -  -  e5 g5 -  -  .   ' +
      'g4 -  -  b4 d5 -  -  .   ' +
      'd5 -  -  f#5 a5 -  -  .  ' +
      'b4 -  -  d5 e5 -  -  .   ',
  },

  // O final. Só sino e baixo, devagar, sem bateria nenhuma.
  final: {
    bpm: 68, tom: 60, giro: ['I', 'IV', 'vi', 'V'],
    lead: 'sino', baixo: 'triangulo', arpejo: 0.34, bateria: null,
    melodia:
      'g4 -  c5 -  e5 -  -  .   ' +
      'f5 -  e5 -  c5 -  -  .   ' +
      'a4 -  c5 -  e5 -  d5 -   ' +
      'b4 -  d5 -  g5 -  -  .   ',
  },
};

const BATERIAS = {
  //         1 e 2 e 3 e 4 e   (colcheias)
  animada: { bumbo: 'x . . . x . x .', caixa: '. . x . . . x .', chimbal: 'x x x x x x x x' },
  suave:   { bumbo: 'x . . . . . x .', caixa: '. . . . x . . .', chimbal: '. x . x . x . x' },
  chuva:   { bumbo: 'x . . x . . x .', caixa: '. . x . . . x .', chimbal: 'x x x x x x x x' },
};

class Audio {
  constructor() {
    this.pronto = false;
    this.vol = { geral: 0.75, musica: 0.6, efeitos: 0.85 };
    this.trilhaAtual = null;
    this.tocando = false;
    this.proximoPasso = 0;    // relógio do WebAudio do próximo passo
    this.passoMusica = 0;
  }

  garantir() {
    if (this.pronto) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const c = this.ctx = new AC();

    this.geral = c.createGain();
    this.geral.gain.value = this.vol.geral;
    this.geral.connect(c.destination);

    // Compressor no barramento geral. Sem ele, coletar cinco corações no
    // mesmo frame soma cinco osciladores e estoura o alto-falante.
    this.limite = c.createDynamicsCompressor();
    this.limite.threshold.value = -10;
    this.limite.ratio.value = 8;
    this.limite.attack.value = 0.003;
    this.limite.release.value = 0.18;
    this.limite.connect(this.geral);

    this.busMusica = c.createGain(); this.busMusica.gain.value = this.vol.musica;
    this.busEfeitos = c.createGain(); this.busEfeitos.gain.value = this.vol.efeitos;
    this.busMusica.connect(this.limite);
    this.busEfeitos.connect(this.limite);

    // Reverb curto e barato: ruído com decaimento exponencial vira resposta
    // ao impulso. Dá "sala" ao sino e à voz das cartas sem custo de arquivo.
    this.eco = c.createConvolver();
    this.eco.buffer = this._impulso(1.6, 3.2);
    this.ecoGanho = c.createGain(); this.ecoGanho.gain.value = 0.22;
    this.eco.connect(this.ecoGanho);
    this.ecoGanho.connect(this.limite);

    this.ruidoBuf = this._ruido(2);
    this.pronto = true;
    if (c.state === 'suspended') c.resume();
    return true;
  }

  retomar() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  definirVolumes(v) {
    Object.assign(this.vol, v);
    if (!this.pronto) return;
    this.geral.gain.value = this.vol.geral;
    this.busMusica.gain.value = this.vol.musica;
    this.busEfeitos.gain.value = this.vol.efeitos;
  }

  _impulso(dur, decaimento) {
    const c = this.ctx, n = Math.floor(c.sampleRate * dur);
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decaimento);
      }
    }
    return b;
  }

  _ruido(seg) {
    const c = this.ctx, n = Math.floor(c.sampleRate * seg);
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  _fonteRuido() {
    const s = this.ctx.createBufferSource();
    s.buffer = this.ruidoBuf;
    s.loop = true;
    return s;
  }

  // Envelope ADSR simplificado (ataque, decaimento, sustentação curta).
  _env(t0, ataque, decai, pico, sustenta = 0) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pico), t0 + ataque);
    if (sustenta > 0) g.gain.setValueAtTime(Math.max(0.0002, pico), t0 + ataque + sustenta);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ataque + sustenta + decai);
    return g;
  }

  // Uma nota. `tipo` escolhe o timbre; `dest` o barramento.
  _nota(f, t0, dur, pico, tipo, dest, comEco = 0) {
    if (!this.pronto || f <= 0) return;
    const c = this.ctx;
    const o = c.createOscillator();
    let ataque = 0.012;
    switch (tipo) {
      case 'pulso':     o.type = 'square'; break;
      case 'serra':     o.type = 'sawtooth'; break;
      case 'triangulo': o.type = 'triangle'; break;
      case 'sino':      o.type = 'sine'; ataque = 0.004; break;
      default:          o.type = 'triangle';
    }
    o.frequency.setValueAtTime(f, t0);

    // Filtro passa-baixa por nota: quadrada crua é estridente, e o corte
    // acompanhando a altura mantém o timbre igual em toda a extensão.
    const flt = c.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(Math.min(12000, f * 6 + 800), t0);
    flt.Q.value = 0.7;

    const g = this._env(t0, ataque, dur * 0.85, pico, dur * 0.25);
    o.connect(flt); flt.connect(g); g.connect(dest);
    if (comEco > 0) {
      const e = c.createGain(); e.gain.value = comEco;
      g.connect(e); e.connect(this.eco);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.4);
  }

  _percussao(tipo, t0) {
    if (!this.pronto) return;
    const c = this.ctx;
    if (tipo === 'bumbo') {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t0);
      o.frequency.exponentialRampToValueAtTime(45, t0 + 0.12);
      const g = this._env(t0, 0.002, 0.13, 0.5);
      o.connect(g); g.connect(this.busMusica);
      o.start(t0); o.stop(t0 + 0.2);
      return;
    }
    const s = this._fonteRuido();
    const f = c.createBiquadFilter();
    if (tipo === 'caixa') { f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.9; }
    else { f.type = 'highpass'; f.frequency.value = 7200; }
    const g = this._env(t0, 0.001, tipo === 'caixa' ? 0.11 : 0.035,
      tipo === 'caixa' ? 0.22 : 0.075);
    s.connect(f); f.connect(g); g.connect(this.busMusica);
    s.start(t0); s.stop(t0 + 0.25);
  }

  // ---- música -------------------------------------------------------------

  tocarMusica(nome) {
    if (this.trilhaAtual === nome && this.tocando) return;
    this.trilhaAtual = nome;
    this.passoMusica = 0;
    this.tocando = !!TRILHAS[nome];
    if (this.pronto) this.proximoPasso = this.ctx.currentTime + 0.08;
  }

  pararMusica() { this.tocando = false; this.trilhaAtual = null; }

  atualizarMusica() {
    if (!this.pronto || !this.tocando) return;
    const tr = TRILHAS[this.trilhaAtual];
    if (!tr) return;
    const agora = this.ctx.currentTime;
    const durPasso = 30 / tr.bpm;            // uma colcheia
    if (this.proximoPasso < agora) this.proximoPasso = agora + 0.02;
    // Agenda tudo que cai nos próximos 0,25 s e sai. O laço nunca agenda o
    // mesmo passo duas vezes porque `proximoPasso` só anda pra frente.
    while (this.proximoPasso < agora + 0.25) {
      this._agendarPasso(tr, this.passoMusica, this.proximoPasso, durPasso);
      this.passoMusica = (this.passoMusica + 1) % (tr.giro.length * 8);
      this.proximoPasso += durPasso;
    }
  }

  _agendarPasso(tr, i, t, dur) {
    const compasso = Math.floor(i / 8);
    const dentro = i % 8;
    const acorde = ACORDE[tr.giro[compasso]] || ACORDE.I;
    const tonica = tr.tom + acorde[0];

    // baixo: tônica nos tempos, quinta no contratempo
    if (dentro % 2 === 0) {
      const n = dentro === 4 ? tonica + 7 : tonica;
      this._nota(freq(n - 12), t, dur * 1.7, 0.20, tr.baixo, this.busMusica);
    }

    // arpejo: sobe pelo acorde, uma nota por colcheia
    if (tr.arpejo > 0) {
      const grau = acorde[dentro % acorde.length];
      const oitava = dentro >= 4 ? 12 : 0;
      this._nota(freq(tr.tom + grau + oitava), t, dur * 0.9, tr.arpejo * 0.34,
        'triangulo', this.busMusica, 0.15);
    }

    // melodia
    const mel = tr._mel || (tr._mel = passos(tr.melodia));
    const tok = mel[i];
    if (tok && tok !== '.' && tok !== '-') {
      // conta quantas colcheias a nota segura
      let n = 1;
      while (mel[(i + n) % mel.length] === '-' && n < 8) n++;
      const nota = midi(tok);
      if (nota != null) {
        this._nota(freq(nota), t, dur * n * 0.95, 0.24, tr.lead, this.busMusica, 0.28);
      }
    }

    // bateria
    if (tr.bateria && BATERIAS[tr.bateria]) {
      const b = BATERIAS[tr.bateria];
      for (const parte of ['bumbo', 'caixa', 'chimbal']) {
        const p = b[parte].split(/\s+/);
        if (p[dentro] === 'x') this._percussao(parte, t);
      }
    }
  }

  // ---- efeitos ------------------------------------------------------------

  _bip(f0, f1, dur, pico, tipo = 'square', eco = 0) {
    if (!this.garantir()) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this._env(t, 0.004, dur, pico);
    o.connect(g); g.connect(this.busEfeitos);
    if (eco > 0) { const e = c.createGain(); e.gain.value = eco; g.connect(e); e.connect(this.eco); }
    o.start(t); o.stop(t + dur + 0.1);
  }

  _sopro(dur, pico, corte, tipoFiltro = 'bandpass') {
    if (!this.garantir()) return;
    const c = this.ctx, t = c.currentTime;
    const s = this._fonteRuido();
    const f = c.createBiquadFilter();
    f.type = tipoFiltro;
    f.frequency.setValueAtTime(corte, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, corte * 0.35), t + dur);
    f.Q.value = 1.1;
    const g = this._env(t, 0.005, dur, pico);
    s.connect(f); f.connect(g); g.connect(this.busEfeitos);
    s.start(t); s.stop(t + dur + 0.1);
  }

  pular()      { this._bip(320, 720, 0.16, 0.20); }
  pularDuplo() { this._bip(520, 980, 0.18, 0.18, 'triangle'); }
  aterrissar() { this._sopro(0.09, 0.14, 900, 'lowpass'); }
  // Cuidado: já existiu um campo `this.passo` no construtor que apagava
  // este método. O contador do sequenciador chama-se passoMusica.
  passo()      { this._sopro(0.045, 0.055, 1500); }

  coracao() {
    // duas notas em terça: é o som universal de "peguei algo bom"
    if (!this.garantir()) return;
    const c = this.ctx, t = c.currentTime;
    [1318.5, 1760].forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(f, t + i * 0.06);
      const g = this._env(t + i * 0.06, 0.003, 0.11, 0.16);
      o.connect(g); g.connect(this.busEfeitos);
      o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.2);
    });
  }

  carta() {
    // arpejo maior de quatro notas, com eco: a memória merece um som maior
    if (!this.garantir()) return;
    const c = this.ctx, t = c.currentTime;
    [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => {
      const t0 = t + i * 0.075;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, t0);
      const g = this._env(t0, 0.004, 0.5, 0.19);
      o.connect(g); g.connect(this.busEfeitos);
      const e = c.createGain(); e.gain.value = 0.5; g.connect(e); e.connect(this.eco);
      o.start(t0); o.stop(t0 + 0.7);
    });
  }

  pisao() {
    this._sopro(0.12, 0.2, 2200);
    this._bip(600, 180, 0.13, 0.13, 'square');
  }

  quique()  { this._bip(400, 900, 0.12, 0.16, 'triangle'); }
  mola()    { this._bip(260, 1200, 0.24, 0.22, 'square'); }

  dano() {
    this._bip(420, 110, 0.34, 0.24, 'sawtooth');
    this._sopro(0.2, 0.12, 700, 'lowpass');
  }

  morte() {
    if (!this.garantir()) return;
    const c = this.ctx, t = c.currentTime;
    [523.3, 466.2, 392, 311.1, 261.6].forEach((f, i) => {
      const t0 = t + i * 0.09;
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(f, t0);
      const g = this._env(t0, 0.005, 0.22, 0.2);
      o.connect(g); g.connect(this.busEfeitos);
      o.start(t0); o.stop(t0 + 0.4);
    });
  }

  gaiolaAbrindo() {
    if (!this.garantir()) return;
    const c = this.ctx, t = c.currentTime;
    // vidro quebrando: ruído agudo curto
    this._sopro(0.35, 0.22, 5200, 'highpass');
    // e um acorde maior subindo por baixo
    [392, 493.9, 587.3, 784].forEach((f, i) => {
      const t0 = t + 0.08 + i * 0.05;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f, t0);
      const g = this._env(t0, 0.01, 1.1, 0.22);
      o.connect(g); g.connect(this.busEfeitos);
      const e = c.createGain(); e.gain.value = 0.7; g.connect(e); e.connect(this.eco);
      o.start(t0); o.stop(t0 + 1.4);
    });
  }

  fanfarra() {
    if (!this.garantir()) return;
    const c = this.ctx, t = c.currentTime;
    const notas = [523.3, 659.3, 784, 1046.5, 784, 1046.5, 1318.5];
    notas.forEach((f, i) => {
      const t0 = t + i * 0.12;
      const o = c.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(f, t0);
      const g = this._env(t0, 0.005, 0.3, 0.2, 0.05);
      o.connect(g); g.connect(this.busEfeitos);
      const e = c.createGain(); e.gain.value = 0.4; g.connect(e); e.connect(this.eco);
      o.start(t0); o.stop(t0 + 0.5);
    });
  }

  fogosDeArtificio() {
    this._sopro(0.5, 0.18, 3400, 'highpass');
    this._bip(180, 60, 0.3, 0.14, 'sine');
  }

  menuMover()    { this._bip(760, 900, 0.05, 0.11, 'square'); }
  menuConfirma() { this._bip(700, 1200, 0.11, 0.15, 'square'); }
  menuVolta()    { this._bip(560, 320, 0.1, 0.12, 'square'); }
  digitar()      { this._bip(1500 + Math.random() * 260, 1400, 0.022, 0.045, 'square'); }

  // ---- utilidades ---------------------------------------------------------

  atualizar() { this.atualizarMusica(); }

  pausar() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  despausar() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
      // O relógio do WebAudio congela junto com o contexto; sem reancorar, o
      // laço da música tentaria agendar todos os passos perdidos de uma vez.
      this.proximoPasso = this.ctx.currentTime + 0.05;
    }
  }
}

export const audio = new Audio();
export default audio;
