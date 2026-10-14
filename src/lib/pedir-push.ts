/** Pede ao ouvinte global (PushContextPrompter) para sugerir ativar as notificações, no momento em que o usuário
 * acabou de fazer algo que gera resposta (pedir ou aceitar conexão). Não faz nada se o aparelho já recebe push. */
export function sugerirAtivarPush(mensagem: string) {
  try { window.dispatchEvent(new CustomEvent('carreira:pedir-push', { detail: { mensagem } })); } catch { /* sem window */ }
}
