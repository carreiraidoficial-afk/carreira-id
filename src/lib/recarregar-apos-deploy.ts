/**
 * O app carrega cada tela sob demanda (um arquivo por tela, com nome que muda a cada versão publicada). Quem deixa o app
 * aberto durante uma atualização tem na memória a lista dos arquivos da versão ANTIGA; ao clicar num item do menu, o
 * navegador pede um arquivo que não existe mais e a tela quebra ("Ops, algo deu errado") até recarregar.
 * Aqui detectamos esse caso e recarregamos sozinhos, uma vez, para pegar a versão nova.
 */
const CHAVE = 'carreira_recarga_por_versao_nova';
const INTERVALO_MIN_MS = 30 * 1000;

export function ehErroDeArquivoDesatualizado(mensagem: string | undefined | null): boolean {
  const m = String(mensagem || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(m);
}

/** Recarrega a página, no máximo uma vez a cada 30s (evita laço se o problema for outro). Devolve se recarregou. */
export function recarregarParaVersaoNova(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CHAVE) || 0);
    if (Date.now() - ultima < INTERVALO_MIN_MS) return false;
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // sem sessionStorage: ainda vale tentar uma vez
  }
  window.location.reload();
  return true;
}
