// Fontes e imagens do currículo em PDF. Tudo aqui é carregado só na hora de gerar o PDF.
import f400 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff?url';
import f600 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff?url';
import f700 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff?url';
import f800 from '@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff?url';

let fontesRegistradas = false;

/** Registra a fonte da marca (Plus Jakarta Sans) no gerador de PDF. Só faz isso uma vez. */
export async function registrarFontesCurriculo(): Promise<void> {
  if (fontesRegistradas) return;
  const { Font } = await import('@react-pdf/renderer');
  Font.register({
    family: 'PlusJakarta',
    fonts: [
      { src: f400, fontWeight: 400 },
      { src: f600, fontWeight: 600 },
      { src: f700, fontWeight: 700 },
      { src: f800, fontWeight: 800 },
    ],
  });
  fontesRegistradas = true;
}

interface OpcoesImagem {
  /** Recorta a imagem para este tamanho (preenchendo tudo, como um "cover"). */
  cortar?: { largura: number; altura: number };
  /** Sem recorte: reduz para caber neste lado máximo. */
  ladoMaximo?: number;
  formato?: 'jpeg' | 'png';
}

/**
 * Baixa uma imagem e devolve como data URL em JPEG ou PNG. O gerador de PDF não lê webp (formato das fotos do app),
 * por isso a conversão. Devolve null se a imagem não puder ser carregada: o currículo sai sem ela, sem erro.
 */
export async function imagemParaDataUrl(url: string | null | undefined, opcoes: OpcoesImagem = {}): Promise<string | null> {
  if (!url) return null;
  try {
    const resposta = await fetch(url, { mode: 'cors' });
    if (!resposta.ok) return null;
    const bitmap = await createImageBitmap(await resposta.blob());
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const formato = opcoes.formato ?? 'jpeg';

    if (opcoes.cortar) {
      const { largura, altura } = opcoes.cortar;
      canvas.width = largura;
      canvas.height = altura;
      const escala = Math.max(largura / bitmap.width, altura / bitmap.height);
      const w = bitmap.width * escala;
      const h = bitmap.height * escala;
      // Mostra mais o alto da imagem (rosto) quando sobra altura
      ctx.drawImage(bitmap, (largura - w) / 2, (altura - h) * 0.3, w, h);
    } else {
      const lado = opcoes.ladoMaximo ?? 160;
      const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * escala);
      canvas.height = Math.round(bitmap.height * escala);
      if (formato === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    }
    return canvas.toDataURL(formato === 'png' ? 'image/png' : 'image/jpeg', 0.88);
  } catch {
    return null;
  }
}
