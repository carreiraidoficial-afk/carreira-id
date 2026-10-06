import { forwardRef, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPhoneInput } from '@/lib/form-validators';

interface Pais {
  codigo: string; // chave do select
  nome: string;
  ddi: string; // '' = "Outro" (usuário digita o código junto com o número)
}

const BRASIL: Pais = { codigo: 'BR', nome: 'Brasil', ddi: '55' };
const OUTRO: Pais = { codigo: 'OUTRO', nome: 'Outro país', ddi: '' };

/** Destinos mais comuns de brasileiros no exterior primeiro; o resto cai em "Outro país". */
const PAISES: Pais[] = [
  BRASIL,
  { codigo: 'CH', nome: 'Suíça', ddi: '41' },
  { codigo: 'PT', nome: 'Portugal', ddi: '351' },
  { codigo: 'US', nome: 'Estados Unidos / Canadá', ddi: '1' },
  { codigo: 'ES', nome: 'Espanha', ddi: '34' },
  { codigo: 'GB', nome: 'Reino Unido', ddi: '44' },
  { codigo: 'DE', nome: 'Alemanha', ddi: '49' },
  { codigo: 'IT', nome: 'Itália', ddi: '39' },
  { codigo: 'FR', nome: 'França', ddi: '33' },
  { codigo: 'IE', nome: 'Irlanda', ddi: '353' },
  { codigo: 'NL', nome: 'Países Baixos', ddi: '31' },
  { codigo: 'BE', nome: 'Bélgica', ddi: '32' },
  { codigo: 'AT', nome: 'Áustria', ddi: '43' },
  { codigo: 'LU', nome: 'Luxemburgo', ddi: '352' },
  { codigo: 'AU', nome: 'Austrália', ddi: '61' },
  { codigo: 'JP', nome: 'Japão', ddi: '81' },
  { codigo: 'AR', nome: 'Argentina', ddi: '54' },
  { codigo: 'UY', nome: 'Uruguai', ddi: '598' },
  { codigo: 'PY', nome: 'Paraguai', ddi: '595' },
  { codigo: 'CL', nome: 'Chile', ddi: '56' },
  { codigo: 'MX', nome: 'México', ddi: '52' },
  { codigo: 'AE', nome: 'Emirados Árabes', ddi: '971' },
  { codigo: 'QA', nome: 'Catar', ddi: '974' },
  OUTRO,
];

const POR_PREFIXO = PAISES.filter((p) => p.ddi && p.codigo !== 'BR').sort((a, b) => b.ddi.length - a.ddi.length);

/** Descobre o país pelo valor guardado: sem "+" é Brasil; com "+" vale o maior prefixo conhecido. */
function paisDoValor(valor: string): Pais {
  if (!valor.trim().startsWith('+')) return BRASIL;
  const digitos = valor.replace(/\D/g, '');
  return POR_PREFIXO.find((p) => digitos.startsWith(p.ddi)) ?? OUTRO;
}

interface Props {
  /** Valor guardado: "(21) 99999-9999" (Brasil) ou "+41791234567" (outros países). */
  value: string;
  onChange: (valor: string) => void;
  id?: string;
}

/** Telefone com seletor de país. Brasil mantém a máscara de sempre; outros países guardam
 * "+" + código + número, formato que a validação e o link do WhatsApp já entendem. */
export const TelefoneInput = forwardRef<HTMLInputElement, Props>(({ value, onChange, id }, ref) => {
  const [pais, setPais] = useState<Pais>(() => paisDoValor(value));

  // Valor trocado de fora (ex.: dialog de edição carregando o perfil): reacerta o país.
  useEffect(() => {
    const internacional = value.trim().startsWith('+');
    if (value === '') return;
    if (pais.codigo === 'BR' && !internacional) return;
    if (pais.codigo === 'OUTRO' && internacional) return;
    if (internacional && paisDoValor(value).codigo === pais.codigo) return;
    setPais(paisDoValor(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const digitosNacionais = (() => {
    const todos = value.replace(/\D/g, '');
    if (pais.codigo === 'BR') return value.trim().startsWith('+') ? todos.slice(2) : todos;
    if (pais.codigo === 'OUTRO') return todos;
    return todos.startsWith(pais.ddi) ? todos.slice(pais.ddi.length) : todos;
  })();

  const montar = (alvo: Pais, digitos: string): string => {
    if (alvo.codigo === 'BR') return formatPhoneInput(digitos);
    if (!digitos) return '';
    if (alvo.codigo === 'OUTRO') return `+${digitos.slice(0, 15)}`;
    return `+${alvo.ddi}${digitos.slice(0, 15 - alvo.ddi.length)}`;
  };

  const trocarPais = (codigo: string) => {
    const novo = PAISES.find((p) => p.codigo === codigo) ?? BRASIL;
    setPais(novo);
    onChange(montar(novo, digitosNacionais));
  };

  const digitar = (bruto: string) => {
    let digitos = bruto.replace(/\D/g, '');
    // Colou com o 55 na frente: tira, o 55 já é o país.
    if (pais.codigo === 'BR' && digitos.length > 11 && digitos.startsWith('55')) digitos = digitos.slice(2);
    onChange(montar(pais, digitos));
  };

  const exibicao = pais.codigo === 'BR' ? formatPhoneInput(digitosNacionais) : digitosNacionais;

  return (
    <div className="flex gap-2">
      <Select value={pais.codigo} onValueChange={trocarPais}>
        <SelectTrigger className="w-[130px] shrink-0" aria-label="País do telefone">
          <SelectValue>{pais.codigo === 'OUTRO' ? 'Outro (+)' : `${pais.codigo} +${pais.ddi}`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PAISES.map((p) => (
            <SelectItem key={p.codigo} value={p.codigo}>
              {p.nome}{p.ddi ? ` (+${p.ddi})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        ref={ref}
        type="tel"
        inputMode="tel"
        value={exibicao}
        onChange={(e) => digitar(e.target.value)}
        placeholder={
          pais.codigo === 'BR' ? '(11) 99999-9999' : pais.codigo === 'OUTRO' ? 'Código do país + número' : 'Número de telefone'
        }
        maxLength={pais.codigo === 'BR' ? 15 : 17}
        className="min-w-0 flex-1"
      />
    </div>
  );
});
TelefoneInput.displayName = 'TelefoneInput';
