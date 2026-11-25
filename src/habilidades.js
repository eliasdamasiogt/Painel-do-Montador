// Habilidades para desenvolver: pontos fracos, com links de videoaulas e conteúdos para estudar.
import * as api from './api.js';

function normUrl(u) {
  u = String(u || '').trim(); if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) && x.hostname.indexOf('.') > 0 ? x.href : null; } catch (e) { return null; }
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };

function card(ctx, h) {
  const esc = ctx.esc, vistos = h.links.filter((l) => l.visto).length;
  if (ctx.S.hEdit === h.id) return editor(ctx, h);
  return '<div class="card stack' + (h.dominada ? ' glow-ok' : '') + '"><div class="tn" style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><b style="font-size:16px">' + esc(h.nome) + '</b>' +
    '<span class="pill ' + (h.dominada ? 'done' : 'send') + '">' + (h.dominada ? 'Dominada' : 'Estudando') + '</span></div>' +
    (h.descricao ? '<p class="small muted" style="margin:0;white-space:pre-wrap">' + esc(h.descricao) + '</p>' : '') +
    (h.links.length ? '<span class="muted small">' + vistos + ' de ' + h.links.length + ' conteúdos vistos</span>' : '') +
    h.links.map((l) => '<div class="row" style="flex-wrap:nowrap;gap:10px;align-items:center;border-top:1px solid var(--line);padding-top:8px">' +
      '<button class="chip' + (l.visto ? ' on' : '') + '" style="flex:none" data-a="h-visto" data-id="' + h.id + '" data-l="' + l.id + '" aria-label="Marcar como visto">' + (l.visto ? '✓' : '○') + '</button>' +
      '<a href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer" style="min-width:0;flex:1;overflow-wrap:anywhere' + (l.visto ? ';opacity:.6' : '') + '">' + esc(l.titulo || host(l.url)) + '<span class="muted small" style="display:block">' + esc(host(l.url)) + '</span></a>' +
      '<button class="chip" style="flex:none" data-a="h-ldel" data-id="' + h.id + '" data-l="' + l.id + '" aria-label="Remover link">✕</button></div>').join('') +
    '<div class="stack" data-hb="' + h.id + '" style="gap:8px;border-top:1px solid var(--line);padding-top:10px"><label class="field"><span class="lbl">Adicionar link (videoaula, artigo…)</span><input class="in" data-hl="url" placeholder="Cole o link aqui"></label>' +
    '<input class="in" data-hl="titulo" placeholder="Nome do conteúdo (opcional)"><div class="row"><button class="btn sm" data-a="h-ladd" data-id="' + h.id + '">+ Adicionar link</button></div></div>' +
    '<div class="row"><button class="btn ghost sm" data-a="h-dom" data-id="' + h.id + '">' + (h.dominada ? 'Voltar a estudar' : 'Marcar como dominada') + '</button><button class="btn ghost sm" data-a="h-edit" data-id="' + h.id + '">Editar</button></div></div>';
}

function editor(ctx, h) {
  const esc = ctx.esc;
  return '<div class="card stack" data-he="' + h.id + '"><label class="field"><span class="lbl">Habilidade para desenvolver</span><input class="in" data-hf="nome" value="' + esc(h.nome) + '" placeholder="Ex.: Montar o fundo do guarda-roupa"></label>' +
    '<label class="field"><span class="lbl">Qual é a dificuldade?</span><textarea class="in" rows="4" data-hf="descricao" placeholder="Ex.: Colocar o móvel no esquadro e montar o fundo mais rápido">' + esc(h.descricao) + '</textarea></label>' +
    '<div class="row"><button class="btn sm" data-a="h-save" data-id="' + h.id + '">Salvar</button><button class="btn ghost sm" data-a="h-cancel">Cancelar</button>' +
    (h.id !== 'new' ? '<button class="btn ghost sm" data-a="h-del" data-id="' + h.id + '">Apagar</button>' : '') + '</div></div>';
}

export function render(ctx) {
  const S = ctx.S, est = S.habilidades.filter((h) => !h.dominada), dom = S.habilidades.filter((h) => h.dominada);
  ctx.$('#v-habilidades').innerHTML =
    '<h1>Habilidades</h1><p class="sub">Seus pontos fracos de montagem. Guarde aqui os conteúdos para estudar até virar ponto forte.</p>' +
    '<div class="row" style="margin-bottom:14px"><button class="btn sm" data-a="h-new">+ Nova habilidade</button></div>' +
    (S.hEdit === 'new' ? '<div style="margin-bottom:12px">' + editor(ctx, { id: 'new', nome: '', descricao: '' }) + '</div>' : '') +
    (est.length ? '<div class="stack">' + est.map((h) => card(ctx, h)).join('') + '</div>' : (S.hEdit === 'new' || dom.length ? '' : '<div class="card muted">Nenhuma habilidade ainda. Toque em "Nova habilidade" e registre o que você quer melhorar.</div>')) +
    (dom.length ? '<h2>Dominadas</h2><div class="stack">' + dom.map((h) => card(ctx, h)).join('') + '</div>' : '');
}

export async function click(a, t, ctx) {
  if (a.slice(0, 2) !== 'h-') return false;
  const S = ctx.S, id = t.getAttribute('data-id'), h = S.habilidades.filter((x) => x.id === id)[0];
  if (a === 'h-new') { S.hEdit = 'new'; render(ctx); return true; }
  if (a === 'h-edit') { S.hEdit = id; render(ctx); return true; }
  if (a === 'h-cancel') { S.hEdit = null; render(ctx); return true; }
  if (a === 'h-save') {
    const box = ctx.$('[data-he="' + id + '"]'); if (!box) return true;
    const nome = box.querySelector('[data-hf="nome"]').value.trim(), descricao = box.querySelector('[data-hf="descricao"]').value.trim();
    if (!nome) { ctx.toast('Dê um nome para a habilidade'); return true; }
    t.disabled = true;
    try {
      const saved = await api.saveHab({ id: id === 'new' ? null : id, nome, descricao });
      if (h) { saved.links = h.links; S.habilidades[S.habilidades.indexOf(h)] = saved; } else S.habilidades.push(saved);
      S.hEdit = null; render(ctx); ctx.toast('Habilidade salva');
    } catch (e) { t.disabled = false; ctx.toast('Não consegui salvar. Tente de novo.'); }
    return true;
  }
  if (a === 'h-del') {
    if (t.dataset.arm !== '1') { t.dataset.arm = '1'; t.textContent = 'Toque de novo'; t.classList.add('arm'); setTimeout(() => { t.dataset.arm = ''; t.textContent = 'Apagar'; t.classList.remove('arm'); }, 3000); return true; }
    try { await api.deleteHab(id); S.habilidades = S.habilidades.filter((x) => x.id !== id); S.hEdit = null; render(ctx); ctx.toast('Habilidade apagada'); } catch (e) { ctx.toast('Não consegui apagar. Tente de novo.'); }
    return true;
  }
  if (!h) return true;
  const salvaLinks = async (novo, antigo) => {
    h.links = novo; render(ctx);
    try { await api.patchHab(h.id, { links: novo }); } catch (e) { h.links = antigo; render(ctx); ctx.toast('Não consegui salvar. Tente de novo.'); }
  };
  if (a === 'h-dom') {
    h.dominada = !h.dominada; render(ctx);
    try { await api.patchHab(h.id, { dominada: h.dominada }); if (h.dominada) ctx.toast('Parabéns! Habilidade dominada.'); } catch (e) { h.dominada = !h.dominada; render(ctx); ctx.toast('Não consegui salvar. Tente de novo.'); }
    return true;
  }
  if (a === 'h-ladd') {
    const box = ctx.$('[data-hb="' + id + '"]'), url = normUrl(box.querySelector('[data-hl="url"]').value), titulo = box.querySelector('[data-hl="titulo"]').value.trim().slice(0, 120);
    if (!url) { ctx.toast('Cole um link válido, por exemplo youtube.com/...'); return true; }
    await salvaLinks(h.links.concat([{ id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), url, titulo, visto: false }]), h.links);
    return true;
  }
  const lid = t.getAttribute('data-l');
  if (a === 'h-visto') { await salvaLinks(h.links.map((l) => l.id === lid ? { ...l, visto: !l.visto } : l), h.links); return true; }
  if (a === 'h-ldel') { await salvaLinks(h.links.filter((l) => l.id !== lid), h.links); return true; }
  return false;
}
