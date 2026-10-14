/** Cartão 1200x630 (JPG) usado como prévia do link da escola no WhatsApp/Facebook.
 * Montado no navegador (canvas) porque o servidor não decodifica webp, que é o formato das imagens enviadas. */

export interface DadosCartaoEscola {
  nome: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  cidade?: string | null;
  estado?: string | null;
  modalidades?: string[];
  categorias?: string[];
  cor?: string | null;
}

const W = 1200;
const H = 630;
const FAIXA_BANNER = 400;

/** Muda quando algo que aparece no cartão muda -- decide se é preciso gerar de novo. */
export function hashCartaoEscola(d: DadosCartaoEscola): string {
  const texto = JSON.stringify([d.nome, d.logoUrl ?? '', d.bannerUrl ?? '', d.cidade ?? '', d.estado ?? '', d.modalidades ?? [], d.categorias ?? [], d.cor ?? '']);
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  return `v1-${(h >>> 0).toString(36)}`;
}

function carregarImagem(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function cobrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const escala = Math.max(w / img.width, h / img.height);
  const dw = img.width * escala;
  const dh = img.height * escala;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function retanguloArredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ajustarTexto(ctx: CanvasRenderingContext2D, texto: string, larguraMax: number): string {
  if (ctx.measureText(texto).width <= larguraMax) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > larguraMax) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Escurece a cor de destaque da escola pra servir de fundo da faixa de texto. */
function corDeFundo(cor?: string | null): string {
  const m = /^#([0-9a-f]{6})$/i.exec(cor || '');
  if (!m) return '#0b1640';
  const n = parseInt(m[1], 16);
  const f = (v: number) => Math.round(v * 0.28);
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

export async function gerarCartaoEscola(d: DadosCartaoEscola): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');

  const [banner, logo] = await Promise.all([
    d.bannerUrl ? carregarImagem(d.bannerUrl) : Promise.resolve(null),
    d.logoUrl ? carregarImagem(d.logoUrl) : Promise.resolve(null),
  ]);

  const fundo = corDeFundo(d.cor);
  const destaque = /^#[0-9a-f]{6}$/i.test(d.cor || '') ? (d.cor as string) : '#facc15';
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, W, H);

  if (banner) {
    cobrir(ctx, banner, 0, 0, W, FAIXA_BANNER);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, FAIXA_BANNER);
    g.addColorStop(0, destaque);
    g.addColorStop(1, '#0f172a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, FAIXA_BANNER);
  }
  ctx.fillStyle = destaque;
  ctx.fillRect(0, FAIXA_BANNER, W, 5);

  // Logo sobreposta ao canto da capa, em moldura branca
  const lado = 190;
  const lx = 48;
  const ly = FAIXA_BANNER - 60;
  ctx.fillStyle = '#ffffff';
  retanguloArredondado(ctx, lx - 8, ly - 8, lado + 16, lado + 16, 22);
  ctx.fill();
  if (logo) {
    ctx.save();
    retanguloArredondado(ctx, lx, ly, lado, lado, 16);
    ctx.clip();
    cobrir(ctx, logo, lx, ly, lado, lado);
    ctx.restore();
  }

  const tx = lx + lado + 40;
  const larguraTexto = W - tx - 48;
  const fonte = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 62px ${fonte}`;
  ctx.fillText(ajustarTexto(ctx, d.nome, larguraTexto), tx, FAIXA_BANNER + 88);

  const modalidades = (d.modalidades ?? []).filter(Boolean).join(', ');
  const local = [d.cidade, d.estado].filter(Boolean).join(' - ');
  const linha1 = [modalidades ? `Escola de ${modalidades}` : 'Escola de esportes', local].filter(Boolean).join('  ·  ');
  ctx.fillStyle = '#cbd5e1';
  ctx.font = `30px ${fonte}`;
  ctx.fillText(ajustarTexto(ctx, linha1, larguraTexto), tx, FAIXA_BANNER + 140);

  const categorias = (d.categorias ?? []).filter(Boolean).join(', ');
  if (categorias) {
    ctx.fillStyle = destaque;
    ctx.font = `bold 30px ${fonte}`;
    ctx.fillText(ajustarTexto(ctx, categorias, larguraTexto), tx, FAIXA_BANNER + 190);
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = `bold 24px ${fonte}`;
  ctx.textAlign = 'right';
  ctx.fillText('carreiraid.com.br', W - 48, H - 32);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('falha ao gerar o cartão'))), 'image/jpeg', 0.88);
  });
}
