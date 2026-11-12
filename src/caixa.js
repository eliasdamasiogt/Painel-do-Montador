// Fluxo de caixa: entradas e saídas do negócio, por mês.
import * as api from './api.js';

const SAIDA = ['Ferramentas e materiais', 'Transporte', 'Despesa fixa', 'Reinvestimento', 'Alimentação', 'Outros'];
const ENTRADA = ['Serviço', 'Outros'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ym = (y, m) => y + '-' + String(m + 1).padStart(2, '0');
const sum = (arr) => arr.reduce((s, l) => s + l.valor, 0);

function init(ctx) {
  const S = ctx.S;
  if (!S.cx) { const d = new Date(); S.cx = { y: d.getFullYear(), m: d.getMonth() }; }
  if (!S.cxForm) S.cxForm = { tipo: 'saida', cat: SAIDA[0], valor: '', desc: '', data: '', pago: true };
  if (!S.cxForm.data) S.cxForm.data = ctx.dayStr(0);
}

export function render(ctx) {
  init(ctx);
  const S = ctx.S, esc = ctx.esc, brl = ctx.brl, f = S.cxForm, key = ym(S.cx.y, S.cx.m);
  const mes = S.lanc.filter((l) => l.data.slice(0, 7) === key);
  const entrou = sum(mes.filter((l) => l.tipo === 'entrada' && l.pago)), saiu = sum(mes.filter((l) => l.tipo === 'saida' && l.pago));
  const aReceber = sum(mes.filter((l) => l.tipo === 'entrada' && !l.pago)), aPagar = sum(mes.filter((l) => l.tipo === 'saida' && !l.pago));
  const saldo = entrou - saiu;
  const saidas = mes.filter((l) => l.tipo === 'saida'), totSaidas = sum(saidas);
  const porCat = {}; saidas.forEach((l) => { porCat[l.cat] = (porCat[l.cat] || 0) + l.valor; });
  const cats = Object.keys(porCat).sort((a, b) => porCat[b] - porCat[a]);
  const temFixa = mes.some((l) => l.cat === 'Despesa fixa');
  const pm = S.cx.m === 0 ? { y: S.cx.y - 1, m: 11 } : { y: S.cx.y, m: S.cx.m - 1 };
  const fixasAnt = S.lanc.filter((l) => l.tipo === 'saida' && l.cat === 'Despesa fixa' && l.data.slice(0, 7) === ym(pm.y, pm.m));
  const catsForm = f.tipo === 'saida' ? SAIDA : ENTRADA;

  const rows = mes.slice().sort((a, b) => b.data.localeCompare(a.data)).map((l) => {
    const ent = l.tipo === 'entrada';
    const st = l.pago ? (ent ? 'Recebido' : 'Pago') : (ent ? 'A receber' : 'A pagar');
    return '<div class="lrow"><div style="min-width:0"><b>' + esc(l.desc || l.cat) + '</b><div class="muted small">' + esc(l.cat) + ' · ' + ctx.fmtDate(l.data) + '</div></div>' +
      '<div class="lval"><span class="num" style="color:' + (ent ? 'var(--ok)' : 'var(--bad)') + '">' + (ent ? '+' : '−') + brl(l.valor) + '</span>' +
      '<div class="row" style="gap:6px;flex-wrap:nowrap;justify-content:flex-end"><button class="pill ' + (l.pago ? 'done' : 'send') + '" data-a="cx-toggle" data-id="' + l.id + '" aria-label="Alternar situação">' + st + '</button>' +
      '<button class="xbtn" data-a="cx-del" data-id="' + l.id + '" aria-label="Apagar lançamento">✕</button></div></div></div>';
  }).join('');

  ctx.$('#v-caixa').innerHTML =
    '<h1>Fluxo de caixa</h1><p class="sub">O que entrou, o que saiu e em que você gastou.</p>' +
    '<div class="cal-head"><button class="navbtn" data-a="cx-prev" aria-label="Mês anterior">‹</button><b class="num" style="font-size:16px">' + MESES[S.cx.m] + ' ' + S.cx.y + '</b><button class="navbtn" data-a="cx-next" aria-label="Próximo mês">›</button></div>' +
    '<div class="stats" style="margin-top:14px"><div><span class="num" style="color:var(--ok)">' + brl(entrou) + '</span><span class="t">entrou</span></div><div><span class="num" style="color:var(--bad)">' + brl(saiu) + '</span><span class="t">saiu</span></div><div><span class="num">' + brl(saldo) + '</span><span class="t">saldo do mês</span></div></div>' +
    '<div class="row" style="margin-top:10px;gap:8px"><span class="pill send">A receber ' + brl(aReceber) + '</span><span class="pill no">A pagar ' + brl(aPagar) + '</span></div>' +

    '<h2>Novo lançamento</h2><div class="card stack">' +
    '<div class="seg"><button class="' + (f.tipo === 'saida' ? 'on' : '') + '" data-a="cx-tipo" data-t="saida">Saída</button><button class="' + (f.tipo === 'entrada' ? 'on' : '') + '" data-a="cx-tipo" data-t="entrada">Entrada</button></div>' +
    '<div class="grid2"><label class="field"><span class="lbl">Valor (R$)</span><input class="in" inputmode="decimal" data-cf="valor" value="' + esc(f.valor) + '" placeholder="0,00"></label>' +
    '<label class="field"><span class="lbl">Data</span><input class="in" type="date" data-cf="data" value="' + esc(f.data) + '"></label></div>' +
    '<label class="field"><span class="lbl">' + (f.tipo === 'saida' ? 'Com o que gastou' : 'De quem ou de quê') + '</span><input class="in" data-cf="desc" value="' + esc(f.desc) + '" placeholder="' + (f.tipo === 'saida' ? 'Ex.: broca, gasolina, anúncio' : 'Ex.: Marluci, guarda-roupa') + '"></label>' +
    '<div><span class="lbl">Categoria</span><div class="row">' + catsForm.map((c) => '<button class="chip' + (f.cat === c ? ' on' : '') + '" data-a="cx-cat" data-c="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div></div>' +
    '<label class="chk"><input type="checkbox" data-cf="pago"' + (f.pago ? ' checked' : '') + '> <span>' + (f.tipo === 'saida' ? 'Já paguei' : 'Já recebi') + '</span></label>' +
    '<button class="btn block" data-a="cx-add">Lançar</button></div>' +

    '<h2>Para onde foi o dinheiro</h2>' +
    (cats.length ? '<div class="card">' + cats.map((c) => '<div style="margin-bottom:12px"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span>' + esc(c) + '</span><span class="muted small">' + brl(porCat[c]) + ' · ' + Math.round(porCat[c] / totSaidas * 100) + '%</span></div><div class="bar"><i style="width:' + (porCat[c] / totSaidas * 100) + '%"></i></div></div>').join('') + '</div>'
      : '<div class="card muted">Nenhuma saída neste mês.</div>') +

    '<h2>Lançamentos do mês</h2>' +
    (!temFixa && fixasAnt.length ? '<div class="note" style="margin-bottom:10px">Você tinha ' + fixasAnt.length + ' despesa(s) fixa(s) em ' + MESES[pm.m] + '. <button class="btn ghost sm" style="margin-top:8px;display:block" data-a="cx-copy">Copiar para este mês</button></div>' : '') +
    (rows ? '<div class="card" style="padding-top:4px;padding-bottom:4px">' + rows + '</div>' : '<div class="card muted">Nenhum lançamento neste mês.</div>');
}

function field(t, ctx) {
  const k = t.getAttribute('data-cf'); if (!k) return false;
  init(ctx);
  ctx.S.cxForm[k] = t.type === 'checkbox' ? t.checked : t.value;
  return true;
}
export function input(e, ctx) { return field(e.target, ctx); }
export function change(e, ctx) { return field(e.target, ctx); }

export async function click(a, t, ctx) {
  const S = ctx.S; init(ctx);
  const id = t.getAttribute('data-id');
  if (a === 'cx-prev') { S.cx.m--; if (S.cx.m < 0) { S.cx.m = 11; S.cx.y--; } render(ctx); return true; }
  if (a === 'cx-next') { S.cx.m++; if (S.cx.m > 11) { S.cx.m = 0; S.cx.y++; } render(ctx); return true; }
  if (a === 'cx-tipo') { const tp = t.getAttribute('data-t'); S.cxForm.tipo = tp; S.cxForm.cat = tp === 'saida' ? SAIDA[0] : ENTRADA[0]; S.cxForm.pago = true; render(ctx); return true; }
  if (a === 'cx-cat') { S.cxForm.cat = t.getAttribute('data-c'); render(ctx); return true; }
  if (a === 'cx-add') {
    const f = S.cxForm, v = ctx.num(f.valor);
    if (!(v > 0)) { ctx.toast('Informe o valor'); return true; }
    if (!f.data) { ctx.toast('Informe a data'); return true; }
    t.disabled = true;
    try {
      const l = await api.createLanc({ tipo: f.tipo, cat: f.cat, desc: f.desc.trim(), valor: v, data: f.data, pago: f.pago });
      S.lanc.unshift(l);
      const d = new Date(l.data + 'T12:00:00'); S.cx = { y: d.getFullYear(), m: d.getMonth() };
      S.cxForm.valor = ''; S.cxForm.desc = '';
      render(ctx); ctx.toast('Lançamento salvo');
    } catch (err) { t.disabled = false; ctx.toast('Não consegui salvar. Tente de novo.'); }
    return true;
  }
  if (a === 'cx-toggle') {
    const l = S.lanc.filter((x) => x.id === id)[0]; if (!l) return true;
    await api.setLancPago(id, !l.pago); l.pago = !l.pago; render(ctx); return true;
  }
  if (a === 'cx-del') {
    if (t.dataset.arm !== '1') { t.dataset.arm = '1'; t.textContent = 'Apagar?'; t.classList.add('arm'); setTimeout(() => { t.dataset.arm = ''; t.textContent = '✕'; t.classList.remove('arm'); }, 3000); return true; }
    await api.deleteLanc(id); S.lanc = S.lanc.filter((x) => x.id !== id); render(ctx); ctx.toast('Lançamento apagado'); return true;
  }
  if (a === 'cx-copy') {
    const pm = S.cx.m === 0 ? { y: S.cx.y - 1, m: 11 } : { y: S.cx.y, m: S.cx.m - 1 };
    const src = S.lanc.filter((l) => l.tipo === 'saida' && l.cat === 'Despesa fixa' && l.data.slice(0, 7) === ym(pm.y, pm.m));
    const dia = (d) => String(Math.min(parseInt(d.slice(8), 10), 28)).padStart(2, '0');
    const novos = await api.createLancMany(src.map((l) => ({ tipo: 'saida', cat: 'Despesa fixa', desc: l.desc, valor: l.valor, data: ym(S.cx.y, S.cx.m) + '-' + dia(l.data), pago: false })));
    S.lanc = novos.concat(S.lanc); render(ctx); ctx.toast('Despesas fixas copiadas como "a pagar"'); return true;
  }
  return false;
}
