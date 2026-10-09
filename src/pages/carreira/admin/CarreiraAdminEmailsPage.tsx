import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Loader2, Mail, MailOpen, MousePointerClick } from 'lucide-react';
import CarreiraAdminLayout from '@/components/layout/CarreiraAdminLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { dataLocalISO, parseDataLocal } from '@/lib/datas';

interface EmailEnviado {
  id: string;
  user_id: string;
  tipo_email: string;
  categoria: string | null;
  enviado_em: string;
  nome: string | null;
  email: string | null;
  aberto_em: string | null;
  clicado_em: string | null;
}

const ROTULOS: Record<string, string> = {
  lembrete_perfil_1: 'Lembrete de cadastro (1º)',
  lembrete_perfil_2: 'Lembrete de cadastro (2º)',
  lembrete_perfil_3: 'Lembrete de cadastro (3º)',
  perfil_sem_experiencia: 'Perfil sem experiência',
  perfil_sem_jornada: 'Perfil sem jornada',
  digest_responsavel: 'Resumo para o responsável',
  novo_artigo_blog: 'Novo artigo do blog',
};

/** Emails registrados num dia (o dia é o do calendário de quem olha, não o do horário universal). */
function useEmailsDoDia(dia: string) {
  return useQuery({
    queryKey: ['carreira-admin-emails-dia', dia],
    queryFn: async (): Promise<EmailEnviado[]> => {
      const inicio = parseDataLocal(dia);
      const fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 1);
      const db = supabase as any;
      const { data: envios, error } = await db
        .from('carreira_emails_enviados')
        .select('id, user_id, tipo_email, categoria, enviado_em')
        .gte('enviado_em', inicio.toISOString())
        .lt('enviado_em', fim.toISOString())
        .order('enviado_em', { ascending: false })
        .limit(1000);
      if (error) throw error;
      const lista = (envios || []) as any[];
      if (lista.length === 0) return [];
      const userIds = [...new Set(lista.map((e) => e.user_id))];
      const [{ data: perfis }, { data: lembretes }] = await Promise.all([
        db.from('profiles').select('user_id, nome, email').in('user_id', userIds),
        db
          .from('carreira_lembretes_perfil_enviados')
          .select('user_id, numero_lembrete, aberto_em, clicado_em')
          .gte('enviado_em', inicio.toISOString())
          .lt('enviado_em', fim.toISOString()),
      ]);
      const porUser = new Map((perfis || []).map((p: any) => [p.user_id, p]));
      // Abertura e clique só existem para os lembretes de cadastro (rastreados pelo Resend).
      const rastreio = new Map((lembretes || []).map((l: any) => [`${l.user_id}|lembrete_perfil_${l.numero_lembrete}`, l]));
      return lista.map((e) => {
        const r = rastreio.get(`${e.user_id}|${e.tipo_email}`) as any;
        return {
          ...e,
          nome: (porUser.get(e.user_id) as any)?.nome ?? null,
          email: (porUser.get(e.user_id) as any)?.email ?? null,
          aberto_em: r?.aberto_em ?? null,
          clicado_em: r?.clicado_em ?? null,
        };
      });
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

/** Quantos emails por dia nos últimos 14 dias (clicar escolhe o dia). */
function useResumoDias() {
  return useQuery({
    queryKey: ['carreira-admin-emails-resumo-dias'],
    queryFn: async (): Promise<{ dia: string; total: number }[]> => {
      const hoje = new Date();
      const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 13);
      const { data, error } = await (supabase as any)
        .from('carreira_emails_enviados')
        .select('enviado_em')
        .gte('enviado_em', inicio.toISOString())
        .limit(5000);
      if (error) throw error;
      const contagem = new Map<string, number>();
      for (const r of data || []) {
        const d = dataLocalISO(new Date(r.enviado_em));
        contagem.set(d, (contagem.get(d) || 0) + 1);
      }
      return Array.from({ length: 14 }, (_, i) => {
        const dia = dataLocalISO(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i));
        return { dia, total: contagem.get(dia) || 0 };
      });
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

function somarDias(dia: string, n: number): string {
  const d = parseDataLocal(dia);
  return dataLocalISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

export default function CarreiraAdminEmailsPage() {
  const hoje = dataLocalISO(new Date());
  const [dia, setDia] = useState(hoje);
  const { data: emails, isLoading } = useEmailsDoDia(dia);
  const { data: resumo } = useResumoDias();

  const porTipo = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of emails || []) m.set(e.tipo_email, (m.get(e.tipo_email) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [emails]);

  const total = emails?.length ?? 0;
  const diaFormatado = parseDataLocal(dia).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <CarreiraAdminLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Emails enviados</h1>
          <p className="text-muted-foreground">Relatório dos emails que o app registrou, por dia.</p>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 pt-4">
            <Button variant="outline" size="icon" onClick={() => setDia(somarDias(dia, -1))} aria-label="Dia anterior"><ChevronLeft className="h-4 w-4" /></Button>
            <Input type="date" value={dia} max={hoje} onChange={(e) => e.target.value && setDia(e.target.value)} className="w-44" />
            <Button variant="outline" size="icon" onClick={() => setDia(somarDias(dia, 1))} disabled={dia >= hoje} aria-label="Próximo dia"><ChevronRight className="h-4 w-4" /></Button>
            <Button variant={dia === hoje ? 'default' : 'outline'} onClick={() => setDia(hoje)}>Hoje</Button>
            <Button variant={dia === somarDias(hoje, -1) ? 'default' : 'outline'} onClick={() => setDia(somarDias(hoje, -1))}>Ontem</Button>
            <span className="ml-auto text-sm capitalize text-muted-foreground">{diaFormatado}</span>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Enviados no dia</p><p className="text-3xl font-bold">{isLoading ? '…' : total}</p></CardContent></Card>
          <Card className="sm:col-span-2">
            <CardContent className="pt-4">
              <p className="mb-2 text-xs text-muted-foreground">Por tipo</p>
              {porTipo.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum email neste dia.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {porTipo.map(([tipo, n]) => (
                    <Badge key={tipo} variant="secondary">{ROTULOS[tipo] || tipo}: {n}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Últimos 14 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {(resumo || []).map((r) => (
                <button
                  key={r.dia}
                  type="button"
                  onClick={() => setDia(r.dia)}
                  className={`rounded-lg border px-2.5 py-1.5 text-center text-xs transition-colors ${r.dia === dia ? 'border-primary bg-primary/10 font-semibold' : 'hover:bg-muted/50'}`}
                >
                  <div className="text-muted-foreground">{parseDataLocal(r.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</div>
                  <div className="text-base font-bold">{r.total}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(emails || []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(e.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{e.nome || '—'}</p>
                        <p className="text-xs text-muted-foreground">{e.email}</p>
                      </TableCell>
                      <TableCell className="text-sm">{ROTULOS[e.tipo_email] || e.tipo_email}</TableCell>
                      <TableCell>
                        {e.clicado_em ? (
                          <Badge className="gap-1 border-primary/20 bg-primary/10 text-primary"><MousePointerClick className="h-3 w-3" />Clicou</Badge>
                        ) : e.aberto_em ? (
                          <Badge variant="secondary" className="gap-1"><MailOpen className="h-3 w-3" />Aberto</Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1"><Mail className="h-3 w-3" />Enviado</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {total === 0 && (
                    <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum email registrado neste dia</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          Este relatório mostra os emails que o app registra (lembretes de cadastro e avisos de perfil). Emails de confirmação de cadastro,
          boas-vindas e redefinição de senha ainda não são registrados aqui; para esses, veja o painel do Resend.
          Abertura e clique só existem para os lembretes de cadastro.
        </p>
      </div>
    </CarreiraAdminLayout>
  );
}
