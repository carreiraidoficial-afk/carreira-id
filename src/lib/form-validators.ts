import { validateCPF } from './cpf-validator';
import { validateCNPJ } from './cnpj-validator';

/**
 * Validates a Brazilian phone number (10 or 11 digits: DDD + number)
 * Rejects obviously fake numbers like all same digits
 */
export function validatePhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  // Número internacional (começa com "+"): código do país + número, 8 a 15 dígitos (E.164)
  if (phone.trim().startsWith('+')) {
    return clean.length >= 8 && clean.length <= 15 && !/^(\d)\1+$/.test(clean);
  }
  if (clean.length < 10 || clean.length > 11) return false;
  // Reject all same digits
  if (/^(\d)\1+$/.test(clean)) return false;
  // DDD must be between 11 and 99
  const ddd = parseInt(clean.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  // Mobile numbers (11 digits) must start with 9 after DDD
  if (clean.length === 11 && clean[2] !== '9') return false;
  return true;
}

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  // Basic but solid regex
  const re = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
  return re.test(trimmed);
}

/**
 * Validates CPF or CNPJ based on type
 */
export function validateDocument(doc: string, tipo: 'cpf' | 'cnpj'): boolean {
  const clean = doc.replace(/\D/g, '');
  if (!clean) return false;
  return tipo === 'cnpj' ? validateCNPJ(clean) : validateCPF(clean);
}

/**
 * Phone mask: (XX) XXXXX-XXXX
 */
export function formatPhoneMask(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** WhatsApp support number */
export const SUPPORT_WHATSAPP = '5521969622045';
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20meu%20cadastro%20no%20Carreira%20ID`;

/** Guarda "+" na frente quando o número é internacional; brasileiro fica só com dígitos. */
export function limparTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  return valor.trim().startsWith('+') && digitos ? `+${digitos}` : digitos;
}

/** Máscara do campo de telefone: "+41791234567" (internacional) ou (XX) XXXXX-XXXX (Brasil). */
export function formatPhoneInput(value: string): string {
  if (value.trim().startsWith('+')) return `+${value.replace(/\D/g, '').slice(0, 15)}`;
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Dígitos prontos pro wa.me: internacional ("+") vai como está; brasileiro ganha o 55. */
export function telefoneParaWhatsapp(telefone: string | null | undefined): string {
  const bruto = String(telefone || '');
  const digitos = bruto.replace(/\D/g, '');
  if (!digitos) return '';
  if (bruto.trim().startsWith('+')) return digitos;
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}
