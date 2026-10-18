import { useState } from 'react';
import { Crown, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCarreiraPlano } from '@/hooks/useCarreiraPlano';
import { useRecursoLiberado } from '@/hooks/useRecursoLiberado';
import type { PerfilAtleta } from '@/hooks/useCarreiraData';
import { CurriculoPdfDialog } from './CurriculoPdfDialog';

interface Props {
  perfil: PerfilAtleta;
  /** Mesma cor dos outros botões da linha (cor de destaque do atleta). */
  accentColor: string;
  className?: string;
  /** Admin em Modo Suporte nesta conta: pode gerar o currículo para orientar a família. */
  emSuporte?: boolean;
}

/**
 * Botão "Currículo PDF" da linha de seções do perfil. Fica em destaque (preenchido, com selo) e abre a janela
 * onde se escolhe o modelo (resumo ou completo) e a aparência (claro ou escuro).
 * Quem não tem o recurso no plano vê um cadeado e a janela explica o Elite.
 */
export function BaixarCurriculoPdfButton({ perfil, accentColor, className = '', emSuporte = false }: Props) {
  const [aberto, setAberto] = useState(false);
  const { user } = useAuth();
  const { temPlano } = useCarreiraPlano(perfil.crianca_id || null);
  // Só o dono do perfil gera o currículo: com plano Elite (assinatura ou teste ativo) ou na lista de teste.
  const ehDono = emSuporte || (!!user?.id && user.id === (perfil as any).user_id);
  // Atletas da lista de teste (carreira_recursos_liberados) também geram o currículo, mesmo sem Elite ativo.
  const emTeste = useRecursoLiberado('curriculo_pdf', perfil.crianca_id, ehDono);
  const liberado = ehDono && (temPlano('premium') || emTeste);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={`relative flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-xs font-bold text-white shadow-sm transition-all duration-200 hover:brightness-110 ${className}`}
        style={{ backgroundColor: accentColor, borderColor: accentColor, backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 55%)' }}
      >
        <FileText className="h-4 w-4" />
        Currículo PDF
        <span className="absolute -top-2 right-2 flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-none" style={{ color: accentColor }}>
          {liberado ? 'PDF' : <><Crown className="h-2.5 w-2.5" /> Elite</>}
        </span>
      </button>
      {aberto && <CurriculoPdfDialog perfil={perfil} open={aberto} onOpenChange={setAberto} liberado={liberado} />}
    </>
  );
}
