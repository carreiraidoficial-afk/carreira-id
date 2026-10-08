import { Suspense, lazy, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image as ImageIcon, User, Video } from 'lucide-react';

const CreatePostForm = lazy(() => import('@/components/carreira/CreatePostForm').then((m) => ({ default: m.CreatePostForm })));

/** Um perfil pelo qual a pessoa pode publicar (o atleta ativo, um perfil profissional...). */
export interface AutorPublicacao {
  chave: string;
  nome: string;
  foto: string | null;
  /** "Atleta", "Dono de Escola"... */
  rotulo: string;
  corDestaque?: string | null;
  /** Atleta: o perfil completo (o formulário publica como autor_id). */
  perfilAtleta?: any;
  /** Profissional: publica como perfil_rede_id. */
  perfilRedeId?: string;
}

interface Props {
  autores: AutorPublicacao[];
}

/** Barra de publicar do topo do Feed: um clique abre o formulário completo (fotos, vídeo, link). Quando a conta tem
 * mais de um perfil, a pessoa escolhe por qual deles publica. */
export function FeedComposer({ autores }: Props) {
  const [aberto, setAberto] = useState(false);
  const [chave, setChave] = useState<string>(autores[0]?.chave ?? '');

  // Se a lista de perfis mudar (troca do atleta ativo, por exemplo), mantém um autor válido selecionado.
  useEffect(() => {
    if (!autores.some((a) => a.chave === chave)) setChave(autores[0]?.chave ?? '');
  }, [autores, chave]);

  const autor = autores.find((a) => a.chave === chave) ?? autores[0];
  if (!autor) return null;
  const cor = autor.corDestaque || '#3b82f6';

  return (
    <>
      <Card className="p-3" style={{ borderColor: `${cor}40`, borderWidth: 1 }}>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            {autor.foto ? <AvatarImage src={autor.foto} alt={autor.nome} className="object-top" /> : null}
            <AvatarFallback><User className="h-5 w-5" /></AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="flex-1 rounded-full border bg-muted/30 px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60"
          >
            Compartilhe um momento…
          </button>
        </div>
        <div className="mt-2 flex gap-1 pl-[3.25rem]">
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
          >
            <ImageIcon className="h-4 w-4" style={{ color: cor }} /> Foto
          </button>
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50"
          >
            <Video className="h-4 w-4" style={{ color: cor }} /> Vídeo
          </button>
        </div>
      </Card>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle>Nova publicação</DialogTitle>
            <DialogDescription className="sr-only">Escreva e publique no Feed</DialogDescription>
          </DialogHeader>

          {autores.length > 1 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Publicando como</p>
              <Select value={autor.chave} onValueChange={(v) => { if (v) setChave(v); }}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {autores.map((a) => (
                    <SelectItem key={a.chave} value={a.chave}>
                      {a.nome} · {a.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Suspense fallback={null}>
            <CreatePostForm
              key={autor.chave}
              perfil={autor.perfilAtleta}
              perfilRedeId={autor.perfilRedeId}
              perfilRedeNome={autor.perfilRedeId ? autor.nome : undefined}
              perfilRedeFoto={autor.perfilRedeId ? autor.foto : undefined}
              accentColor={cor}
              onPublicado={() => setAberto(false)}
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
}
