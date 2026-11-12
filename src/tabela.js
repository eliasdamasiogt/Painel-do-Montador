// Tabela de referência: preços médios de mercado, só para comparar com o seu preço.
import * as api from './api.js';

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function fmtRef(r, brl) {
  if (r.max == null) return brl(r.min) + (r.un ? ' ' + r.un : '');
  return brl(r.min) + ' a ' + brl(r.max);
}

function guessTipo(nome) {
  if (/^instal/i.test(nome)) return 'Instalação';
  if (/^desmontagem/i.test(nome)) return 'Desmontagem e montagem';
  return 'Montagem';
}

/* ---------- busca na hora de orçar ---------- */
export function picker() {
  return '<label class="field"><span class="lbl">Buscar na tabela de referência</span><input class="in" id="refq" placeholder="Ex.: guarda-roupa, painel, TV" autocomplete="off"></label>' +
    '<div id="refres" class="reflist"></div>' +
    '<div class="row" style="margin-top:8px"><button class="chip" data-a="addrow">+ Outro móvel (manual)</button></div>';
}

export function fillResults(ctx) {
  const el = ctx.$('#refres'); if (!el) return;
  const S = ctx.S, q = norm(ctx.$('#refq') ? ctx.$('#refq').value : '').trim();
  const toks = q.split(/\s+/).filter(Boolean);
  let list = S.tabela.filter((r) => toks.every((t) => norm(r.nome).indexOf(t) > -1));
  if (!toks.length) list = list.slice(0, 6);
  list = list.slice(0, 8);
  el.innerHTML = list.length ? list.map((r) =>
    '<button class="refrow" data-a="refadd" data-id="' + r.id + '"><span class="rn">' + ctx.esc(r.nome) + (r.grupo === 'usado' ? ' <span class="pill">usado</span>' : '') + '</span><span class="rp">' + fmtRef(r, ctx.brl) + '</span></button>').join('')
    : '<p class="muted small" style="margin:6px 2px">Nada encontrado. Toque em "Outro móvel" para adicionar manualmente.</p>';
}

/* ---------- tela da tabela ---------- */
export function render(ctx) {
  const S = ctx.S, esc = ctx.esc;
  const q = norm(S.refQ || '').trim(), toks = q.split(/\s+/).filter(Boolean);
  const grupo = (g, titulo) => {
    const rows = S.tabela.filter((r) => r.grupo === g && toks.every((t) => norm(r.nome).indexOf(t) > -1));
    if (!rows.length) return '';
    return '<h2>' + titulo + '</h2><div class="card" style="padding-top:4px;padding-bottom:4px">' + rows.map((r) => {
      if (S.refEdit === r.id) return editor(ctx, r);
      return '<div class="trow"><div style="min-width:0"><b>' + esc(r.nome) + '</b><div class="muted small">tempo sugerido ' + ctx.fh(r.mins) + '</div></div>' +
        '<div class="row" style="flex-wrap:nowrap;gap:8px"><span class="num" style="color:var(--champ-hi);white-space:nowrap">' + fmtRef(r, ctx.brl) + '</span><button class="btn ghost sm" data-a="ref-edit" data-id="' + r.id + '" aria-label="Editar">Editar</button></div></div>';
    }).join('') + '</div>';
  };
  ctx.$('#v-tabela').innerHTML =
    '<h1>Tabela de referência</h1><p class="sub">Valores médios cobrados no mercado, só para comparar. O preço que você cobra sai do seu valor-hora.</p>' +
    '<label class="field"><span class="lbl">Buscar</span><input class="in" id="tq" value="' + esc(S.refQ || '') + '" placeholder="Ex.: painel"></label>' +
    '<div class="row" style="margin-top:10px"><button class="btn sm" data-a="ref-new">+ Adicionar item</button></div>' +
    (S.refEdit === 'new' ? '<h2>Novo item</h2><div class="card">' + editor(ctx, { id: 'new', grupo: 'novo', nome: '', min: '', max: '', un: '', mins: 60 }) + '</div>' : '') +
    grupo('novo', 'Móveis novos na caixa') + grupo('usado', 'Móveis usados') +
    '<div class="note" style="margin-top:16px">Os tempos sugeridos são estimativas iniciais. Depois de cronometrar serviços, o app passa a sugerir a sua média real.</div>';
}

function editor(ctx, r) {
  const esc = ctx.esc;
  return '<div class="stack" data-ed="' + r.id + '" style="padding:12px 0"><label class="field"><span class="lbl">Nome</span><input class="in" data-rf="nome" value="' + esc(r.nome) + '"></label>' +
    '<div class="grid2"><label class="field"><span class="lbl">Preço mínimo (R$)</span><input class="in" inputmode="decimal" data-rf="min" value="' + (r.min === '' ? '' : r.min) + '"></label>' +
    '<label class="field"><span class="lbl">Preço máximo (R$)</span><input class="in" inputmode="decimal" data-rf="max" value="' + (r.max == null ? '' : r.max) + '" placeholder="vazio = preço único"></label></div>' +
    '<div class="grid2"><label class="field"><span class="lbl">Tempo sugerido (min)</span><input class="in" inputmode="numeric" data-rf="mins" value="' + r.mins + '"></label>' +
    '<label class="field"><span class="lbl">Grupo</span><select class="in" data-rf="grupo"><option value="novo"' + (r.grupo === 'novo' ? ' selected' : '') + '>Novo</option><option value="usado"' + (r.grupo === 'usado' ? ' selected' : '') + '>Usado</option></select></label></div>' +
    '<div class="row"><button class="btn sm" data-a="ref-save" data-id="' + r.id + '">Salvar</button><button class="btn ghost sm" data-a="ref-cancel">Cancelar</button>' +
    (r.id !== 'new' ? '<button class="btn ghost sm" data-a="ref-del" data-id="' + r.id + '">Apagar</button>' : '') + '</div></div>';
}

/* ---------- eventos ---------- */
export async function click(a, t, ctx) {
  const S = ctx.S, id = t.getAttribute('data-id');
  if (a === 'refadd') {
    const r = S.tabela.filter((x) => x.id === id)[0]; if (!r) return true;
    const m = ctx.avgReal(r.nome) || r.mins;
    S.draft.itens.push({ nome: r.nome, tipo: guessTipo(r.nome), min: m, refMin: r.min, refMax: r.max });
    const q = ctx.$('#refq'); if (q) q.value = '';
    ctx.refreshOrcar(); return true;
  }
  if (a === 'ref-edit') { S.refEdit = id; render(ctx); return true; }
  if (a === 'ref-new') { S.refEdit = 'new'; render(ctx); return true; }
  if (a === 'ref-cancel') { S.refEdit = null; render(ctx); return true; }
  if (a === 'ref-save') {
    const box = ctx.$('[data-ed="' + id + '"]'); if (!box) return true;
    const get = (k) => box.querySelector('[data-rf="' + k + '"]').value;
    const nome = get('nome').trim(), min = ctx.num(get('min')), maxRaw = get('max').trim(), max = maxRaw === '' ? null : ctx.num(maxRaw);
    const mins = parseInt(get('mins'), 10) || 60;
    if (!nome) { ctx.toast('Informe o nome do item'); return true; }
    if (!(min >= 0) || get('min').trim() === '') { ctx.toast('Informe o preço mínimo'); return true; }
    if (max != null && max < min) { ctx.toast('O máximo não pode ser menor que o mínimo'); return true; }
    const old = S.tabela.filter((x) => x.id === id)[0];
    const saved = await api.saveRef({ id: id === 'new' ? null : id, grupo: get('grupo'), nome, min, max, un: old ? old.un : '', mins, ordem: old ? old.ordem : S.tabela.length + 1 });
    if (id === 'new') S.tabela.push(saved); else S.tabela[S.tabela.indexOf(old)] = saved;
    S.refEdit = null; render(ctx); ctx.toast('Tabela atualizada'); return true;
  }
  if (a === 'ref-del') {
    if (t.dataset.arm !== '1') { t.dataset.arm = '1'; t.textContent = 'Confirmar'; setTimeout(() => { t.dataset.arm = ''; t.textContent = 'Apagar'; }, 3000); return true; }
    await api.deleteRef(id); S.tabela = S.tabela.filter((x) => x.id !== id); S.refEdit = null; render(ctx); ctx.toast('Item apagado'); return true;
  }
  return false;
}

export function input(e, ctx) {
  const t = e.target;
  if (t.id === 'refq') { fillResults(ctx); return true; }
  if (t.id === 'tq') {
    ctx.S.refQ = t.value;
    const pos = t.selectionStart; render(ctx);
    const n = ctx.$('#tq'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) { /* ok */ } }
    return true;
  }
  return false;
}
