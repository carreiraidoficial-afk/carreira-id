/**
 * Lê uma data de calendário ("2026-09-12", coluna `date` do banco) como o dia LOCAL.
 *
 * `new Date("2026-09-12")` interpreta como meia-noite no horário universal (UTC). No Brasil (UTC-3) isso vira
 * 11/09 às 21h, e a tela mostrava um dia a menos (e, no 1º dia do mês ou do ano, o mês ou o ano anterior).
 * Qualquer outro formato (com hora, fuso, Date) segue o comportamento normal do `new Date`.
 */
export function parseDataLocal(valor: string | Date | null | undefined): Date {
  if (valor instanceof Date) return valor;
  const texto = String(valor ?? '');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(texto);
}

/** "AAAA-MM-DD" de um Date no dia LOCAL (`toISOString().split("T")[0]` usa o dia universal e, depois das 21h no
 * Brasil, devolve o dia seguinte). */
export function dataLocalISO(data: Date = new Date()): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}
