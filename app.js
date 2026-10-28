// ===== Simulador de Investimentos: lógica =====
const INICIAL = 100000;

// Preços SIMULADOS (não são cotações reais). v = quanto o preço oscila a cada atualização.
const ATIVOS = [
  { s: 'PETR4',  n: 'Petrobras PN',      t: 'Ação',       p: 38,  v: 0.018 },
  { s: 'VALE3',  n: 'Vale ON',           t: 'Ação',       p: 62,  v: 0.015 },
  { s: 'ITUB4',  n: 'Itaú Unibanco PN',  t: 'Ação',       p: 33,  v: 0.012 },
  { s: 'WEGE3',  n: 'WEG ON',            t: 'Ação',       p: 45,  v: 0.014 },
  { s: 'MGLU3',  n: 'Magazine Luiza ON', t: 'Ação',       p: 9,   v: 0.035 },
  { s: 'HGLG11', n: 'FII Logística',     t: 'FII',        p: 160, v: 0.006 },
  { s: 'BOVA11', n: 'ETF Ibovespa',      t: 'ETF',        p: 125, v: 0.010 },
  { s: 'SELIC',  n: 'Tesouro Selic',     t: 'Renda fixa', p: 100, v: 0, rf: true }
];

const $ = id => document.getElementById(id);
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = v => (v >= 0 ? '+' : '') + v.toFixed(2).replace('.', ',') + '%';

function novoEstado() {
  const precos = {};
  ATIVOS.forEach(a => { precos[a.s] = a.p; });
  return { saldo: INICIAL, pos: {}, hist: [], serie: [INICIAL], precos: precos };
}
function carregar() {
  try {
    const d = JSON.parse(localStorage.getItem('sim_v1'));
    if (d && d.precos && d.pos) return d;
  } catch (e) {}
  return novoEstado();
}
function salvar() {
  try { localStorage.setItem('sim_v1', JSON.stringify(estado)); } catch (e) {}
}

let estado = carregar();

function patrimonio() {
  return Object.keys(estado.pos).reduce(
    (t, s) => t + estado.pos[s].q * estado.precos[s], estado.saldo);
}

function aviso(txt, ok) {
  const m = $('msg');
  m.textContent = txt;
  m.className = ok ? 'ok' : 'erro';
}

function negociar(tipo, s, q) {
  q = Math.floor(q);
  if (!(q > 0)) return aviso('Digite uma quantidade maior que zero.', false);
  const preco = estado.precos[s];
  const total = q * preco;
  let res = null;
  if (tipo === 'compra') {
    if (total > estado.saldo + 1e-9) {
      return aviso('Saldo insuficiente: essa compra custa ' + brl(total) + ' e você tem ' + brl(estado.saldo) + '.', false);
    }
    const p = estado.pos[s] || { q: 0, pm: 0 };
    p.pm = (p.pm * p.q + total) / (p.q + q);
    p.q += q;
    estado.pos[s] = p;
    estado.saldo -= total;
  } else {
    const p = estado.pos[s];
    if (!p || p.q < q) return aviso('Você não tem essa quantidade para vender.', false);
    res = (preco - p.pm) * q;
    p.q -= q;
    if (p.q === 0) delete estado.pos[s];
    estado.saldo += total;
  }
  estado.hist.push({ d: new Date().toLocaleString('pt-BR'), tipo: tipo, s: s, q: q, preco: preco, res: res });
  aviso((tipo === 'compra' ? 'Compra' : 'Venda') + ' feita: ' + q + ' x ' + s + ' a ' + brl(preco) + '.', true);
  salvar();
  renderTudo();
}

// ===== Mercado (montado uma vez; só os preços são atualizados) =====
function montarMercado() {
  let h = '<tr><th>Ativo</th><th>Tipo</th><th>Preço</th><th>Desde o início</th><th>Quantidade</th><th></th></tr>';
  ATIVOS.forEach(a => {
    h += '<tr><td><strong>' + a.s + '</strong><br><small>' + a.n + '</small></td>' +
      '<td>' + a.t + '</td>' +
      '<td id="preco-' + a.s + '"></td>' +
      '<td id="var-' + a.s + '"></td>' +
      '<td><input type="number" min="1" step="1" value="10" id="qtd-' + a.s + '" aria-label="Quantidade de ' + a.s + '"></td>' +
      '<td class="acoes"><button class="comprar" data-acao="compra" data-s="' + a.s + '">Comprar</button> ' +
      '<button class="vender" data-acao="venda" data-s="' + a.s + '">Vender</button></td></tr>';
  });
  $('mercado').innerHTML = h;
}
function atualizarPrecos() {
  ATIVOS.forEach(a => {
    $('preco-' + a.s).textContent = brl(estado.precos[a.s]);
    const v = (estado.precos[a.s] / a.p - 1) * 100;
    const el = $('var-' + a.s);
    el.textContent = pct(v);
    el.className = v >= 0 ? 'pos' : 'neg';
  });
}

// ===== Carteira, histórico, resumo =====
function renderCarteira() {
  const pat = patrimonio();
  const syms = Object.keys(estado.pos);
  let h = '<tr><th>Ativo</th><th>Qtd.</th><th>Preço médio</th><th>Preço atual</th><th>Valor</th><th>Resultado</th><th>% da carteira</th></tr>';
  if (!syms.length) {
    h += '<tr><td colspan="7" class="vazio">Você ainda não comprou nada. Escolha um ativo no mercado e clique em Comprar.</td></tr>';
  }
  syms.forEach(s => {
    const p = estado.pos[s], atual = estado.precos[s], valor = p.q * atual;
    const r = (atual - p.pm) * p.q, rp = (atual / p.pm - 1) * 100;
    h += '<tr><td><strong>' + s + '</strong></td><td>' + p.q + '</td><td>' + brl(p.pm) + '</td><td>' + brl(atual) +
      '</td><td>' + brl(valor) + '</td><td class="' + (r >= 0 ? 'pos' : 'neg') + '">' + brl(r) + ' (' + pct(rp) + ')</td>' +
      '<td>' + (valor / pat * 100).toFixed(1).replace('.', ',') + '%</td></tr>';
  });
  $('carteira').innerHTML = h;
}
function renderHistorico() {
  let h = '<tr><th>Data</th><th>Operação</th><th>Ativo</th><th>Qtd.</th><th>Preço</th><th>Lucro/prejuízo</th></tr>';
  const ult = estado.hist.slice(-15).reverse();
  if (!ult.length) h += '<tr><td colspan="6" class="vazio">Nenhuma operação ainda.</td></tr>';
  ult.forEach(o => {
    h += '<tr><td>' + o.d + '</td><td>' + (o.tipo === 'compra' ? 'Compra' : 'Venda') + '</td><td>' + o.s +
      '</td><td>' + o.q + '</td><td>' + brl(o.preco) + '</td><td class="' + (o.res === null ? '' : o.res >= 0 ? 'pos' : 'neg') + '">' +
      (o.res === null ? '-' : brl(o.res)) + '</td></tr>';
  });
  $('historico').innerHTML = h;
}
function renderResumo() {
  const pat = patrimonio(), r = pat - INICIAL;
  $('patrimonio').textContent = brl(pat);
  $('saldo').textContent = brl(estado.saldo);
  const el = $('resultado');
  el.textContent = brl(r) + ' (' + pct(r / INICIAL * 100) + ')';
  el.className = r >= 0 ? 'pos' : 'neg';
}

// ===== Gráfico =====
function desenhar() {
  const c = $('grafico'), g = c.getContext('2d'), w = c.width, h = c.height, s = estado.serie;
  g.clearRect(0, 0, w, h);
  const mn = Math.min.apply(null, s.concat(INICIAL)), mx = Math.max.apply(null, s.concat(INICIAL));
  const pad = (mx - mn) * 0.15 || 1000, lo = mn - pad, hi = mx + pad;
  const x = i => 20 + (w - 40) * (s.length === 1 ? 0 : i / (s.length - 1));
  const y = v => h - 20 - (h - 40) * (v - lo) / (hi - lo);
  g.strokeStyle = '#9ca3af'; g.lineWidth = 1; g.setLineDash([6, 6]);
  g.beginPath(); g.moveTo(20, y(INICIAL)); g.lineTo(w - 20, y(INICIAL)); g.stroke(); g.setLineDash([]);
  g.strokeStyle = '#0f766e'; g.lineWidth = 2.5; g.beginPath();
  s.forEach((v, i) => { if (i) g.lineTo(x(i), y(v)); else g.moveTo(x(i), y(v)); });
  g.stroke();
  g.fillStyle = '#374151'; g.font = '13px sans-serif';
  g.fillText('Máx: ' + brl(mx), 24, y(mx) - 6);
  g.fillText('Mín: ' + brl(mn), 24, y(mn) + 16);
  g.fillText('Linha tracejada = valor inicial', w - 220, h - 4);
}

function renderTudo() {
  atualizarPrecos();
  renderResumo();
  renderCarteira();
  renderHistorico();
  desenhar();
}

// ===== Passagem do tempo: os preços mudam a cada 3 segundos =====
function tick() {
  ATIVOS.forEach(a => {
    if (a.rf) estado.precos[a.s] *= 1.00004; // renda fixa: cresce devagar e sempre
    else estado.precos[a.s] = Math.max(1, estado.precos[a.s] * (1 + (Math.random() - 0.48) * 2 * a.v));
  });
  estado.serie.push(patrimonio());
  if (estado.serie.length > 150) estado.serie.shift();
  salvar();
  renderTudo();
}

// ===== Assistente educativo (funciona sem internet e sem custo) =====
const AJUDA = [
  [/diversific/, 'Diversificar é espalhar o dinheiro em ativos diferentes (ações, FIIs, renda fixa). Assim, se um deles cai muito, os outros ajudam a segurar o resultado. Não coloque tudo em uma coisa só.'],
  [/risco|volatil|perder/, 'Risco é a chance de o resultado ser diferente do esperado, inclusive de perder dinheiro. Ativos que podem render mais (como ações) costumam oscilar mais. Renda fixa oscila menos. Veja a coluna "Desde o início" no mercado para comparar.'],
  [/renda fixa|selic|cdb|tesouro/, 'Na renda fixa você empresta dinheiro (ao governo ou a um banco) e recebe juros. O Tesouro Selic acompanha a taxa Selic e tem pouca oscilação. Neste simulador, o preço dele sobe devagar e de forma constante.'],
  [/acao|acoes|bolsa/, 'Ação é um pedacinho de uma empresa. Se a empresa vai bem, o preço tende a subir e ela pode pagar dividendos. Se vai mal, o preço pode cair. Por isso o preço oscila bastante.'],
  [/fii|fundo imobiliario|imoveis|aluguel/, 'FII é um fundo que investe em imóveis (galpões, shoppings, prédios) e costuma distribuir rendimentos todo mês, vindos de aluguéis. O preço da cota também oscila.'],
  [/etf|bova|indice|ibovespa/, 'ETF é uma cesta de ativos negociada como se fosse uma ação. O BOVA11 acompanha o Ibovespa, o índice das principais ações da bolsa. É um jeito simples de diversificar com uma compra só.'],
  [/preco medio|pm/, 'Preço médio é a média ponderada do que você pagou. Exemplo: 10 ações a R$ 10 e depois 10 a R$ 20 dão preço médio de R$ 15. É com ele que se calcula seu lucro ou prejuízo.'],
  [/lucro|prejuizo|resultado|rentabilidade/, 'Seu resultado é (preço atual - preço médio) x quantidade. Enquanto você não vende, o lucro ou prejuízo é "não realizado". Ao vender, ele vira realizado e aparece no histórico.'],
  [/dividendo|provento/, 'Dividendos são parte do lucro que algumas empresas distribuem aos acionistas. Este simulador ainda não paga dividendos, mas no mundo real eles fazem parte do retorno.'],
  [/inflacao|ipca/, 'Inflação é o aumento geral dos preços. Se seu investimento rende menos que a inflação, você perde poder de compra mesmo vendo o saldo subir.'],
  [/comecar|iniciar|como|ajuda|oi|ola/, 'Para começar: 1) olhe o mercado, 2) comece com valores pequenos, 3) misture tipos de ativos, 4) acompanhe o gráfico. Quando quiser, clique em "Analisar minha carteira" ou pergunte sobre diversificação, risco, renda fixa, ações, FII ou ETF.']
];

function normalizar(t) {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}
function analisarCarteira() {
  const pat = patrimonio(), syms = Object.keys(estado.pos);
  if (!syms.length) return 'Sua carteira está vazia: 100% em dinheiro parado. Parado, ele não rende. Experimente começar com uma parte em renda fixa (SELIC) e outra em ações ou ETF.';
  let maior = null, mv = 0;
  syms.forEach(s => { const v = estado.pos[s].q * estado.precos[s]; if (v > mv) { mv = v; maior = s; } });
  const tipos = {};
  syms.forEach(s => { const a = ATIVOS.find(x => x.s === s); tipos[a.t] = true; });
  const dMaior = mv / pat * 100, caixa = estado.saldo / pat * 100;
  const out = ['Você tem ' + syms.length + ' ativo(s) em ' + Object.keys(tipos).length + ' tipo(s), e ' + caixa.toFixed(0) + '% do patrimônio está em caixa.'];
  if (dMaior > 40) out.push('Atenção: ' + maior + ' representa ' + dMaior.toFixed(0) + '% da carteira. Concentrar muito em um ativo aumenta o risco.');
  else out.push('Nenhum ativo passa de 40% da carteira, o que é um bom sinal de diversificação.');
  if (Object.keys(tipos).length < 2) out.push('Tente misturar tipos diferentes (ação, FII, ETF, renda fixa).');
  if (caixa > 70) out.push('Muito dinheiro está parado em caixa, sem render.');
  out.push('Lembrando: isso é um exercício educativo, não uma recomendação de investimento.');
  return out.join(' ');
}
function responder(txt) {
  const t = normalizar(txt);
  if (/analis|minha carteira|avali/.test(t)) return analisarCarteira();
  for (let i = 0; i < AJUDA.length; i++) if (AJUDA[i][0].test(t)) return AJUDA[i][1];
  return 'Ainda não sei responder isso. Pergunte sobre: diversificação, risco, renda fixa, ações, FII, ETF, preço médio, lucro, dividendos ou inflação. Ou clique em "Analisar minha carteira".';
}
function chat(autor, txt) {
  const d = document.createElement('div');
  d.className = 'bolha ' + autor;
  d.textContent = txt;
  $('chat').appendChild(d);
  $('chat').scrollTop = $('chat').scrollHeight;
}
function perguntar(txt) {
  txt = txt.trim();
  if (!txt) return;
  chat('eu', txt);
  chat('ia', responder(txt));
}

// ===== Eventos =====
$('mercado').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  negociar(b.dataset.acao, b.dataset.s, Number($('qtd-' + b.dataset.s).value));
});
$('formChat').addEventListener('submit', e => {
  e.preventDefault();
  perguntar($('pergunta').value);
  $('pergunta').value = '';
});
$('analisar').addEventListener('click', () => perguntar('Analisar minha carteira'));
$('reiniciar').addEventListener('click', () => {
  if ($('reiniciar').dataset.confirma === '1') {
    estado = novoEstado();
    salvar();
    $('reiniciar').dataset.confirma = '0';
    $('reiniciar').textContent = 'Recomeçar do zero';
    aviso('Simulação reiniciada com R$ 100.000,00.', true);
    renderTudo();
  } else {
    $('reiniciar').dataset.confirma = '1';
    $('reiniciar').textContent = 'Clique de novo para confirmar';
  }
});

montarMercado();
renderTudo();
chat('ia', 'Olá! Sou o assistente do simulador. Pergunte sobre risco, diversificação, renda fixa, ações, FII ou ETF, ou peça para analisar sua carteira.');
setInterval(tick, 3000);