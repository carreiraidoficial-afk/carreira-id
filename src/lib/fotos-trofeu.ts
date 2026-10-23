import { supabase } from '@/integrations/supabase/client';

/** Foto de uma conquista da Sala de Troféus da escola (o arquivo grande e a miniatura ficam no bucket "jornada-midias"). */
export interface TrofeuFoto {
  id: string;
  trofeu_id: string;
  url: string;
  thumb_url: string;
  caminho: string;
  caminho_thumb: string;
  ordem: number;
}

export const MAX_FOTOS_POR_TROFEU = 6;
const BUCKET = 'jornada-midias';
const LADO_FOTO = 1600;
const LADO_MINIATURA = 480;
const MAX_ARQUIVO_ORIGINAL = 30 * 1024 * 1024;

function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler esta foto. Use uma imagem JPG, PNG ou WebP.')); };
    img.src = url;
  });
}

function paraBlobJpeg(img: HTMLImageElement, ladoMaior: number, qualidade: number): Promise<Blob> {
  const escala = Math.min(1, ladoMaior / Math.max(img.naturalWidth, img.naturalHeight));
  const largura = Math.max(1, Math.round(img.naturalWidth * escala));
  const altura = Math.max(1, Math.round(img.naturalHeight * escala));
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Não foi possível preparar a foto.'));
  ctx.fillStyle = '#ffffff'; // PNG com fundo transparente vira JPEG sem ficar preto
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(img, 0, 0, largura, altura);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível comprimir a foto.'))), 'image/jpeg', qualidade);
  });
}

/**
 * Comprime SEMPRE: a foto vira JPEG de até 1600 px (qualidade 0,8) e a miniatura de até 480 px. Diferente do compressor genérico,
 * nunca devolve o arquivo original se a compressão falhar: uma foto que não dá para ler é recusada em vez de subir gigante.
 */
export async function prepararFotoTrofeu(file: File): Promise<{ foto: Blob; miniatura: Blob }> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    throw new Error('Envie apenas fotos (JPG, PNG ou WebP).');
  }
  if (file.size > MAX_ARQUIVO_ORIGINAL) throw new Error('Essa foto é muito grande (máximo 30 MB).');
  const img = await carregarImagem(file);
  const [foto, miniatura] = await Promise.all([
    paraBlobJpeg(img, LADO_FOTO, 0.8),
    paraBlobJpeg(img, LADO_MINIATURA, 0.75),
  ]);
  return { foto, miniatura };
}

/** Envia as fotos (já comprimidas) de uma conquista e grava os registros. Se algo falhar, apaga o que já subiu. */
export async function enviarFotosTrofeu(trofeuId: string, arquivos: File[], ordemInicial: number): Promise<TrofeuFoto[]> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error('Faça login para enviar fotos.');

  const enviados: string[] = [];
  const registros: Omit<TrofeuFoto, 'id'>[] = [];
  try {
    for (let i = 0; i < arquivos.length; i++) {
      const { foto, miniatura } = await prepararFotoTrofeu(arquivos[i]);
      const base = `${uid}/trofeus/${trofeuId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const caminho = `${base}.jpg`;
      const caminhoThumb = `${base}-t.jpg`;
      const opcoes = { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' };
      const { error: erroFoto } = await supabase.storage.from(BUCKET).upload(caminho, foto, opcoes);
      if (erroFoto) throw erroFoto;
      enviados.push(caminho);
      const { error: erroThumb } = await supabase.storage.from(BUCKET).upload(caminhoThumb, miniatura, opcoes);
      if (erroThumb) throw erroThumb;
      enviados.push(caminhoThumb);
      registros.push({
        trofeu_id: trofeuId,
        url: supabase.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl,
        thumb_url: supabase.storage.from(BUCKET).getPublicUrl(caminhoThumb).data.publicUrl,
        caminho,
        caminho_thumb: caminhoThumb,
        ordem: ordemInicial + i,
      });
    }
    const { data, error } = await (supabase as any).from('rede_trofeu_fotos').insert(registros).select('*');
    if (error) throw error;
    return (data || []) as TrofeuFoto[];
  } catch (erro) {
    if (enviados.length > 0) await supabase.storage.from(BUCKET).remove(enviados).catch(() => undefined);
    throw erro;
  }
}

/** Apaga os arquivos (foto e miniatura) do armazenamento. Falha aqui não impede nada: só deixaria um arquivo solto. */
export async function apagarArquivosFotos(fotos: Pick<TrofeuFoto, 'caminho' | 'caminho_thumb'>[]): Promise<void> {
  const caminhos = fotos.flatMap((f) => [f.caminho, f.caminho_thumb]).filter(Boolean);
  if (caminhos.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove(caminhos);
  } catch (e) {
    console.error('[fotos-trofeu] arquivos não removidos do armazenamento:', e);
  }
}

/** Remove as fotos escolhidas: apaga o registro e, depois, os arquivos. */
export async function removerFotosTrofeu(fotos: TrofeuFoto[]): Promise<void> {
  if (fotos.length === 0) return;
  const { error } = await (supabase as any).from('rede_trofeu_fotos').delete().in('id', fotos.map((f) => f.id));
  if (error) throw error;
  await apagarArquivosFotos(fotos);
}
