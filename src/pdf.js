import { jsPDF } from 'jspdf';

const C = {
  bg: [15, 16, 15],
  surface: [23, 24, 22],
  line: [45, 46, 42],
  text: [236, 228, 216],
  muted: [155, 149, 136],
  champ: [214, 195, 170],
  champHi: [234, 217, 195],
  bronze: [184, 122, 60],
};

const brl = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
const fh = (m) => {
  m = Math.round(m);
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h}h ${String(r).padStart(2, '0')}min` : `${h}h`) : `${r}min`;
};
const fdate = (s) => { const p = s.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

function loadImg(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

// Encaixa a imagem dentro da caixa mantendo a proporção
function fit(im, bw, bh) {
  const k = Math.min(bw / im.naturalWidth, bh / im.naturalHeight);
  return { w: im.naturalWidth * k, h: im.naturalHeight * k };
}

const fmt = (src) => (/^data:image\/png/.test(src) ? 'PNG' : 'JPEG');

export async function gerarPDF({ b, nome, logo, foto }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16;
  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const ink = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const stroke = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const spaced = (t, x, y, cs, o) => {
    try { doc.text(t, x, y, { charSpace: cs, ...(o || {}) }); } catch (e) { doc.text(t, x, y, o); }
  };

  fill(C.bg); doc.rect(0, 0, W, H, 'F');

  // Cabeçalho
  fill(C.surface); doc.rect(0, 0, W, 42, 'F');
  stroke(C.bronze); doc.setLineWidth(0.4); doc.line(0, 42, W, 42);
  let tx = M;
  const lim = logo ? await loadImg(logo) : null;
  if (lim) {
    const s = fit(lim, 26, 26);
    doc.addImage(logo, fmt(logo), M, 8 + (26 - s.h) / 2, s.w, s.h);
    tx = M + 26 + 8;
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); ink(C.champHi);
  spaced((nome || 'Seu nome ou empresa').toUpperCase(), tx, 22, 0.8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(C.muted);
  doc.text('Montagem e instalação de móveis', tx, 28.5);

  // Título
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(C.bronze);
  spaced(`ORÇAMENTO Nº ${String(b.n).padStart(4, '0')}`, M, 58, 1.2);
  const val = new Date(b.data + 'T12:00:00'); val.setDate(val.getDate() + 7);
  const vd = `${String(val.getDate()).padStart(2, '0')}/${String(val.getMonth() + 1).padStart(2, '0')}/${val.getFullYear()}`;

  // Dados do cliente, com a foto do móvel à direita, sem moldura
  const fim = foto ? await loadImg(foto) : null;
  const ps = fim ? fit(fim, 70, 70) : null;
  const valW = (ps ? W - M - ps.w - 6 : W - M) - (M + 28);
  const rows = [['Cliente', b.cliente], ['Contato', b.tel || '-'], ['Endereço', b.bairro || '-'], ['Emissão', fdate(b.data)], ['Validade', vd]];
  let y = 67;
  doc.setFontSize(10.5);
  rows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal'); ink(C.muted); doc.text(k, M, y);
    doc.setFont('helvetica', 'bold'); ink(C.text);
    const ls = doc.splitTextToSize(String(v), valW).slice(0, 3);
    ls.forEach((ln, i) => doc.text(ln, M + 28, y + i * 4.6));
    y += 7 + (ls.length - 1) * 4.6;
  });
  if (ps) {
    doc.addImage(foto, fmt(foto), W - M - ps.w, 52, ps.w, ps.h);
    y = Math.max(y, 52 + ps.h + 4);
  }
  y += 6;

  // Serviços
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); ink(C.champ);
  spaced('SERVIÇOS', M, y, 1.4);
  y += 5;
  stroke(C.line); doc.setLineWidth(0.2); doc.line(M, y, W - M, y);
  y += 6;
  doc.setFontSize(8); ink(C.muted);
  spaced('MÓVEL', M, y, 0.8); spaced('SERVIÇO', M + 82, y, 0.8); spaced('TEMPO', W - M, y, 0.8, { align: 'right' });
  y += 3;
  doc.line(M, y, W - M, y);
  doc.setFontSize(10);
  b.itens.forEach((i) => {
    y += 7;
    doc.setFont('helvetica', 'bold'); ink(C.text);
    const nm = doc.splitTextToSize(i.nome, 76);
    doc.text(nm[0], M, y);
    doc.setFont('helvetica', 'normal'); ink(C.muted);
    doc.text(i.tipo, M + 82, y);
    ink(C.text); doc.text(fh(i.min), W - M, y, { align: 'right' });
    y += 3;
    stroke(C.line); doc.line(M, y, W - M, y);
  });

  // Total
  y += 12;
  stroke(C.bronze); doc.setLineWidth(0.5); doc.line(M, y, W - M, y);
  y += 12;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); ink(C.muted);
  spaced('TOTAL', M, y, 1.4);
  doc.setFontSize(26); ink(C.champHi);
  doc.text(brl(b.cobrado), W - M, y + 1, { align: 'right' });
  y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); ink(C.muted);
  doc.text(`Tempo estimado de execução: ${fh(b.itens.reduce((s, i) => s + i.min, 0))}`, M, y);

  // Rodapé
  const nota = doc.splitTextToSize('Não incluso: frete, serviços extras durante o atendimento e avarias nas peças que impeçam a montagem. Orçamento válido por 7 dias.', W - M * 2);
  doc.setFontSize(8.5); ink(C.muted);
  doc.text(nota, M, H - 22);
  stroke(C.bronze); doc.setLineWidth(0.4); doc.line(M, H - 28, W - M, H - 28);

  return doc.output('blob');
}

export async function compartilharPDF(blob, nomeArquivo, titulo) {
  const file = new File([blob], nomeArquivo, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titulo });
      return 'enviado';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelado';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'baixado';
}
