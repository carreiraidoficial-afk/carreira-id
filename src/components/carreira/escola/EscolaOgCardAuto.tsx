import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { gerarCartaoEscola, hashCartaoEscola } from '@/lib/escola-og-card';

interface Props {
  perfil: {
    id: string;
    nome: string;
    foto_url?: string | null;
    banner_url?: string | null;
    cidade?: string | null;
    estado?: string | null;
    dados_perfil?: Record<string, any> | null;
  };
}

/** Mantém o cartão de prévia do link (WhatsApp/Facebook) da escola em dia, sem ninguém precisar fazer nada.
 * Só roda quando o dono (ou o admin em Modo Suporte) abre o perfil: gera o cartão se não existe ou se
 * logo, capa, nome, local, modalidades ou categorias mudaram. Não renderiza nada. */
export function EscolaOgCardAuto({ perfil }: Props) {
  const { user } = useAuth();
  const ultimoHash = useRef<string | null>(null);

  const dados = perfil.dados_perfil || {};
  const entrada = {
    nome: perfil.nome,
    logoUrl: perfil.foto_url,
    bannerUrl: perfil.banner_url,
    cidade: perfil.cidade,
    estado: perfil.estado,
    modalidades: Array.isArray(dados.modalidades) ? (dados.modalidades as string[]) : [],
    categorias: Array.isArray(dados.categorias) ? (dados.categorias as string[]) : [],
    cor: typeof dados.cor_destaque === 'string' ? (dados.cor_destaque as string) : null,
  };
  const hash = hashCartaoEscola(entrada);
  const atualizado = dados.og_hash === hash && !!dados.og_image_url;

  useEffect(() => {
    if (atualizado || !user?.id || !perfil.nome) return;
    if (ultimoHash.current === hash) return;
    ultimoHash.current = hash;

    (async () => {
      try {
        const blob = await gerarCartaoEscola(entrada);
        const caminho = `${user.id}/escola-og-${Date.now()}.jpg`;
        const { error: erroUpload } = await supabase.storage.from('atleta-fotos').upload(caminho, blob, { contentType: 'image/jpeg' });
        if (erroUpload) throw erroUpload;
        const url = supabase.storage.from('atleta-fotos').getPublicUrl(caminho).data.publicUrl;

        // Mescla com o que estiver salvo agora, pra não apagar edição feita enquanto o cartão era gerado.
        const { data: atual } = await supabase.from('perfis_rede').select('dados_perfil').eq('id', perfil.id).maybeSingle();
        const { error } = await supabase
          .from('perfis_rede')
          .update({ dados_perfil: { ...((atual?.dados_perfil as Record<string, any>) || {}), og_image_url: url, og_hash: hash } } as any)
          .eq('id', perfil.id);
        if (error) throw error;
      } catch (err) {
        // Prévia do link é um extra: falhar aqui nunca deve atrapalhar a página.
        console.warn('[EscolaOgCardAuto] não foi possível gerar o cartão:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, atualizado, user?.id, perfil.id]);

  return null;
}
