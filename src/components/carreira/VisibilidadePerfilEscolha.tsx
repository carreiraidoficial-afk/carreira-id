import { Globe, Lock, Users } from 'lucide-react';

export type VisibilidadePerfil = 'publico' | 'conta' | 'conexoes';

interface Props {
  value: VisibilidadePerfil | null;
  onChange: (v: VisibilidadePerfil) => void;
  /** Texto de apoio acima das opções (ex.: quando a escolha é obrigatória). */
  ajuda?: string;
  /** Mostra a terceira opção (só conexões aprovadas). Só onde a tela sabe gravá-la. */
  incluirConexoes?: boolean;
}

const OPCOES: { valor: VisibilidadePerfil; icone: typeof Globe; titulo: string; texto: string }[] = [
  { valor: 'publico', icone: Globe, titulo: 'Público', texto: 'Qualquer pessoa com o link vê o perfil, mesmo sem conta (inclusive pelo Google e pelo WhatsApp). Bom para ser encontrado por escolas e clubes.' },
  { valor: 'conta', icone: Lock, titulo: 'Só quem tem conta', texto: 'Só quem tem conta no Carreira ID vê o perfil. Visitantes sem conta não veem nada.' },
  { valor: 'conexoes', icone: Users, titulo: 'Só conexões aprovadas', texto: 'Só as pessoas que você aprovar (escola, treinadores, amigos e familiares) veem o perfil. Quem não é conexão vê só que o perfil é restrito e pode pedir conexão.' },
];

/** Escolha de quem pode ver o perfil do atleta: público, só quem tem conta e (quando liberado) só conexões aprovadas. */
export function VisibilidadePerfilEscolha({ value, onChange, ajuda, incluirConexoes = false }: Props) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Quem pode ver o perfil">
      <p className="text-sm font-medium">Quem pode ver o perfil? *</p>
      {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
      <div className="grid gap-2">
        {OPCOES.filter((o) => incluirConexoes || o.valor !== 'conexoes').map((o) => {
          const Icone = o.icone;
          const ativo = value === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => onChange(o.valor)}
              className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${ativo ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
            >
              <Icone className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{o.titulo}</span>
                <span className="block text-xs text-muted-foreground">{o.texto}</span>
              </span>
              <span className={`mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${ativo ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`} />
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Telefone, CPF, data de nascimento e documentos nunca aparecem publicamente. Você pode mudar essa escolha depois, em Configurações.
      </p>
    </div>
  );
}
