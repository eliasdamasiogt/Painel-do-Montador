import './style.css';
import { supabase } from './supabase.js';
import * as api from './api.js';
import { gerarPDF, compartilharPDF } from './pdf.js';
import * as tabelaMod from './tabela.js';
import * as caixaMod from './caixa.js';
import * as agendaMod from './agenda.js';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
const fh = (m) => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? h + 'h ' + String(r).padStart(2, '0') + 'min' : h + 'h') : r + 'min'; };
const clock = (ms) => { const s = Math.floor(ms / 1000); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':'); };
const round5 = (n) => Math.max(0, Math.round(n / 5) * 5);

const TIPOS = ['Montagem', 'Desmontagem e montagem', 'Instalação'];
const TOOLS = ['Parafusadeira', 'Furadeira', 'Jogo de chaves', 'Martelo de borracha', 'Trena', 'Nível', 'Esquadro', 'Fita crepe'];
const GARGALOS = ['Desembalar', 'Organizar peças', 'Erro de montagem', 'Peça faltando ou com defeito', 'Retrabalho', 'Celular', 'Deslocamento', 'Falta de ferramenta'];

function dayStr(add) { const d = new Date(); d.setDate(d.getDate() + add); return api.localDay(d.toISOString()); }
const emptyDraft = () => ({ cliente: '', tel: '', bairro: '', itens: [], cobrado: null, foto: null });
const blank = () => ({ uid: null, email: '', logo: null, logoPath: null, nome: '', meta: 4000, custos: 0, dias: 12, hdia: 6, budgets: [], tabela: [], lanc: [], disp: {}, draft: emptyDraft(), osId: null });
let S = blank();

/* ---------- utilidades ---------- */
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
// Grava em segundo plano; avisa se falhar
function bg(p) { Promise.resolve(p).catch(() => toast('Não salvou. Verifique a internet.')); }
let profTimer = null;
function saveProfileSoon(v) { clearTimeout(profTimer); profTimer = setTimeout(() => bg(api.saveProfile(S.uid, v)), 600); }
function saveAllProfile() { saveProfileSoon({ nome: S.nome, meta: S.meta, custos: S.custos, dias: S.dias, hdia: S.hdia }); }

const ICON = {
  inicio: '<svg viewBox="0 0 24 24"><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
  orcamentos: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></svg>',
  agenda: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  caixa: '<svg viewBox="0 0 24 24"><path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 7l11-3v3M16 14h2"/></svg>',
  mais: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/></svg>',
};
const UPLOAD = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14"/></svg>';
const TABS = [['inicio', 'Início'], ['orcamentos', 'Orçamentos'], ['agenda', 'Agenda'], ['caixa', 'Caixa'], ['mais', 'Mais']];
$('#tabs').innerHTML = TABS.map((t) => '<a href="#' + t[0] + '" data-t="' + t[0] + '">' + ICON[t[0]] + t[1] + '</a>').join('');

function fileToData(file, max, mime, q, cb) {
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d');
      if (mime === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
      x.drawImage(im, 0, 0, c.width, c.height);
      cb(c.toDataURL(mime, q));
    };
    im.onerror = () => toast('Não consegui abrir essa imagem');
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
}
// Deixa a logo redonda: corta o fundo (cor dos cantos) e recorta um círculo com cantos transparentes
function circleLogo(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      try {
        const w = im.naturalWidth, h = im.naturalHeight, c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0);
        const d = x.getImageData(0, 0, w, h).data;
        const px = (i, j) => { const k = (j * w + i) * 4; return [d[k], d[k + 1], d[k + 2]]; };
        const cs = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)];
        const bgc = [0, 1, 2].map((n) => cs.reduce((s, p) => s + p[n], 0) / 4);
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            const k = (j * w + i) * 4;
            if (d[k + 3] < 10) continue;
            const df = Math.max(Math.abs(d[k] - bgc[0]), Math.abs(d[k + 1] - bgc[1]), Math.abs(d[k + 2] - bgc[2]));
            if (df > 48) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
          }
        }
        if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
        const side = Math.max(x1 - x0 + 1, y1 - y0 + 1), cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
        const sz = Math.min(512, Math.round(side));
        const out = document.createElement('canvas'); out.width = out.height = sz;
        const o = out.getContext('2d');
        o.beginPath(); o.arc(sz / 2, sz / 2, sz / 2 - 0.5, 0, Math.PI * 2); o.closePath(); o.clip();
        o.drawImage(c, cx - side / 2, cy - side / 2, side, side, 0, 0, sz, sz);
        res(out.toDataURL('image/png'));
      } catch (e) { res(src); }
    };
    im.onerror = () => res(src);
    im.src = src;
  });
}
const logoHTML = (big) => (S.logo ? '<img src="' + S.logo + '" alt="Sua logo">' : big ? UPLOAD + '<span>Sua logo aqui</span>' : UPLOAD);

/* ---------- cálculos ---------- */
const hourly = () => { const h = S.dias * S.hdia; return h > 0 ? (S.meta + S.custos) / h : 0; };
const status = (b) => b.status;
const totalMin = (it) => it.reduce((s, i) => s + (+i.min || 0), 0);
const elapsed = (i) => i.real + (i.running ? Date.now() - i.since : 0);
const realMin = (os) => os.itens.reduce((s, i) => s + elapsed(i), 0) / 60000;
function avgReal(nome) {
  const v = [];
  S.budgets.forEach((b) => { if (b.os && b.os.fim) b.os.itens.forEach((i) => { if (i.nome === nome && i.done) v.push(i.real / 60000); }); });
  return v.length ? round5(v.reduce((a, b) => a + b, 0) / v.length) : null;
}
function results() {
  const done = S.budgets.filter((b) => b.os && b.os.fim);
  const rates = done.map((b) => b.cobrado / (realMin(b.os) / 60)).filter(isFinite);
  const cnt = {};
  done.forEach((b) => b.os.gargalos.forEach((g) => { cnt[g] = (cnt[g] || 0) + 1; }));
  return { done, avg: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null, cnt };
}
function renderTop() {
  $('#topLogo').innerHTML = logoHTML(false);
  $('#topName').textContent = S.nome || 'Seu nome ou empresa';
  $('#topRate').textContent = brl(hourly()) + '/h';
  renderBanner();
}
function runInfo() {
  for (const b of S.budgets) if (b.os && !b.os.fim) for (const i of b.os.itens) if (i.running) return { b, i };
  return null;
}
function renderBanner() {
  const el = $('#runBanner'); if (!el) return;
  const r = runInfo();
  if (!r || location.hash === '#servico') { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = '<button class="runban" data-a="openos" data-id="' + r.b.id + '"><span class="live"></span><span class="rn2"><b>' + esc(r.i.nome) + '</b> · ' + esc(r.b.cliente) + '</span><span class="clock" data-rb>' + clock(elapsed(r.i)) + '</span></button>';
}
const fmtDate = (s) => { if (!s) return ''; const p = s.split('-'); return p[2] + '/' + p[1]; };

/* ---------- INÍCIO ---------- */
function renderInicio() {
  const R = results();
  const env = S.budgets.filter((b) => status(b) === 'enviado').length;
  const ag = S.budgets.filter((b) => status(b) === 'aprovado');
  const prox = ag.slice().sort((a, b) => (a.os.data || '9').localeCompare(b.os.data || '9'))[0];
  let max = 0; Object.keys(R.cnt).forEach((k) => { max = Math.max(max, R.cnt[k]); });
  const rows = Object.keys(R.cnt).sort((a, b) => R.cnt[b] - R.cnt[a]).map((g) =>
    '<div style="margin-bottom:12px"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span>' + esc(g) + '</span><span class="muted small">' + R.cnt[g] + 'x</span></div><div class="bar"><i style="width:' + (R.cnt[g] / max * 100) + '%"></i></div></div>').join('');
  const avg = R.avg == null ? '—' : brl(R.avg);
  const diff = R.avg == null ? '' : (R.avg >= hourly() ? 'acima' : 'abaixo') + ' da sua meta de ' + brl(hourly());
  $('#v-inicio').innerHTML =
    '<h1>Seu dia de trabalho</h1><p class="sub">Orçamentos em andamento, próximo serviço e onde o tempo está indo.</p>' +
    '<div class="row"><button class="btn sm" data-a="goto" data-v="orcar">+ Novo orçamento</button><button class="btn ghost sm" data-a="goto" data-v="caixa">Lançar gasto</button></div>' +
    '<div class="stats"><div><span class="num">' + env + '</span><span class="t">aguardando resposta</span></div><div><span class="num">' + ag.length + '</span><span class="t">serviços agendados</span></div><div><span class="num">' + avg + '</span><span class="t">valor/h real médio</span></div></div>' +
    (diff ? '<p class="small muted" style="margin:6px 0 0">Média dos serviços concluídos: ' + diff + '.</p>' : '') +
    '<h2>Próximo serviço</h2>' +
    (prox ? '<div class="card stack"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0"><b>' + esc(prox.cliente) + '</b><div class="muted small">' + esc(prox.bairro) + ' · ' + prox.os.itens.length + ' serviços · previsto ' + fh(totalMin(prox.itens)) + '</div></div><span class="pill app">' + fmtDate(prox.os.data) + '</span></div><button class="btn" data-a="openos" data-id="' + prox.id + '">Abrir ordem de serviço</button></div>'
      : '<div class="card muted">Nenhum serviço agendado. Aprove um orçamento para gerar a ordem de serviço.</div>') +
    '<h2>Onde você perde tempo</h2>' +
    (rows ? '<div class="card">' + rows + '</div>' : '<div class="card muted">Conclua um serviço e marque os gargalos para ver o padrão aparecer aqui.</div>');
}

/* ---------- MAIS ---------- */
function linkCard(v, titulo, sub) {
  return '<button class="card linkrow" data-a="goto" data-v="' + v + '"><span style="min-width:0"><b>' + titulo + '</b><span class="muted small" style="display:block">' + sub + '</span></span><span class="muted" style="font-size:22px">›</span></button>';
}
function renderMais() {
  $('#v-mais').innerHTML =
    '<h1>Mais</h1><p class="sub">Ajustes e ferramentas de apoio.</p>' +
    '<div class="stack">' + linkCard('valor', 'Valor-hora', 'Quanto você precisa cobrar por hora') + linkCard('tabela', 'Tabela de referência', 'Preços médios do mercado por móvel') + '</div>' +
    '<h2>Sua marca</h2>' +
    '<div class="card row" style="flex-wrap:nowrap;align-items:center"><button class="slot big" data-a="logo" aria-label="Enviar sua logo">' + logoHTML(true) + '</button><label class="field" style="flex:1"><span class="lbl">Nome no orçamento</span><input class="in" id="nome" value="' + esc(S.nome) + '" placeholder="Seu nome ou empresa"></label></div>' +
    '<p class="small muted" style="margin:8px 2px 0">A logo e o nome aparecem no cabeçalho e no PDF do orçamento.</p>' +
    '<h2>Conta</h2><div class="card row" style="justify-content:space-between"><span class="muted small" style="overflow-wrap:anywhere;min-width:0">' + esc(S.email) + '</span><button class="btn ghost sm" data-a="sair">Sair</button></div>';
}

/* ---------- VALOR/H ---------- */
function renderValor() {
  $('#v-valor').innerHTML =
    '<h1>Quanto você precisa cobrar por hora</h1><p class="sub">Conte quanto quer ganhar no mês e quantas horas você realmente fatura. O app faz a conta.</p>' +
    '<div class="card stack">' +
    '<label class="field"><span class="lbl">Quanto quer ganhar por mês (R$)</span><input class="in" inputmode="decimal" data-n="meta" value="' + S.meta + '"></label>' +
    '<label class="field"><span class="lbl">Custos do mês: ferramentas, transporte, celular (R$)</span><input class="in" inputmode="decimal" data-n="custos" value="' + S.custos + '"></label>' +
    '<div class="grid2"><label class="field"><span class="lbl">Dias de trabalho no mês</span><input class="in" inputmode="decimal" data-n="dias" value="' + S.dias + '"></label>' +
    '<label class="field"><span class="lbl">Horas faturáveis por dia</span><input class="in" inputmode="decimal" data-n="hdia" value="' + S.hdia + '"></label></div>' +
    '</div>' +
    '<h2>Seu valor-hora ideal</h2>' +
    '<div class="hero-rate"><span class="lbl">Cobrar no mínimo</span><span class="num" id="vh"></span><div class="muted small" id="vh2" style="margin-top:8px"></div></div>' +
    '<div class="note" style="margin-top:16px">Use horas faturáveis, não horas de relógio. Deslocamento, orçamentos e dias sem serviço não entram nessa conta, e por isso o valor-hora precisa ser maior do que parece.</div>' +
    '<h2>Na prática</h2><div class="card tw"><table id="vtab"></table></div>';
  updValor();
}
function updValor() {
  const vh = hourly();
  if ($('#vh')) {
    $('#vh').textContent = brl(vh) + '/h';
    $('#vh2').textContent = (S.dias * S.hdia) + ' horas faturáveis por mês para cobrir ' + brl(S.meta + S.custos) + '.';
    $('#vtab').innerHTML = '<tr><th>Serviço</th><th class="r">Tempo</th><th class="r">Preço</th></tr>' + [['Painel de TV', 30], ['Cômoda', 90], ['Guarda-roupa 6 portas', 120]].map((r) => '<tr><td>' + r[0] + '</td><td class="r">' + fh(r[1]) + '</td><td class="r">' + brl(r[1] / 60 * vh) + '</td></tr>').join('');
  }
  renderTop();
}

/* ---------- ORÇAR ---------- */
function renderOrcar() {
  const d = S.draft;
  $('#v-orcar').innerHTML =
    '<button class="linkbtn" style="text-decoration:none;padding:0" data-a="goto" data-v="orcamentos">‹ Orçamentos</button>' +
    '<h1 style="margin-top:6px">Novo orçamento</h1><p class="sub">Cliente, serviços e tempo de cada um. O preço sai do seu valor-hora.</p>' +
    '<div class="card stack"><label class="field"><span class="lbl">Nome do cliente</span><input class="in" data-d="cliente" value="' + esc(d.cliente) + '" placeholder="Ex.: Marina Souza"></label>' +
    '<div class="grid2"><label class="field"><span class="lbl">WhatsApp (com DDD)</span><input class="in" inputmode="tel" data-d="tel" value="' + esc(d.tel) + '" placeholder="(31) 9 0000-0000"></label>' +
    '<label class="field"><span class="lbl">Bairro</span><input class="in" data-d="bairro" value="' + esc(d.bairro) + '" placeholder="Bairro"></label></div></div>' +
    '<h2>Serviços</h2>' +
    '<div class="stack" style="gap:8px;margin-bottom:10px">' + tabelaMod.picker() + '</div>' +
    '<div class="card" id="rows" style="padding-top:4px;padding-bottom:4px"></div>' +
    '<h2>Foto do móvel</h2>' +
    '<div class="card row" style="flex-wrap:nowrap"><button class="slot big" style="border-radius:12px;width:96px" data-a="foto" aria-label="Enviar foto do móvel">' + (d.foto ? '<img src="' + d.foto + '" alt="Foto do móvel">' : UPLOAD + '<span>Foto</span>') + '</button><p class="small muted" style="margin:0">Opcional. A foto aparece no orçamento em PDF.</p></div>' +
    '<h2>Resumo</h2>' +
    '<div class="card stack"><div class="row" style="justify-content:space-between"><span class="muted">Tempo total</span><b class="num" id="o-total"></b></div>' +
    '<div class="row" style="justify-content:space-between"><span class="muted">Previsão</span><b id="o-dias"></b></div>' +
    '<div class="row" style="justify-content:space-between"><span class="muted">Preço sugerido</span><b class="num" id="o-sug"></b></div>' +
    '<div id="o-ref"></div>' +
    '<label class="field"><span class="lbl">Valor que vou cobrar (R$)</span><input class="in" inputmode="decimal" id="o-cob"></label>' +
    '<div class="row" style="justify-content:space-between"><span class="muted">Valor/h neste preço</span><b class="num" id="o-eff"></b></div>' +
    '<div id="o-warn"></div>' +
    '<button class="btn block" id="gerarBtn" data-a="gerar">Gerar orçamento</button></div>';
  drawRows(); updOrc(true); tabelaMod.fillResults(ctx);
}
function drawRows() {
  const d = S.draft;
  $('#rows').innerHTML = d.itens.length ? d.itens.map((it, i) =>
    '<div class="item" data-r="' + i + '"><label class="field nm"><span class="lbl">Móvel</span><input class="in" data-f="nome" value="' + esc(it.nome) + '" placeholder="Ex.: Guarda-roupa"></label>' +
    '<span></span>' +
    '<label class="field tp"><span class="lbl">Tipo</span><select class="in" data-f="tipo">' + TIPOS.map((t) => '<option' + (t === it.tipo ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></label>' +
    '<label class="field" style="grid-column:2"><span class="lbl">Minutos</span><input class="in" inputmode="numeric" data-f="min" value="' + it.min + '"></label>' +
    '<button class="x" data-a="delrow" data-i="' + i + '" aria-label="Remover serviço">✕</button>' +
    (it.refMin != null ? '<div class="small muted" style="grid-column:1/4">Referência de mercado: ' + (it.refMax == null ? brl(it.refMin) : brl(it.refMin) + ' a ' + brl(it.refMax)) + '</div>' : '') + '</div>').join('')
    : '<p class="muted" style="margin:14px 0">Busque um móvel na tabela acima ou toque em "Outro móvel" para adicionar o primeiro serviço.</p>';
}
function updOrc(init) {
  const d = S.draft, m = totalMin(d.itens), vh = hourly(), sug = round5(m / 60 * vh);
  if (!$('#o-total')) return;
  $('#o-total').textContent = fh(m);
  const hd = S.hdia * 60, dias = hd > 0 ? Math.ceil(m / hd) : 0;
  $('#o-dias').textContent = m === 0 ? '—' : (dias <= 1 ? 'Cabe em 1 dia' : dias + ' dias de trabalho');
  $('#o-sug').textContent = brl(sug);
  const cob = d.cobrado == null ? sug : d.cobrado;
  const inp = $('#o-cob'); if (init || document.activeElement !== inp) inp.value = cob;
  const eff = m > 0 ? cob / (m / 60) : 0;
  $('#o-eff').textContent = m > 0 ? brl(eff) + '/h' : '—';
  $('#o-warn').innerHTML = (m > 0 && eff < vh * 0.95) ? '<div class="note" style="border-color:var(--bad)">Esse preço fica abaixo do seu valor-hora ideal de ' + brl(vh) + '.</div>' : '';
  const refs = d.itens.filter((i) => i.refMin != null);
  if (refs.length) {
    const rmin = refs.reduce((s, i) => s + i.refMin, 0), rmax = refs.reduce((s, i) => s + (i.refMax == null ? i.refMin : i.refMax), 0);
    const parcial = refs.length < d.itens.length ? ' (' + refs.length + ' de ' + d.itens.length + ' itens)' : '';
    const abaixo = cob < rmin ? ' Seu preço está abaixo da referência.' : '';
    $('#o-ref').innerHTML = '<div class="note">Referência de mercado: ' + (rmin === rmax ? brl(rmin) : brl(rmin) + ' a ' + brl(rmax)) + parcial + '.' + abaixo + '</div>';
  } else $('#o-ref').innerHTML = '';
}

/* ---------- ORÇAMENTOS ---------- */
function renderOrcamentos() {
  const list = S.budgets.slice().sort((a, b) => b.n - a.n);
  const pill = { enviado: ['send', 'Enviado'], aprovado: ['app', 'Aprovado'], concluido: ['done', 'Concluído'], recusado: ['no', 'Recusado'] };
  $('#v-orcamentos').innerHTML = '<h1>Orçamentos</h1><p class="sub">Marque como aprovado quando o cliente fechar. A ordem de serviço é criada na hora.</p>' +
    '<div class="row" style="margin-bottom:14px"><button class="btn" data-a="goto" data-v="orcar">+ Novo orçamento</button></div>' +
    (list.length ? '<div class="stack">' + list.map((b) => {
      const s = status(b), p = pill[s];
      const glow = (s === 'aprovado' || s === 'concluido') ? ' glow-ok' : (s === 'recusado' ? ' glow-no' : '');
      return '<div class="card stack' + glow + '"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0"><b>' + esc(b.cliente) + '</b><div class="muted small">Nº ' + String(b.n).padStart(4, '0') + ' · ' + esc(b.bairro || 'sem bairro') + ' · ' + fmtDate(b.data) + '</div></div><span class="pill ' + p[0] + '">' + p[1] + '</span></div>' +
        '<div class="row" style="justify-content:space-between"><span class="muted small">' + b.itens.length + ' serviços · ' + fh(totalMin(b.itens)) + '</span><b class="num">' + brl(b.cobrado) + '</b></div>' +
        '<div class="row"><button class="btn ghost sm" data-a="ver" data-id="' + b.id + '">Ver e enviar</button>' +
        (s === 'enviado' ? '<button class="btn sm ok" data-a="aprovar" data-id="' + b.id + '">Aprovado</button><button class="btn sm no" data-a="recusar" data-id="' + b.id + '">Recusou</button>' : '') +
        (s === 'aprovado' ? '<button class="btn sm" data-a="openos" data-id="' + b.id + '">Abrir OS</button>' : '') +
        (s === 'concluido' ? '<button class="btn sm" data-a="openos" data-id="' + b.id + '">Ver resultado</button>' : '') +
        '</div></div>';
    }).join('') + '</div>' : '<div class="card muted">Nenhum orçamento ainda. Toque em "Novo orçamento".</div>');
}

/* ---------- folha do orçamento ---------- */
async function ensureFoto(b) {
  if (b.fotoData || !b.fotoPath) return;
  try { b.fotoData = await api.downloadAsDataUrl(b.fotoPath); } catch (e) { /* segue sem foto */ }
}
function showSheet(id) {
  const b = S.budgets.filter((x) => x.id === id)[0]; if (!b) return;
  const el = $('#sheet'); el.hidden = false; el.dataset.id = id;
  const val = new Date(b.data + 'T12:00:00'); val.setDate(val.getDate() + 7);
  el.innerHTML = '<div class="sheet-wrap" data-a="fechar"><div class="sheet" data-stop>' +
    '<div class="hd"><span class="slot">' + (S.logo ? '<img src="' + S.logo + '" alt="Logo">' : UPLOAD) + '</span><div><b>' + esc(S.nome || 'Seu nome ou empresa') + '</b><span class="muted small">Montagem e instalação de móveis</span></div></div>' +
    '<div class="bd">' + (b.fotoData ? '<div class="photo" style="background-image:url(' + b.fotoData + ')"></div>' : '') +
    '<span class="lbl">Orçamento Nº ' + String(b.n).padStart(4, '0') + '</span>' +
    '<dl class="kv"><dt>Cliente</dt><dd>' + esc(b.cliente) + '</dd><dt>Bairro</dt><dd>' + esc(b.bairro || '—') + '</dd><dt>Emissão</dt><dd>' + fmtDate(b.data) + '</dd><dt>Validade</dt><dd>' + String(val.getDate()).padStart(2, '0') + '/' + String(val.getMonth() + 1).padStart(2, '0') + '</dd></dl>' +
    '<h2>Serviços</h2><div class="tw"><table><tr><th>Móvel</th><th>Serviço</th><th class="r">Tempo</th></tr>' + b.itens.map((i) => '<tr><td>' + esc(i.nome) + '</td><td>' + esc(i.tipo) + '</td><td class="r">' + fh(i.min) + '</td></tr>').join('') + '</table></div>' +
    '<div class="tot"><span class="lbl" style="margin:0">Total</span><span class="num">' + brl(b.cobrado) + '</span></div>' +
    '<p class="small muted" style="margin:6px 0 0">Não incluso: frete, serviços extras durante o atendimento e avarias nas peças que impeçam a montagem.</p>' +
    '<label class="field" style="margin-top:16px"><span class="lbl">WhatsApp do cliente (com DDD)</span><input class="in" id="sheet-tel" inputmode="tel" value="' + esc(b.tel) + '" placeholder="(31) 9 0000-0000"></label>' +
    '<div class="stack" style="margin-top:12px"><button class="btn block" data-a="zap" data-id="' + b.id + '">Enviar no WhatsApp</button><button class="btn ghost block" data-a="pdf" data-id="' + b.id + '">Compartilhar PDF</button><button class="btn ghost block" data-a="fechar">Fechar</button></div>' +
    '<p class="small muted" style="margin:10px 0 0">O WhatsApp abre direto na conversa com o cliente, com o resumo e o link do PDF já na mensagem.</p></div></div></div>';
  if (b.fotoPath && !b.fotoData) ensureFoto(b).then(() => { if (!$('#sheet').hidden && $('#sheet').dataset.id === id && b.fotoData) showSheet(id); });
}

/* ---------- SERVIÇO ---------- */
const curB = () => S.budgets.filter((b) => b.id === S.osId && b.os)[0] || null;
function renderServico() {
  const b = curB(), el = $('#v-servico');
  if (!b) { el.innerHTML = '<h1>Serviço do dia</h1><div class="card muted">Nenhuma ordem de serviço aberta. Aprove um orçamento na aba Orçamentos.</div>'; return; }
  const os = b.os, fim = !!os.fim, allDone = os.itens.every((i) => i.done);
  el.innerHTML = '<h1>' + esc(b.cliente) + '</h1><p class="sub">' + esc(b.bairro || '') + ' · OS do orçamento Nº ' + String(b.n).padStart(4, '0') + ' · ' + brl(b.cobrado) + '</p>' +
    '<div class="card stack"><div class="grid2"><label class="field"><span class="lbl">Data do serviço</span><input class="in" type="date" id="os-data" value="' + esc(os.data || '') + '"></label>' +
    '<div><span class="lbl">Chegada</span>' + (os.checkin ? '<div class="num" style="padding:10px 0">' + new Date(os.checkin).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</div>' : '<button class="btn sm block" data-a="checkin"' + (fim ? ' disabled' : '') + '>Check-in</button>') + '</div></div></div>' +
    '<h2>Ferramentas</h2><div class="card"><div class="grid2">' + TOOLS.map((t) => '<label class="chk"><input type="checkbox" data-tool="' + esc(t) + '"' + (os.tools[t] !== false ? ' checked' : '') + '> <span>' + esc(t) + '</span></label>').join('') + '</div>' +
    '<label class="field" style="margin-top:8px"><span class="lbl">Ferramenta especial deste serviço</span><input class="in" id="os-extra" value="' + esc(os.extras) + '" placeholder="Ex.: serra copo, bucha especial"></label></div>' +
    '<h2>Serviços</h2><div class="card" style="padding-top:2px;padding-bottom:2px">' + os.itens.map((i, k) => {
      const stt = i.done ? '<span class="pill done">Concluído</span>' : (i.running ? '<span class="pill app">Em andamento</span>' : (i.real ? '<span class="pill send">Pausado</span>' : '<span class="pill">Aguardando</span>'));
      const ctl = fim || i.done ? '' : (i.running ? '<button class="btn ghost sm" data-a="pause" data-k="' + k + '">Pausar</button><button class="btn sm" data-a="finish" data-k="' + k + '">Concluir</button>' : '<button class="btn sm" data-a="start" data-k="' + k + '">' + (i.real ? 'Retomar' : 'Iniciar') + '</button>' + (i.real ? '<button class="btn sm" data-a="finish" data-k="' + k + '">Concluir</button>' : ''));
      return '<div class="svc stack" style="gap:8px"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0"><b>' + esc(i.nome) + '</b><div class="muted small">' + esc(i.tipo) + ' · previsto ' + fh(i.min) + '</div></div>' + stt + '</div>' +
        '<div class="row" style="justify-content:space-between"><span class="clock" data-tick="' + k + '">' + clock(elapsed(i)) + '</span><div class="row">' + ctl + '</div></div></div>';
    }).join('') + '</div>' +
    (fim ? resultHTML(b) : '<button class="btn block" style="margin-top:18px" data-a="encerrar"' + (allDone ? '' : ' disabled') + '>Encerrar serviço e ver resultado</button>' + (allDone ? '' : '<p class="small muted" style="margin:8px 2px 0">Conclua todos os serviços para ver o resultado.</p>'));
}
function resultHTML(b) {
  const os = b.os, rm = realMin(os), pm = totalMin(b.itens), eff = rm > 0 ? b.cobrado / (rm / 60) : 0, vh = hourly(), pct = vh > 0 ? eff / vh : 0;
  const tag = pct >= 1 ? ['done', 'Acima da meta'] : (pct >= 0.9 ? ['send', 'Quase na meta'] : ['no', 'Abaixo da meta']);
  const d = rm - pm;
  return '<h2>Resultado</h2><div class="hero-rate"><span class="lbl">Valor/h que você recebeu de fato</span><span class="num">' + brl(eff) + '/h</span>' +
    '<div class="row" style="margin-top:10px;justify-content:space-between"><span class="pill ' + tag[0] + '">' + tag[1] + '</span><span class="muted small">Meta ' + brl(vh) + '/h</span></div></div>' +
    '<div class="card stack" style="margin-top:12px"><div class="row" style="justify-content:space-between"><span class="muted">Previsto</span><b class="num">' + fh(pm) + '</b></div><div class="row" style="justify-content:space-between"><span class="muted">Tempo real</span><b class="num">' + fh(rm) + '</b></div><div class="row" style="justify-content:space-between"><span class="muted">Diferença</span><b class="num" style="color:' + (d > 0 ? 'var(--bad)' : 'var(--ok)') + '">' + (d > 0 ? '+' : '') + fh(Math.abs(d)) + (d < 0 ? ' a menos' : '') + '</b></div></div>' +
    '<div class="card tw" style="margin-top:12px"><table><tr><th>Móvel</th><th class="r">Previsto</th><th class="r">Real</th></tr>' + os.itens.map((i) => { const r = i.real / 60000; return '<tr><td>' + esc(i.nome) + '</td><td class="r">' + fh(i.min) + '</td><td class="r" style="color:' + (r > i.min * 1.05 ? 'var(--bad)' : 'var(--ok)') + '">' + fh(r) + '</td></tr>'; }).join('') + '</table></div>' +
    '<h2>O que atrasou?</h2><div class="row">' + GARGALOS.map((g) => '<button class="chip' + (os.gargalos.indexOf(g) > -1 ? ' on' : '') + '" data-a="garg" data-g="' + esc(g) + '">' + esc(g) + '</button>').join('') + '</div>' +
    '<p class="small muted" style="margin:10px 2px 0">Cada marcação entra no histórico da tela Início, e os tempos reais passam a sugerir o tempo dos próximos orçamentos.</p>';
}

/* ---------- roteamento ---------- */
const num = (v) => { const t = String(v == null ? '' : v).trim(); if (!t) return NaN; return parseFloat(t.indexOf(',') > -1 ? t.replace(/\./g, '').replace(',', '.') : t); };
const ctx = {
  get S() { return S; }, $, esc, brl, fh, fmtDate, dayStr, toast, num, avgReal,
  refreshOrcar() { drawRows(); updOrc(); },
};
const VIEWS = {
  inicio: renderInicio, orcar: renderOrcar, orcamentos: renderOrcamentos, servico: renderServico, valor: renderValor, mais: renderMais,
  agenda: () => agendaMod.render(ctx), caixa: () => caixaMod.render(ctx), tabela: () => tabelaMod.render(ctx),
};
const TABMAP = { orcar: 'orcamentos', servico: 'inicio', valor: 'mais', tabela: 'mais' };
function route() {
  if (!S.uid) return;
  let v = location.hash.slice(1); if (!VIEWS[v]) v = 'inicio';
  const tab = TABMAP[v] || v;
  $$('[data-view]').forEach((el) => el.classList.toggle('on', el.id === 'v-' + v));
  $$('#tabs a').forEach((el) => el.classList.toggle('on', el.getAttribute('data-t') === tab));
  VIEWS[v]();
  if (v === 'valor' || v === 'tabela') $('#v-' + v).insertAdjacentHTML('afterbegin', '<button class="linkbtn" style="text-decoration:none;padding:0 0 6px" data-a="goto" data-v="mais">‹ Mais</button>');
  renderTop(); window.scrollTo(0, 0);
}
function go(v) { if (location.hash === '#' + v) route(); else location.hash = '#' + v; }
window.addEventListener('hashchange', route);

/* ---------- eventos ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-a]'); if (!t) return;
  const a = t.getAttribute('data-a'), id = t.getAttribute('data-id'), i = +t.getAttribute('data-i'), k = +t.getAttribute('data-k');
  try {
    if (a === 'fechar') { if (e.target.closest('[data-stop]') && t.classList.contains('sheet-wrap')) return; $('#sheet').hidden = true; $('#sheet').innerHTML = ''; return; }
    if (a === 'logo') { $('#logoFile').click(); return; }
    if (a === 'foto') { $('#fotoFile').click(); return; }
    if (a === 'sair') { await api.sair(); return; }
    if (a === 'goto') { go(t.getAttribute('data-v')); return; }
    if (a === 'addrow') { S.draft.itens.push({ nome: '', tipo: 'Montagem', min: 60 }); drawRows(); updOrc(); return; }
    if (a === 'delrow') { S.draft.itens.splice(i, 1); drawRows(); updOrc(); return; }
    if (a === 'gerar') {
      const d = S.draft, its = d.itens.filter((x) => x.nome.trim() && x.min > 0);
      if (!d.cliente.trim()) { toast('Informe o nome do cliente'); return; }
      if (!its.length) { toast('Adicione ao menos um serviço com nome e tempo'); return; }
      t.disabled = true; t.textContent = 'Salvando…';
      const sug = round5(totalMin(its) / 60 * hourly());
      try {
        const b = await api.createBudget(S.uid, { cliente: d.cliente.trim(), tel: d.tel, bairro: d.bairro, cobrado: d.cobrado == null ? sug : d.cobrado, foto: d.foto, itens: its.map((x) => ({ nome: x.nome.trim(), tipo: x.tipo, min: +x.min })) });
        S.budgets.push(b); S.draft = emptyDraft(); go('orcamentos'); showSheet(b.id);
      } catch (err) { t.disabled = false; t.textContent = 'Gerar orçamento'; toast('Não consegui salvar o orçamento. Tente de novo.'); }
      return;
    }
    if (a === 'ver') { showSheet(id); return; }
    if (a === 'zap') {
      const b = S.budgets.filter((x) => x.id === id)[0]; if (!b) return;
      const tel = ($('#sheet-tel').value || '').trim(), dig = tel.replace(/\D/g, '');
      if (dig.length < 10) { toast('Informe o WhatsApp do cliente com DDD'); return; }
      const full = dig.length >= 12 && dig.slice(0, 2) === '55' ? dig : '55' + dig;
      if (tel !== b.tel) { b.tel = tel; bg(api.setTel(b.id, tel)); }
      t.disabled = true; t.textContent = 'Preparando…';
      let link = '';
      try {
        await ensureFoto(b);
        const blob = await gerarPDF({ b, nome: S.nome, logo: S.logo, foto: b.fotoData });
        const path = S.uid + '/pdf/orcamento-' + b.id + '.pdf';
        await api.uploadPdf(path, blob); link = await api.signedUrl(path, 60 * 60 * 24 * 30);
      } catch (err) { toast('Não consegui anexar o link do PDF. Enviando só o resumo.'); }
      const primeiro = b.cliente.trim().split(/\s+/)[0];
      const msg = 'Olá, ' + primeiro + '! Segue o orçamento Nº ' + String(b.n).padStart(4, '0') + (S.nome ? ' - ' + S.nome : '') + ':\n\n' +
        b.itens.map((i) => '• ' + i.nome + ' (' + i.tipo.toLowerCase() + ')').join('\n') +
        '\n\nTotal: ' + brl(b.cobrado) + '\nPrevisão de execução: ' + fh(totalMin(b.itens)) + '\nValidade: 7 dias.' +
        (link ? '\n\nOrçamento completo em PDF (link válido por 30 dias):\n' + link : '');
      t.disabled = false; t.textContent = 'Enviar no WhatsApp';
      window.location.href = 'https://wa.me/' + full + '?text=' + encodeURIComponent(msg);
      return;
    }
    if (a === 'pdf') {
      const b = S.budgets.filter((x) => x.id === id)[0]; if (!b) return;
      t.disabled = true; t.textContent = 'Gerando PDF…';
      try {
        await ensureFoto(b);
        const blob = await gerarPDF({ b, nome: S.nome, logo: S.logo, foto: b.fotoData });
        const nomeArq = 'Orcamento-' + String(b.n).padStart(4, '0') + '-' + b.cliente.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') + '.pdf';
        const r = await compartilharPDF(blob, nomeArq, 'Orçamento ' + b.cliente);
        if (r === 'baixado') toast('PDF baixado');
      } catch (err) { toast('Não consegui gerar o PDF.'); }
      t.disabled = false; t.textContent = 'Compartilhar PDF';
      return;
    }
    if (a === 'aprovar') {
      const bb = S.budgets.filter((x) => x.id === id)[0];
      bb.os = await api.approve(bb, dayStr(1)); bb.status = 'aprovado'; S.osId = bb.id;
      toast('Orçamento aprovado. Ordem de serviço criada.'); go('servico'); return;
    }
    if (a === 'recusar') { const bb = S.budgets.filter((x) => x.id === id)[0]; await api.setStatus(id, 'recusado'); bb.status = 'recusado'; renderOrcamentos(); return; }
    if (a === 'openos') { S.osId = id; go('servico'); return; }
    if (await tabelaMod.click(a, t, ctx)) return;
    if (await caixaMod.click(a, t, ctx)) return;
    if (await agendaMod.click(a, t, ctx)) return;

    const b2 = curB(); if (!b2) return; const os = b2.os;
    if (a === 'checkin') { os.checkin = Date.now(); bg(api.updateOS(os.id, { checkin: os.checkin })); renderServico(); return; }
    if (a === 'start') {
      // um cronômetro por vez: pausa qualquer outro que esteja rodando
      os.itens.forEach((o) => { if (o.running) { o.real += Date.now() - o.since; o.running = false; o.since = null; bg(api.updateItem(o.id, { real: o.real, since: null })); } });
      const it = os.itens[k]; it.running = true; it.since = Date.now();
      bg(api.updateItem(it.id, { since: it.since })); renderServico(); return;
    }
    if (a === 'pause') { const it = os.itens[k]; it.real += Date.now() - it.since; it.running = false; it.since = null; bg(api.updateItem(it.id, { real: it.real, since: null })); renderServico(); return; }
    if (a === 'finish') {
      const it = os.itens[k];
      if (it.running) { it.real += Date.now() - it.since; it.running = false; it.since = null; }
      it.done = true; bg(api.updateItem(it.id, { real: it.real, since: null, done: true })); renderServico(); return;
    }
    if (a === 'encerrar') {
      os.fim = Date.now(); b2.status = 'concluido';
      bg(Promise.all([api.updateOS(os.id, { fim: os.fim }), api.setStatus(b2.id, 'concluido')])); renderServico(); window.scrollTo(0, 0);
      if (!S.lanc.some((l) => l.orcId === b2.id)) {
        api.createLanc({ tipo: 'entrada', cat: 'Serviço', desc: 'Serviço - ' + b2.cliente, valor: b2.cobrado, data: dayStr(0), pago: false, orcId: b2.id })
          .then((l) => { S.lanc.unshift(l); toast('Lançado no Caixa como "a receber"'); }).catch(() => {});
      }
      return;
    }
    if (a === 'garg') {
      const g = t.getAttribute('data-g'), ix = os.gargalos.indexOf(g);
      if (ix > -1) os.gargalos.splice(ix, 1); else os.gargalos.push(g);
      bg(api.updateOS(os.id, { gargalos: os.gargalos })); t.classList.toggle('on'); return;
    }
  } catch (err) { toast('Algo deu errado. Verifique a internet e tente de novo.'); }
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (tabelaMod.input(e, ctx) || caixaMod.input(e, ctx)) return;
  if (t.id === 'nome') { S.nome = t.value; saveAllProfile(); renderTop(); return; }
  if (t.hasAttribute('data-n')) { S[t.getAttribute('data-n')] = parseFloat(String(t.value).replace(',', '.')) || 0; saveAllProfile(); updValor(); return; }
  if (t.hasAttribute('data-d')) { S.draft[t.getAttribute('data-d')] = t.value; return; }
  if (t.id === 'o-cob') { const v = parseFloat(String(t.value).replace(',', '.')); S.draft.cobrado = isNaN(v) ? null : v; updOrc(); return; }
  if (t.hasAttribute('data-f')) { const r = +t.closest('[data-r]').getAttribute('data-r'), f = t.getAttribute('data-f'); S.draft.itens[r][f] = f === 'min' ? (parseInt(t.value, 10) || 0) : t.value; updOrc(); return; }
  if (t.id === 'os-extra') { const b = curB(); if (b) { b.os.extras = t.value; clearTimeout(t._tm); t._tm = setTimeout(() => bg(api.updateOS(b.os.id, { extras: b.os.extras })), 600); } }
});
document.addEventListener('change', async (e) => {
  const t = e.target, b = curB();
  if (caixaMod.change(e, ctx)) return;
  if (await agendaMod.change(e, ctx)) return;
  if (t.id === 'os-data' && b) { b.os.data = t.value; bg(api.updateOS(b.os.id, { data: t.value })); return; }
  if (t.hasAttribute('data-tool') && b) { b.os.tools[t.getAttribute('data-tool')] = t.checked; bg(api.updateOS(b.os.id, { tools: b.os.tools })); return; }
  if (t.tagName === 'SELECT' && t.hasAttribute('data-f')) { const r = +t.closest('[data-r]').getAttribute('data-r'); S.draft.itens[r].tipo = t.value; }
});
$('#logoFile').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  fileToData(f, 800, 'image/png', 1, async (u0) => {
    try {
      const u = await circleLogo(u0);
      const path = S.uid + '/logo.png';
      await api.uploadImage(path, u); await api.saveProfile(S.uid, { logoPath: path });
      S.logo = u; S.logoPath = path; route(); toast('Logo atualizada');
    } catch (err) { toast('Não consegui salvar a logo. Tente de novo.'); }
  });
  e.target.value = '';
});
$('#fotoFile').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  fileToData(f, 1000, 'image/jpeg', 0.82, (u) => { S.draft.foto = u; renderOrcar(); });
  e.target.value = '';
});
setInterval(() => {
  const r = runInfo(); if (r) { const el = $('[data-rb]'); if (el) el.textContent = clock(elapsed(r.i)); }
  const b = curB(); if (!b || b.os.fim) return;
  $$('[data-tick]').forEach((el) => { const i = b.os.itens[+el.getAttribute('data-tick')]; if (i) el.textContent = clock(elapsed(i)); });
}, 1000);

/* ---------- login e inicialização ---------- */
function show(which) {
  $('#boot').hidden = which !== 'boot';
  $('#auth').hidden = which !== 'auth';
  $('#app').hidden = which !== 'app';
  $('#tabsWrap').hidden = which !== 'app';
}
let modoCadastro = false;
function setModo(c) {
  modoCadastro = c;
  $('#authGo').textContent = c ? 'Criar conta' : 'Entrar';
  $('#authSwitch').textContent = c ? 'Já tenho conta' : 'Ainda não tenho conta';
  $('#authPass').autocomplete = c ? 'new-password' : 'current-password';
  $('#authErr').textContent = '';
}
function msgErro(err) {
  const m = String(err && err.message || '');
  if (/invalid login/i.test(m)) return 'E-mail ou senha incorretos.';
  if (/already registered|already been registered/i.test(m)) return 'Este e-mail já tem conta. Toque em "Já tenho conta".';
  if (/password/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/email/i.test(m) && /invalid|valid/i.test(m)) return 'Digite um e-mail válido.';
  if (/not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link que enviamos e tente entrar.';
  if (/rate limit|too many/i.test(m)) return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
  return 'Não foi possível entrar. Verifique a internet e tente de novo.';
}
$('#authSwitch').addEventListener('click', () => setModo(!modoCadastro));
$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#authEmail').value.trim(), senha = $('#authPass').value;
  if (!email || senha.length < 6) { $('#authErr').textContent = 'Informe e-mail e uma senha de pelo menos 6 caracteres.'; return; }
  const btn = $('#authGo'); btn.disabled = true; $('#authErr').textContent = '';
  try {
    if (modoCadastro) {
      const r = await api.criarConta(email, senha);
      if (!r.session) { $('#authErr').textContent = 'Conta criada. Confirme seu e-mail pelo link que enviamos e depois toque em "Já tenho conta".'; setModo(false); $('#authErr').textContent = 'Conta criada. Confirme seu e-mail pelo link que enviamos e depois entre.'; btn.disabled = false; return; }
      await start(r.session.user);
    } else {
      const s = await api.entrar(email, senha); await start(s.user);
    }
  } catch (err) { $('#authErr').textContent = msgErro(err); }
  btn.disabled = false;
});

async function start(user) {
  show('boot');
  try {
    const r = await api.loadAll(user.id);
    S = blank();
    S.uid = user.id; S.email = user.email || '';
    S.nome = r.profile.nome; S.meta = r.profile.meta; S.custos = r.profile.custos; S.dias = r.profile.dias; S.hdia = r.profile.hdia;
    S.logo = r.logo ? await circleLogo(r.logo) : null; S.logoPath = r.profile.logoPath; S.budgets = r.budgets; S.tabela = r.tabela; S.lanc = r.lanc; S.disp = r.disp;
    const ativo = S.budgets.filter((b) => b.status === 'aprovado')[0]; S.osId = ativo ? ativo.id : null;
    show('app'); route();
  } catch (err) {
    $('#boot').innerHTML = '<div class="stack" style="text-align:center">Não consegui carregar seus dados.<button class="btn" id="retry">Tentar de novo</button></div>';
    show('boot'); $('#retry').onclick = () => { $('#boot').textContent = 'Carregando…'; start(user); };
  }
}

supabase.auth.onAuthStateChange((ev) => {
  if (ev === 'SIGNED_OUT') { S = blank(); $('#authPass').value = ''; show('auth'); }
});
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) await start(data.session.user); else show('auth');
})();
