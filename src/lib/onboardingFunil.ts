import { supabase } from '@/integrations/supabase/client';

export type EtapaOnboardingFunil = 'tipo_perfil_exibido' | 'tipo_selecionado' | 'formulario_enviado';

/**
 * Registra uma etapa do funil de cadastro (entre login/signup bem-sucedido
 * e o perfil de fato criado). Non-blocking de propósito -- nunca deve
 * atrapalhar o fluxo de cadastro em si, só medir onde ele vaza.
 */
export function trackOnboardingFunil(userId: string, etapa: EtapaOnboardingFunil, tipoPerfil?: string) {
  (supabase as any)
    .from('carreira_onboarding_funil')
    .insert({ user_id: userId, etapa, tipo_perfil: tipoPerfil || null })
    .then(({ error }: any) => {
      if (error) console.error('[onboardingFunil] erro ao registrar etapa:', error);
    });
}
