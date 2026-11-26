// Compras e investimentos: o que preciso comprar, quanto de capital isso pede e o que se repete todo mês.
import * as api from './api.js';

const tot = (c) => c.valor * c.qtd;
function normUrl(u) {
  u = String(u || '').trim(); if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.indexOf('.') > 0 ? x.href : null; } catch (e) { return null; }
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
const soma = (l) => l.reduce((s, c) => s + tot(c), 0);

function linha(ctx, c) {
  const esc = ctx.esc, brl = ctx.brl;
  return '<div class="trow"><div class="tn"><b>' + esc(c.nome) + '</b><span class="tprice">' + brl(tot(c)) + '</span></div>' +
    '<div class="tp2"><span class="muted small">' + (c.qtd > 1 ? c.qtd + ' × ' + brl(c.valor) : brl(c.valor)) + (c.recorrente ? ' · todo mês' : '') + (c.link ? ' · <a href="' + esc(c.link) + '" target="_blank" rel="noopener noreferrer">Ver produto (' + esc(host(c.link)) + ')</a>' : '') + '</span>' +
    '<span class="row" style="gap:6px">' +
    (c.recorrente ? '' : '<button class="chip" data-a="c-ok" data-id="' + c.id + '">' + (c.comprado ? 'Desfazer' : 'Já comprei') + '</button>') +
    '<button class="chip" data-a="c-edit" data-id="' + c.id + '">Editar</button>' +
    '<button class="chip" data-a="c-del" data-id="' + c.id + '">Apagar</button></span></div></div>';
}

function form(ctx, c) {
  const esc = ctx.esc;
  return '<div class="card stack" data-cf-box="' + c.id + '"><span class="lbl" style="margin:0">' + (c.id === 'new' ? 'Novo item' : 'Editar item') + '</span>' +
    '<label class="field"><span class="lbl">O que preciso</span><input class="in" data-cf="nome" value="' + esc(c.nome) + '" placeholder="Ex.: Parafusadeira, anúncios, bits"></label>' +
    '<div class="grid2"><label class="field"><span class="lbl">Valor (R$)</span><input class="in" inputmode="decimal" data-cf="valor" value="' + (c.valor === '' ? '' : c.valor) + '" placeholder="0,00"></label>' +
    '<label class="field"><span class="lbl">Quantidade</span><input class="in" inputmode="numeric" data-cf="qtd" value="' + c.qtd + '"></label></div>' +
    '<label class="field"><span class="lbl">Link do produto (opcional)</span><input class="in" inputmode="url" data-cf="link" value="' + esc(c.link || '') + '" placeholder="Cole aqui o link da loja"></label>' +
    '<label class="field"><span class="lbl">Frequência</span><select class="in" data-cf="rec"><option value="0"' + (c.recorrente ? '' : ' selected') + '>Compra única</option><option value="1"' + (c.recorrente ? ' selected' : '') + '>Gasto recorrente (todo mês)</option></select></label>' +
    '<div class="row"><button class="btn sm" data-a="c-save" data-id="' + c.id + '">' + (c.id === 'new' ? 'Adicionar' : 'Salvar') + '</button>' +
    (c.id !== 'new' ? '<button class="btn ghost sm" data-a="c-cancel">Cancelar</button>' : '') + '</div></div>';
}

export function render(ctx) {
  const S = ctx.S, brl = ctx.brl;
  const unicas = S.compras.filter((c) => !c.recorrente && !c.comprado), rec = S.compras.filter((c) => c.recorrente), feitas = S.compras.filter((c) => !c.recorrente && c.comprado);
  const edit = S.cEdit && S.cEdit !== 'new' ? S.compras.filter((c) => c.id === S.cEdit)[0] : null;
  const grupo = (titulo, list) => list.length ? '<h2>' + titulo + '</h2><div class="card" style="padding-top:4px;padding-bottom:4px">' + list.map((c) => (edit && edit.id === c.id) ? form(ctx, c) : linha(ctx, c)).join('') + '</div>' : '';
  ctx.$('#v-compras').innerHTML =
    '<h1>Compras e investimentos</h1><p class="sub">Ferramentas, insumos e gastos do negócio. Veja de quanto capital você precisa.</p>' +
    '<div class="card stack glow-ok"><span class="lbl" style="margin:0">Capital necessário no próximo mês</span><b class="num" style="font-size:30px">' + brl(soma(unicas) + soma(rec)) + '</b>' +
    '<div class="row" style="justify-content:space-between"><span class="muted small">Compras únicas pendentes</span><b class="num">' + brl(soma(unicas)) + '</b></div>' +
    '<div class="row" style="justify-content:space-between"><span class="muted small">Recorrente por mês</span><b class="num">' + brl(soma(rec)) + '</b></div>' +
    (feitas.length ? '<div class="row" style="justify-content:space-between"><span class="muted small">Já comprado</span><b class="num">' + brl(soma(feitas)) + '</b></div>' : '') + '</div>' +
    '<div style="margin-top:14px">' + (S.cEdit === 'new' || !S.cEdit ? form(ctx, { id: 'new', nome: '', valor: '', qtd: 1, recorrente: false, link: '' }) : (edit ? '' : '')) + '</div>' +
    grupo('A comprar', unicas) + grupo('Recorrentes (todo mês)', rec) + grupo('Já comprados', feitas) +
    (S.compras.length ? '' : '<div class="card muted" style="margin-top:12px">Nada cadastrado ainda. Preencha acima o primeiro item que você precisa comprar.</div>');
}

export async function click(a, t, ctx) {
  if (a.slice(0, 2) !== 'c-') return false;
  const S = ctx.S, id = t.getAttribute('data-id');
  if (a === 'c-edit') { S.cEdit = id; render(ctx); return true; }
  if (a === 'c-cancel') { S.cEdit = null; render(ctx); return true; }
  if (a === 'c-ok') {
    const c = S.compras.filter((x) => x.id === id)[0]; if (!c) return true;
    c.comprado = !c.comprado; render(ctx);
    try { await api.setCompraComprado(id, c.comprado); } catch (e) { c.comprado = !c.comprado; render(ctx); ctx.toast('Não consegui salvar. Tente de novo.'); }
    return true;
  }
  if (a === 'c-save') {
    const box = ctx.$('[data-cf-box="' + id + '"]'); if (!box) return true;
    const g = (k) => box.querySelector('[data-cf="' + k + '"]').value;
    const nome = g('nome').trim(), valor = ctx.num(g('valor')), qtd = parseInt(g('qtd'), 10) || 1;
    if (!nome) { ctx.toast('Informe o que você precisa comprar'); return true; }
    if (!(valor >= 0) || g('valor').trim() === '') { ctx.toast('Informe o valor'); return true; }
    const link = normUrl(g('link'));
    if (link === null) { ctx.toast('O link parece inválido. Cole o endereço completo da loja.'); return true; }
    t.disabled = true;
    try {
      const saved = await api.saveCompra({ id: id === 'new' ? null : id, nome, valor, qtd: Math.min(qtd, 9999), recorrente: g('rec') === '1', link });
      const old = S.compras.filter((x) => x.id === id)[0];
      if (old) { saved.comprado = old.comprado; S.compras[S.compras.indexOf(old)] = saved; } else S.compras.push(saved);
      S.cEdit = null; render(ctx); ctx.toast(id === 'new' ? 'Item adicionado' : 'Item atualizado');
    } catch (e) { t.disabled = false; ctx.toast('Não consegui salvar. Tente de novo.'); }
    return true;
  }
  if (a === 'c-del') {
    if (t.dataset.arm !== '1') { t.dataset.arm = '1'; t.textContent = 'Confirmar'; setTimeout(() => { t.dataset.arm = ''; t.textContent = 'Apagar'; }, 3000); return true; }
    try { await api.deleteCompra(id); S.compras = S.compras.filter((x) => x.id !== id); render(ctx); ctx.toast('Item apagado'); } catch (e) { ctx.toast('Não consegui apagar. Tente de novo.'); }
    return true;
  }
  return false;
}
