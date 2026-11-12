import { supabase } from './supabase.js';

const BUCKET = 'arquivos';

function fail(error) {
  if (error) throw new Error(error.message || 'Erro ao falar com o servidor');
}

export function localDay(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const byOrdem = (a, b) => (a.ordem || 0) - (b.ordem || 0);

function mapOS(o) {
  if (!o) return null;
  return {
    id: o.id,
    data: o.data_servico,
    checkin: o.checkin_em ? Date.parse(o.checkin_em) : null,
    tools: o.ferramentas || {},
    extras: o.ferramenta_extra || '',
    gargalos: o.gargalos || [],
    fim: o.finalizada_em ? Date.parse(o.finalizada_em) : null,
    itens: (o.os_itens || []).slice().sort(byOrdem).map((i) => ({
      id: i.id,
      nome: i.nome,
      tipo: i.tipo,
      min: i.minutos_previstos,
      real: (i.segundos_acumulados || 0) * 1000,
      running: !!i.retomado_em,
      since: i.retomado_em ? Date.parse(i.retomado_em) : null,
      done: !!i.concluido,
    })),
  };
}

function mapBudget(r) {
  const o = Array.isArray(r.ordens_servico) ? r.ordens_servico[0] : r.ordens_servico;
  return {
    id: r.id,
    n: r.numero,
    cliente: r.cliente,
    tel: r.telefone || '',
    bairro: r.bairro || '',
    cobrado: Number(r.valor_cobrado),
    fotoPath: r.foto_path || null,
    fotoData: null,
    status: r.status,
    data: localDay(r.created_at),
    itens: (r.orcamento_itens || []).slice().sort(byOrdem).map((i) => ({ nome: i.nome, tipo: i.tipo, min: i.minutos_previstos })),
    os: mapOS(o),
  };
}

/* ---------- arquivos ---------- */
function dataUrlToBlob(u) {
  const [head, b64] = u.split(',');
  const mime = /data:(.*?);/.exec(head)[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function uploadImage(path, dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: blob.type });
  fail(error);
  return path;
}

export async function downloadAsDataUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  fail(error);
  return await new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(new Error('Falha ao ler a imagem'));
    fr.readAsDataURL(data);
  });
}

/* ---------- carga inicial ---------- */
export async function loadAll(userId) {
  let { data: p, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  fail(error);
  if (!p) {
    const ins = await supabase.from('profiles').insert({ id: userId }).select().single();
    fail(ins.error);
    p = ins.data;
  }
  const { data: rows, error: e2 } = await supabase
    .from('orcamentos')
    .select('*, orcamento_itens(*), ordens_servico(*, os_itens(*))')
    .order('numero', { ascending: false });
  fail(e2);
  const [tb, lc, dp] = await Promise.all([
    supabase.from('tabela_referencia').select('*').order('grupo', { ascending: true }).order('ordem', { ascending: true }),
    supabase.from('lancamentos').select('*').order('data', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('disponibilidade').select('*'),
  ]);
  fail(tb.error); fail(lc.error); fail(dp.error);
  let logo = null;
  if (p.logo_path) {
    try { logo = await downloadAsDataUrl(p.logo_path); } catch (e) { logo = null; }
  }
  return {
    profile: {
      nome: p.nome_negocio || '',
      logoPath: p.logo_path,
      meta: Number(p.meta_mensal),
      custos: Number(p.custos_mensais),
      dias: Number(p.dias_mes),
      hdia: Number(p.horas_dia),
    },
    logo,
    budgets: rows.map(mapBudget),
    tabela: tb.data.map(mapRef),
    lanc: lc.data.map(mapLanc),
    disp: Object.fromEntries(dp.data.map((r) => [r.data, { status: r.status, nota: r.nota || '' }])),
  };
}

/* ---------- tabela de referência ---------- */
function mapRef(r) {
  return { id: r.id, grupo: r.grupo, nome: r.nome, min: Number(r.preco_min), max: r.preco_max == null ? null : Number(r.preco_max), un: r.unidade || '', mins: r.minutos_sugeridos, ordem: r.ordem };
}
export async function saveRef(row) {
  const body = { grupo: row.grupo, nome: row.nome, preco_min: row.min, preco_max: row.max, unidade: row.un || '', minutos_sugeridos: row.mins, ordem: row.ordem || 0 };
  if (row.id) {
    const { data, error } = await supabase.from('tabela_referencia').update(body).eq('id', row.id).select().single();
    fail(error); return mapRef(data);
  }
  const { data, error } = await supabase.from('tabela_referencia').insert(body).select().single();
  fail(error); return mapRef(data);
}
export async function deleteRef(id) {
  const { error } = await supabase.from('tabela_referencia').delete().eq('id', id);
  fail(error);
}

/* ---------- fluxo de caixa ---------- */
function mapLanc(r) {
  return { id: r.id, tipo: r.tipo, cat: r.categoria, desc: r.descricao || '', valor: Number(r.valor), data: r.data, pago: !!r.pago, orcId: r.orcamento_id || null };
}
export async function createLanc(l) {
  const { data, error } = await supabase.from('lancamentos')
    .insert({ tipo: l.tipo, categoria: l.cat, descricao: l.desc || '', valor: l.valor, data: l.data, pago: l.pago, orcamento_id: l.orcId || null })
    .select().single();
  fail(error); return mapLanc(data);
}
export async function createLancMany(list) {
  const rows = list.map((l) => ({ tipo: l.tipo, categoria: l.cat, descricao: l.desc || '', valor: l.valor, data: l.data, pago: l.pago }));
  const { data, error } = await supabase.from('lancamentos').insert(rows).select();
  fail(error); return data.map(mapLanc);
}
export async function setLancPago(id, pago) {
  const { error } = await supabase.from('lancamentos').update({ pago }).eq('id', id);
  fail(error);
}
export async function deleteLanc(id) {
  const { error } = await supabase.from('lancamentos').delete().eq('id', id);
  fail(error);
}

/* ---------- agenda ---------- */
export async function setDisp(userId, data, status, nota) {
  const { error } = await supabase.from('disponibilidade').upsert({ user_id: userId, data, status, nota: nota || '' }, { onConflict: 'user_id,data' });
  fail(error);
}
export async function clearDisp(userId, data) {
  const { error } = await supabase.from('disponibilidade').delete().eq('user_id', userId).eq('data', data);
  fail(error);
}

/* ---------- envio do orçamento ---------- */
export async function uploadPdf(path, blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'application/pdf' });
  fail(error);
}
export async function signedUrl(path, seconds) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  fail(error); return data.signedUrl;
}
export async function deleteBudget(id, paths) {
  // lançamentos ainda não pagos/recebidos ligados a este orçamento saem junto; os já pagos ficam no caixa
  let r = await supabase.from('lancamentos').delete().eq('orcamento_id', id).eq('pago', false); fail(r.error);
  r = await supabase.from('orcamentos').delete().eq('id', id); fail(r.error);
  if (paths && paths.length) { try { await supabase.storage.from(BUCKET).remove(paths); } catch (e) { /* arquivo órfão não é problema */ } }
}
export async function setTel(id, tel) {
  const { error } = await supabase.from('orcamentos').update({ telefone: tel }).eq('id', id);
  fail(error);
}

/* ---------- perfil ---------- */
export async function saveProfile(userId, v) {
  const patch = {};
  if ('nome' in v) patch.nome_negocio = v.nome;
  if ('meta' in v) patch.meta_mensal = v.meta;
  if ('custos' in v) patch.custos_mensais = v.custos;
  if ('dias' in v) patch.dias_mes = v.dias;
  if ('hdia' in v) patch.horas_dia = v.hdia;
  if ('logoPath' in v) patch.logo_path = v.logoPath;
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  fail(error);
}

/* ---------- orçamentos ---------- */
export async function createBudget(userId, d) {
  let fotoPath = null;
  if (d.foto) {
    fotoPath = `${userId}/fotos/${crypto.randomUUID()}.jpg`;
    await uploadImage(fotoPath, d.foto);
  }
  const { data: o, error } = await supabase
    .from('orcamentos')
    .insert({ cliente: d.cliente, telefone: d.tel, bairro: d.bairro, valor_cobrado: d.cobrado, foto_path: fotoPath })
    .select()
    .single();
  fail(error);
  const itens = d.itens.map((i, k) => ({ orcamento_id: o.id, ordem: k, nome: i.nome, tipo: i.tipo, minutos_previstos: i.min }));
  const { error: e2 } = await supabase.from('orcamento_itens').insert(itens);
  if (e2) {
    await supabase.from('orcamentos').delete().eq('id', o.id);
    fail(e2);
  }
  const b = mapBudget({ ...o, orcamento_itens: itens.map((i) => ({ ...i })), ordens_servico: null });
  b.fotoData = d.foto || null;
  return b;
}

export async function setStatus(id, status) {
  const { error } = await supabase.from('orcamentos').update({ status }).eq('id', id);
  fail(error);
}

export async function approve(b, dataServico) {
  const { data: o, error } = await supabase
    .from('ordens_servico')
    .insert({ orcamento_id: b.id, data_servico: dataServico })
    .select()
    .single();
  fail(error);
  const rows = b.itens.map((i, k) => ({ ordem_id: o.id, ordem: k, nome: i.nome, tipo: i.tipo, minutos_previstos: i.min }));
  const { data: its, error: e2 } = await supabase.from('os_itens').insert(rows).select();
  if (e2) {
    await supabase.from('ordens_servico').delete().eq('id', o.id);
    fail(e2);
  }
  await setStatus(b.id, 'aprovado');
  return mapOS({ ...o, os_itens: its });
}

/* ---------- ordem de serviço ---------- */
export async function updateOS(osId, v) {
  const patch = {};
  if ('data' in v) patch.data_servico = v.data || null;
  if ('checkin' in v) patch.checkin_em = v.checkin ? new Date(v.checkin).toISOString() : null;
  if ('tools' in v) patch.ferramentas = v.tools;
  if ('extras' in v) patch.ferramenta_extra = v.extras;
  if ('gargalos' in v) patch.gargalos = v.gargalos;
  if ('fim' in v) patch.finalizada_em = v.fim ? new Date(v.fim).toISOString() : null;
  const { error } = await supabase.from('ordens_servico').update(patch).eq('id', osId);
  fail(error);
}

export async function updateItem(id, v) {
  const patch = {};
  if ('real' in v) patch.segundos_acumulados = Math.round(v.real / 1000);
  if ('since' in v) patch.retomado_em = v.since ? new Date(v.since).toISOString() : null;
  if ('done' in v) patch.concluido = v.done;
  const { error } = await supabase.from('os_itens').update(patch).eq('id', id);
  fail(error);
}

/* ---------- login ---------- */
export async function entrar(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  fail(error);
  return data.session;
}
export async function criarConta(email, senha) {
  const { data, error } = await supabase.auth.signUp({ email, password: senha });
  fail(error);
  return data;
}
export async function sair() {
  await supabase.auth.signOut();
}
