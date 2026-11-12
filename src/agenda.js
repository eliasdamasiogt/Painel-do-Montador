// Agenda: calendário do mês com serviços agendados e dias de disponibilidade.
import * as api from './api.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DOW = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const pad = (n) => String(n).padStart(2, '0');
const dstr = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);

function init(ctx) {
  const S = ctx.S;
  if (!S.cal) { const d = new Date(); S.cal = { y: d.getFullYear(), m: d.getMonth(), sel: ctx.dayStr(0), brush: null }; }
}

function servicosPorDia(S) {
  const por = {};
  S.budgets.forEach((b) => { if (b.os && b.os.data && b.status !== 'recusado') (por[b.os.data] = por[b.os.data] || []).push(b); });
  return por;
}

export function render(ctx) {
  init(ctx);
  const S = ctx.S, esc = ctx.esc, c = S.cal, today = ctx.dayStr(0);
  const por = servicosPorDia(S);
  const first = new Date(c.y, c.m, 1).getDay(), total = new Date(c.y, c.m + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<span></span>';
  let nSvc = 0, nLivre = 0;
  for (let d = 1; d <= total; d++) {
    const ds = dstr(c.y, c.m, d), disp = S.disp[ds], svc = (por[ds] || []).length;
    if (svc) nSvc += svc; if (disp && disp.status === 'disponivel') nLivre++;
    const cls = 'cal-day' + (ds === today ? ' today' : '') + (ds === c.sel ? ' sel' : '') + (disp ? (disp.status === 'disponivel' ? ' ok' : ' no') : '');
    cells += '<button class="' + cls + '" data-a="cal-day" data-d="' + ds + '" aria-label="Dia ' + d + '"><span class="dn">' + d + '</span>' + (svc ? '<i class="dotsvc">' + svc + '</i>' : '<i class="dotsvc off"></i>') + '</button>';
  }
  const brush = (k, label) => '<button class="chip' + (c.brush === k ? ' on' : '') + '" data-a="cal-brush" data-b="' + k + '">' + label + '</button>';

  // painel do dia selecionado
  const sd = new Date(c.sel + 'T12:00:00'), svcs = por[c.sel] || [], disp = S.disp[c.sel];
  const prev = svcs.reduce((s, b) => s + b.itens.reduce((x, i) => x + (+i.min || 0), 0), 0), cap = S.hdia * 60;
  const pct = cap > 0 ? Math.min(100, prev / cap * 100) : 0;
  const painel =
    '<h2>' + DIAS[sd.getDay()] + ', ' + sd.getDate() + ' de ' + MESES[sd.getMonth()].toLowerCase() + '</h2>' +
    '<div class="card stack">' +
    '<div class="row"><button class="btn sm ok' + (disp && disp.status === 'disponivel' ? '' : ' dim') + '" data-a="cal-set" data-s="disponivel">Disponível</button><button class="btn sm no' + (disp && disp.status === 'indisponivel' ? '' : ' dim') + '" data-a="cal-set" data-s="indisponivel">Indisponível</button>' + (disp ? '<button class="btn ghost sm" data-a="cal-set" data-s="limpar">Limpar</button>' : '') + '</div>' +
    (disp ? '<label class="field"><span class="lbl">Observação do dia</span><input class="in" id="dnota" value="' + esc(disp.nota) + '" placeholder="Ex.: só de manhã"></label>' : '') +
    (svcs.length ? '<div><div class="row" style="justify-content:space-between"><span class="muted small">Agendado: ' + ctx.fh(prev) + ' de ' + ctx.fh(cap) + ' por dia</span></div><div class="bar" style="margin-top:6px"><i style="width:' + pct + '%;' + (prev > cap ? 'background:var(--bad)' : '') + '"></i></div>' + (prev > cap ? '<p class="small" style="color:var(--bad);margin:6px 0 0">Passou da sua jornada deste dia.</p>' : '') + '</div>' : '<p class="muted small" style="margin:0">Nenhum serviço neste dia.</p>') +
    '</div>' +
    svcs.map((b) => '<div class="card stack ' + (b.status === 'concluido' ? 'glow-ok' : '') + '" style="margin-top:10px"><div class="row" style="justify-content:space-between;flex-wrap:nowrap"><div style="min-width:0"><b>' + esc(b.cliente) + '</b><div class="muted small">' + esc(b.bairro || 'sem bairro') + ' · ' + b.itens.length + ' serviços · ' + ctx.fh(b.itens.reduce((x, i) => x + (+i.min || 0), 0)) + '</div></div><b class="num">' + ctx.brl(b.cobrado) + '</b></div>' +
      '<div class="row"><button class="btn sm" data-a="openos" data-id="' + b.id + '">Abrir OS</button><label class="field" style="flex:1;min-width:150px"><span class="lbl">Mudar a data</span><input class="in" type="date" data-sd="' + b.id + '" value="' + esc(b.os.data) + '"></label></div></div>').join('');

  ctx.$('#v-agenda').innerHTML =
    '<h1>Agenda</h1><p class="sub">Marque os dias em que pode atender e veja os serviços do mês.</p>' +
    '<div class="cal-head"><button class="navbtn" data-a="cal-prev" aria-label="Mês anterior">‹</button><b class="num" style="font-size:16px">' + MESES[c.m] + ' ' + c.y + '</b><button class="navbtn" data-a="cal-next" aria-label="Próximo mês">›</button></div>' +
    '<p class="small muted" style="margin:8px 0 10px">' + nSvc + ' serviço(s) agendado(s) · ' + nLivre + ' dia(s) marcado(s) como disponível</p>' +
    '<div class="cal-grid">' + DOW.map((d) => '<span class="cal-dow">' + d + '</span>').join('') + cells + '</div>' +
    '<div class="row cal-legend"><span><i class="lg ok"></i>Disponível</span><span><i class="lg no"></i>Indisponível</span><span><i class="dotsvc">1</i>Serviço</span></div>' +
    '<h2>Marcar vários dias</h2><div class="row">' + brush('disponivel', 'Disponível') + brush('indisponivel', 'Indisponível') + brush('limpar', 'Limpar') + '</div>' +
    '<p class="small muted" style="margin:8px 2px 0">' + (c.brush ? 'Pincel ligado: toque nos dias para aplicar. Toque de novo no pincel para desligar.' : 'Escolha um pincel e toque nos dias do calendário.') + '</p>' +
    painel;
}

async function setDay(ctx, ds, status) {
  const S = ctx.S;
  if (status === 'limpar') { await api.clearDisp(S.uid, ds); delete S.disp[ds]; return; }
  const nota = S.disp[ds] ? S.disp[ds].nota : '';
  await api.setDisp(S.uid, ds, status, nota); S.disp[ds] = { status, nota };
}

export async function click(a, t, ctx) {
  init(ctx);
  const S = ctx.S, c = S.cal;
  if (a === 'cal-prev') { c.m--; if (c.m < 0) { c.m = 11; c.y--; } render(ctx); return true; }
  if (a === 'cal-next') { c.m++; if (c.m > 11) { c.m = 0; c.y++; } render(ctx); return true; }
  if (a === 'cal-brush') { const b = t.getAttribute('data-b'); c.brush = c.brush === b ? null : b; render(ctx); return true; }
  if (a === 'cal-day') {
    const ds = t.getAttribute('data-d');
    c.sel = ds;
    if (c.brush) { try { await setDay(ctx, ds, c.brush); } catch (e) { ctx.toast('Não consegui salvar. Tente de novo.'); } }
    render(ctx); return true;
  }
  if (a === 'cal-set') { try { await setDay(ctx, c.sel, t.getAttribute('data-s')); } catch (e) { ctx.toast('Não consegui salvar. Tente de novo.'); } render(ctx); return true; }
  return false;
}

export async function change(e, ctx) {
  const t = e.target, S = ctx.S;
  if (t.id === 'dnota') {
    const ds = S.cal.sel, d = S.disp[ds]; if (!d) return true;
    try { await api.setDisp(S.uid, ds, d.status, t.value); d.nota = t.value; ctx.toast('Observação salva'); } catch (er) { ctx.toast('Não consegui salvar. Tente de novo.'); }
    return true;
  }
  if (t.hasAttribute('data-sd')) {
    const b = S.budgets.filter((x) => x.id === t.getAttribute('data-sd'))[0]; if (!b || !b.os || !t.value) return true;
    try {
      await api.updateOS(b.os.id, { data: t.value }); b.os.data = t.value; S.cal.sel = t.value;
      const d = new Date(t.value + 'T12:00:00'); S.cal.y = d.getFullYear(); S.cal.m = d.getMonth();
      const dp = S.disp[t.value];
      render(ctx); ctx.toast(dp && dp.status === 'indisponivel' ? 'Data alterada. Atenção: você marcou esse dia como indisponível.' : 'Data alterada');
    } catch (er) { ctx.toast('Não consegui mudar a data. Tente de novo.'); }
    return true;
  }
  return false;
}
