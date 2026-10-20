/** Navegadores não exibem HEIC/HEIF (foto padrão do iPhone). Converte para JPEG antes de enviar; outros formatos passam direto. */
export async function converterHeicSeNecessario(file: File): Promise<File> {
  const nome = file.name.toLowerCase();
  const ehHeic = file.type === 'image/heic' || file.type === 'image/heif' || nome.endsWith('.heic') || nome.endsWith('.heif');
  if (!ehHeic) return file;
  const heic2any = (await import('heic2any')).default;
  const resultado = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
  const blob = Array.isArray(resultado) ? resultado[0] : resultado;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
}
