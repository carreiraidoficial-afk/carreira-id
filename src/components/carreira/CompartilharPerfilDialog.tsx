import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MessageCircle, Mail, Copy, Check, Users, Trophy, Network } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import {
  TEMPLATES_TORCEDOR,
  TEMPLATES_ATLETA_CRIANCA,
  TEMPLATES_ATLETA_PAI,
  TEMPLATES_REDE,
  TEMPLATES_PROFISSIONAL_COLEGAS,
  TEMPLATES_PROFISSIONAL_ATLETAS,
  aplicarTemplate,
  type Template,
} from './templates-compartilhar';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** user_id do dono do perfil compartilhado (geralmente o pai/responsável) */
  ownerUserId: string;
  /** Nome do atleta (criança) — usado em "Aqui é o {nome}" */
  atletaNome: string;
  /** Slug do atleta — entra na URL como ?a= */
  atletaSlug: string;
  accentColor?: string;
  /** Perfil profissional (professor, técnico, escola, scout...): mensagens e links próprios, sem os de atleta/torcida. */
  profissional?: boolean;
  /** Função mostrada na mensagem ("Professor de Vôlei de Areia"). */
  funcao?: string;
}

type TabKey = 'torcedor' | 'atleta' | 'rede';

export function CompartilharPerfilDialog({
  open,
  onOpenChange,
  ownerUserId,
  atletaNome,
  atletaSlug,
  accentColor,
  profissional = false,
  funcao,
}: Props) {
  // Profissional: "rede" = convidar colegas; "atleta" = convidar atletas/alunos e famílias.
  const [tab, setTab] = useState<TabKey>(profissional ? 'rede' : 'torcedor');
  const [conviteCodigo, setConviteCodigo] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>('direto');
  const [tomAtleta, setTomAtleta] = useState<'crianca' | 'pai'>('crianca');
  const [mensagemEditada, setMensagemEditada] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Buscar convite_codigo do dono (perfis_rede)
  useEffect(() => {
    if (!open || !ownerUserId) return;
    let mounted = true;
    supabase
      .from('perfis_rede')
      .select('convite_codigo')
      .eq('user_id', ownerUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) setConviteCodigo((data as any)?.convite_codigo ?? null);
      });
    return () => {
      mounted = false;
    };
  }, [open, ownerUserId]);

  // Templates do tab atual
  const templates: Template[] = useMemo(() => {
    if (profissional) return tab === 'atleta' ? TEMPLATES_PROFISSIONAL_ATLETAS : TEMPLATES_PROFISSIONAL_COLEGAS;
    if (tab === 'torcedor') return TEMPLATES_TORCEDOR;
    if (tab === 'atleta') return tomAtleta === 'crianca' ? TEMPLATES_ATLETA_CRIANCA : TEMPLATES_ATLETA_PAI;
    return TEMPLATES_REDE;
  }, [tab, tomAtleta, profissional]);

  // Default template ao mudar tab
  useEffect(() => {
    setTemplateId(templates[0]?.id ?? '');
  }, [tab, tomAtleta, templates]);

  // Link gerado
  const link = useMemo(() => {
    const params = new URLSearchParams();
    params.set('ref', tab);
    if (conviteCodigo) params.set('c', conviteCodigo);
    // ?a= é o slug de um ATLETA a seguir; perfil profissional não tem atleta, e com ele o cadastro deixa de
    // conectar o convidado ao convidante.
    if (atletaSlug && !profissional) params.set('a', atletaSlug);
    return `${window.location.origin}${carreiraPath('/cadastro')}?${params.toString()}`;
  }, [tab, conviteCodigo, atletaSlug, profissional]);

  // Aplicar template ao mudar template/link/nome
  useEffect(() => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setMensagemEditada(aplicarTemplate(t.body, atletaNome || 'eu', link, profissional ? funcao : undefined));
  }, [templateId, templates, atletaNome, link, profissional, funcao]);

  const enviar = (canal: 'whatsapp' | 'email' | 'copy') => {
    const texto = mensagemEditada;
    if (!texto.trim()) {
      toast.error('A mensagem está vazia');
      return;
    }
    if (canal === 'whatsapp') {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const url = isMobile
        ? `https://wa.me/?text=${encodeURIComponent(texto)}`
        : `https://web.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } else if (canal === 'email') {
      const subject = `Convite — ${atletaNome}`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(texto)}`;
    } else {
      navigator.clipboard.writeText(texto);
      setCopied(true);
      toast.success('Mensagem copiada!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const tabIconStyle = accentColor ? { color: accentColor } : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto block">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
          {/* Header */}
          <div className="bg-background px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-2">
            <DialogHeader className="mb-3 text-left">
              <DialogTitle>Compartilhar perfil</DialogTitle>
              <DialogDescription>Escolha quem você quer convidar e a mensagem.</DialogDescription>
            </DialogHeader>
            <TabsList className={`grid w-full ${profissional ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {!profissional && (
              <TabsTrigger value="torcedor" className="text-xs gap-1">
                <Users className="w-3.5 h-3.5" style={tab === 'torcedor' ? tabIconStyle : undefined} />
                Torcedores
              </TabsTrigger>
            )}
            <TabsTrigger value="atleta" className="text-xs gap-1">
              <Trophy className="w-3.5 h-3.5" style={tab === 'atleta' ? tabIconStyle : undefined} />
              {profissional ? 'Atletas e alunos' : 'Atletas'}
            </TabsTrigger>
            <TabsTrigger value="rede" className="text-xs gap-1">
              <Network className="w-3.5 h-3.5" style={tab === 'rede' ? tabIconStyle : undefined} />
              {profissional ? 'Colegas' : 'Rede'}
            </TabsTrigger>
            </TabsList>
          </div>

          {/* Content */}
          <div className="px-4 py-3 sm:px-6 sm:py-3">
          <div className="mb-3">
            {profissional && tab === 'atleta' && (
              <p className="text-xs text-muted-foreground">
                Convide atletas, alunos e as famílias deles. Quem criar o perfil por este link já fica conectado a você.
              </p>
            )}
            {profissional && tab === 'rede' && (
              <p className="text-xs text-muted-foreground">
                Convide outros profissionais do esporte. Quem se cadastrar por este link já fica conectado a você.
              </p>
            )}
            {!profissional && tab === 'torcedor' && (
              <p className="text-xs text-muted-foreground">
                Convide avó, tio, primo ou amigos pra torcer pelo {atletaNome || 'atleta'}.
              </p>
            )}
            {!profissional && tab === 'atleta' && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Convide outros atletas pra plataforma.</p>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={tomAtleta === 'crianca' ? 'default' : 'outline'}
                    className="text-xs h-7"
                    onClick={() => setTomAtleta('crianca')}
                    style={tomAtleta === 'crianca' && accentColor ? { backgroundColor: accentColor } : undefined}
                  >
                    Sou eu (atleta)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={tomAtleta === 'pai' ? 'default' : 'outline'}
                    className="text-xs h-7"
                    onClick={() => setTomAtleta('pai')}
                    style={tomAtleta === 'pai' && accentColor ? { backgroundColor: accentColor } : undefined}
                  >
                    Sou o responsável
                  </Button>
                </div>
              </div>
            )}
            {!profissional && tab === 'rede' && (
              <p className="text-xs text-muted-foreground">
                Convide técnicos, scouts e professores. Eles escolhem o tipo de perfil ao se cadastrar.
              </p>
            )}
          </div>

          {/* Lista de templates */}
          <TabsContent value={tab} className="mt-0 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className="transition-all"
                >
                  <Badge
                    variant={templateId === t.id ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    style={templateId === t.id && accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
                  >
                    {t.label}
                    {t.hint && (
                      <span className="ml-1 opacity-70 font-normal">· {t.hint}</span>
                    )}
                  </Badge>
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">
                Pré-visualização (você pode editar)
              </label>
              <Textarea
                value={mensagemEditada}
                onChange={(e) => setMensagemEditada(e.target.value)}
                rows={6}
                className="text-sm resize-y sm:min-h-[220px]"
              />
            </div>
          </TabsContent>
          </div>

          {/* Footer */}
          <div className="bg-background border-t sm:border-t-0 px-4 py-3 sm:px-6 sm:pb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => enviar('whatsapp')}
                className="bg-[#25D366] hover:bg-[#1ebe57] text-white"
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                WhatsApp
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => enviar('email')}>
                <Mail className="w-4 h-4 mr-1" />
                Email
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => enviar('copy')}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>

            {!profissional && (
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
                Dica: peça para um(a) responsável enviar a mensagem pelo WhatsApp dele(a) — assim a pessoa
                recebe de um número conhecido.
              </p>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
