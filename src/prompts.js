// Prompts: textos prontos para copiar e colar em uma IA.
import * as api from './api.js';

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch (e) { /* tenta o método antigo */ }
  const ta = document.createElement('textarea');
  ta.value = texto; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, texto.length);
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove(); return ok;
}

export function render(ctx) {
  const S = ctx.S, esc = ctx.esc;
  if (!S.pAberto) S.pAberto = {};
  const lista = S.prompts.map((p) => {
    if (S.pEdit === p.id) return editor(ctx, p);
    const aberto = !!S.pAberto[p.id];
    return '<div class="card pcard"><div class="pt"><b>' + esc(p.titulo) + '</b></div>' +
      '<div class="ptxt' + (aberto ? ' open' : '') + '">' + esc(p.texto) + '</div>' +
      '<div class="row" style="margin-top:12px"><button class="btn sm" data-a="p-copy" data-id="' + p.id + '">Copiar prompt</button>' +
      '<button class="btn ghost sm" data-a="p-toggle" data-id="' + p.id + '">' + (aberto ? 'Recolher' : 'Ver completo') + '</button>' +
      '<button class="btn ghost sm" data-a="p-edit" data-id="' + p.id + '">Editar</button></div></div>';
  }).join('');
  ctx.$('#v-prompts').innerHTML =
    '<h1>Prompts</h1><p class="sub">Textos prontos para colar na sua inteligência artificial. Um toque copia tudo.</p>' +
    '<div class="row" style="margin-bottom:14px"><button class="btn sm" data-a="p-new">+ Novo prompt</button></div>' +
    (S.pEdit === 'new' ? '<div class="card" style="margin-bottom:12px">' + editor(ctx, { id: 'new', titulo: '', texto: '' }, true) + '</div>' : '') +
    (lista ? '<div class="stack">' + lista + '</div>' : '<div class="card muted">Nenhum prompt ainda. Toque em "Novo prompt".</div>');
}

function editor(ctx, p, bare) {
  const esc = ctx.esc;
  const inner = '<div class="stack" data-pe="' + p.id + '"><label class="field"><span class="lbl">Título</span><input class="in" data-pf="titulo" value="' + esc(p.titulo) + '" placeholder="Ex.: Legenda para o Instagram"></label>' +
    '<label class="field"><span class="lbl">Texto do prompt</span><textarea class="in ptext" data-pf="texto" rows="12" placeholder="Cole ou escreva o prompt aqui">' + esc(p.texto) + '</textarea></label>' +
    '<div class="row"><button class="btn sm" data-a="p-save" data-id="' + p.id + '">Salvar</button><button class="btn ghost sm" data-a="p-cancel">Cancelar</button>' +
    (p.id !== 'new' ? '<button class="btn ghost sm del" data-a="p-del" data-id="' + p.id + '">Apagar</button>' : '') + '</div></div>';
  return bare ? inner : '<div class="card">' + inner + '</div>';
}

export async function click(a, t, ctx) {
  const S = ctx.S, id = t.getAttribute('data-id');
  if (a === 'p-copy') {
    const p = S.prompts.filter((x) => x.id === id)[0]; if (!p) return true;
    const ok = await copiar(p.texto);
    if (ok) { const old = t.textContent; t.textContent = 'Copiado ✓'; setTimeout(() => { t.textContent = old; }, 1800); ctx.toast('Prompt copiado'); }
    else ctx.toast('Não consegui copiar. Toque em "Ver completo" e copie manualmente.');
    return true;
  }
  if (a === 'p-toggle') { S.pAberto[id] = !S.pAberto[id]; render(ctx); return true; }
  if (a === 'p-new') { S.pEdit = 'new'; render(ctx); return true; }
  if (a === 'p-edit') { S.pEdit = id; render(ctx); return true; }
  if (a === 'p-cancel') { S.pEdit = null; render(ctx); return true; }
  if (a === 'p-save') {
    const box = ctx.$('[data-pe="' + id + '"]'); if (!box) return true;
    const titulo = box.querySelector('[data-pf="titulo"]').value.trim(), texto = box.querySelector('[data-pf="texto"]').value.trim();
    if (!titulo || !texto) { ctx.toast('Preencha o título e o texto'); return true; }
    const old = S.prompts.filter((x) => x.id === id)[0];
    const saved = await api.savePrompt({ id: id === 'new' ? null : id, titulo, texto, ordem: old ? old.ordem : S.prompts.length + 1 });
    if (old) S.prompts[S.prompts.indexOf(old)] = saved; else S.prompts.push(saved);
    S.pEdit = null; render(ctx); ctx.toast('Prompt salvo'); return true;
  }
  if (a === 'p-del') {
    if (t.dataset.arm !== '1') { t.dataset.arm = '1'; t.textContent = 'Toque de novo'; t.classList.add('arm'); setTimeout(() => { t.dataset.arm = ''; t.textContent = 'Apagar'; t.classList.remove('arm'); }, 3000); return true; }
    await api.deletePrompt(id); S.prompts = S.prompts.filter((x) => x.id !== id); S.pEdit = null; render(ctx); ctx.toast('Prompt apagado'); return true;
  }
  return false;
}
