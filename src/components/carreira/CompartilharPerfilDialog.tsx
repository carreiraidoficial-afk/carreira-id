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
}

type TabKey = 'torcedor' | 'atleta' | 'rede';

export function CompartilharPerfilDialog({
  open,
  onOpenChange,
  ownerUserId,
  atletaNome,
  atletaSlug,
  accentColor,
}: Props) {
  const [tab, setTab] = useState<TabKey>('torcedor');
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
    if (tab === 'torcedor') return TEMPLATES_TORCEDOR;
    if (tab === 'atleta') return tomAtleta === 'crianca' ? TEMPLATES_ATLETA_CRIANCA : TEMPLATES_ATLETA_PAI;
    return TEMPLATES_REDE;
  }, [tab, tomAtleta]);

  // Default template ao mudar tab
  useEffect(() => {
    setTemplateId(templates[0]?.id ?? '');
  }, [tab, tomAtleta, templates]);

  // Link gerado
  const link = useMemo(() => {
    const params = new URLSearchParams();
    params.set('ref', tab);
    if (conviteCodigo) params.set('c', conviteCodigo);
    if (atletaSlug) params.set('a', atletaSlug);
    return `${window.location.origin}${carreiraPath('/cadastro')}?${params.toString()}`;
  }, [tab, conviteCodigo, atletaSlug]);

  // Aplicar template ao mudar template/link/nome
  useEffect(() => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setMensagemEditada(aplicarTemplate(t.body, atletaNome || 'eu', link));
  }, [templateId, templates, atletaNome, link]);

  const enviar = (canal: 'whatsapp' | 'email' | 'copy') => {
    const texto = mensagemEditada;
    if (!texto.trim()) {
      toast.error('A mensagem está vazia');
      return;
    }
    if (canal === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer');
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
      <DialogContent className="max-w-lg p-0 sm:p-0 h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col gap-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full flex-1 flex flex-col min-h-0">
          {/* Sticky header */}
          <div className="sticky top-0 bg-background z-10 border-b px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
            <DialogHeader className="mb-3 text-left">
              <DialogTitle>Compartilhar perfil</DialogTitle>
              <DialogDescription>Escolha quem você quer convidar e a mensagem.</DialogDescription>
            </DialogHeader>
            <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="torcedor" className="text-xs gap-1">
              <Users className="w-3.5 h-3.5" style={tab === 'torcedor' ? tabIconStyle : undefined} />
              Torcedores
            </TabsTrigger>
            <TabsTrigger value="atleta" className="text-xs gap-1">
              <Trophy className="w-3.5 h-3.5" style={tab === 'atleta' ? tabIconStyle : undefined} />
              Atletas
            </TabsTrigger>
            <TabsTrigger value="rede" className="text-xs gap-1">
              <Network className="w-3.5 h-3.5" style={tab === 'rede' ? tabIconStyle : undefined} />
              Rede
            </TabsTrigger>
            </TabsList>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-6 min-h-0">
          <div className="mb-3">
            {tab === 'torcedor' && (
              <p className="text-xs text-muted-foreground">
                Convide avó, tio, primo ou amigos pra torcer pelo {atletaNome || 'atleta'}.
              </p>
            )}
            {tab === 'atleta' && (
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
            {tab === 'rede' && (
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
                className="text-sm resize-y"
              />
            </div>
          </TabsContent>
          </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-background border-t px-4 py-3 sm:px-6">
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

            <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
              Dica: peça para um(a) responsável enviar a mensagem pelo WhatsApp dele(a) — assim a pessoa
              recebe de um número conhecido.
            </p>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
