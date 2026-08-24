import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import mockupRanking from '@/assets/mockup-ranking-celular.png';
import mockupPerfilCelular from '@/assets/mockup-perfil-celular.webp';
import mockupScoutPerfil from '@/assets/mockup-scout-perfil.webp';
import mockupScoutBusca from '@/assets/mockup-scout-busca.webp';
import { carreiraPath } from '@/hooks/useCarreiraBasePath';
import logoCarreira from '@/assets/logo-carreira-id.webp';
import logoAtletaIdDark from '@/assets/logo-atleta-id-dark.webp';
import heroLandingV2Bg from '@/assets/hero-landing-v2-bg.webp';
import heroSolucaoBg from '@/assets/hero-solucao-bg.webp';
import mockupCelular from '@/assets/mockup-carreira-celular.webp';
import torcidaPaisBg from '@/assets/torcida-pais-bg.jpg';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertCircle,
  Frown,
  TrendingUp,
  Ban,
  Building2,
  CheckCircle2,
  Users,
  User,
  School,
  Briefcase,
  Link2,
  Image,
  ArrowRight,
  PlayCircle,
  ShieldCheck,
  Lock,
  EyeOff,
  Search,
  Eye,
  Target,
  Settings,
  Star,
  Trophy,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';

/* ─── Section badge ─── */
function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full border border-orange-500/40 text-orange-400 bg-orange-500/10">
      {children}
    </span>
  );
}

/* ─── Profile card mockup (hero) ─── */
function HeroProfileCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-[#1a2332] border border-[#2a3a4e] shadow-2xl overflow-hidden">
      {/* Verified badge */}
      <div className="flex justify-end p-4 pb-0">
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Perfil Verificado
        </span>
      </div>
      {/* Profile info */}
      <div className="px-5 pt-2 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl">
            JP
          </div>
          <div>
            <h4 className="text-white font-bold text-lg">João Pedro Silva</h4>
            <p className="text-emerald-400 text-sm">Atleta de Base • 15 anos</p>
            <div className="flex gap-2 mt-1.5">
              <span className="text-xs bg-[#2a3a4e] text-gray-300 px-2 py-0.5 rounded">Sub-15</span>
              <span className="text-xs bg-[#2a3a4e] text-gray-300 px-2 py-0.5 rounded">São Paulo, SP</span>
            </div>
          </div>
        </div>
      </div>
      {/* Experience rows */}
      <div className="px-5 space-y-2 pb-4">
        <div className="flex items-center gap-3 bg-[#1e2b3d] rounded-xl p-3 border border-[#2a3a4e]">
          <div className="w-10 h-10 rounded-lg bg-emerald-700/50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">EC Juventude Academy</p>
            <p className="text-gray-400 text-xs">2022 – Atual</p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-[#1e2b3d] rounded-xl p-3 border border-[#2a3a4e]">
          <div className="w-10 h-10 rounded-lg bg-amber-700/50 flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Destaque do Campeonato</p>
            <p className="text-gray-400 text-xs">Copa Regional Sub-15 • 2024</p>
          </div>
        </div>
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-[#2a3a4e]">
        <p className="text-gray-400 text-sm">Trajetória documentada</p>
        <p className="text-orange-400 text-sm font-semibold">12 eventos</p>
      </div>
      <div className="px-5 pb-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-400 bg-[#1e2b3d] border border-[#2a3a4e] rounded-full px-3 py-1.5">
          ☀️ Link Compartilhável
        </span>
      </div>
    </div>
  );
}

/* ─── Athlete card mockup (solution) ─── */
function SolutionProfileCard() {
  return (
    <div className="w-full max-w-xs rounded-2xl bg-[#1a2332] border border-emerald-500/30 shadow-2xl overflow-hidden">
      {/* Browser dots */}
      <div className="flex gap-1.5 p-4 pb-2">
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
      </div>
      <div className="flex flex-col items-center px-6 pt-2 pb-4">
        <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-2xl mb-3">
          MS
        </div>
        <h4 className="text-white font-bold text-lg">Maria Santos</h4>
        <p className="text-emerald-400 text-sm">Atleta de Base • 14 anos</p>
        {/* Skeleton bars */}
        <div className="w-full mt-4 space-y-2">
          <div className="h-2.5 bg-gray-600 rounded-full w-full" />
          <div className="h-2.5 bg-gray-600 rounded-full w-3/4" />
        </div>
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 w-full mt-5">
          {[
            { n: '24', l: 'Jogos' },
            { n: '8', l: 'Pontos' },
            { n: '3', l: 'Títulos' },
          ].map((s) => (
            <div key={s.l} className="bg-emerald-700/30 border border-emerald-500/30 rounded-xl py-3 text-center">
              <p className="text-white font-bold text-lg">{s.n}</p>
              <p className="text-emerald-300 text-xs">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Titulares da Base — apoiadores fundadores (técnicos/influenciadores) ───
   Dados reais, geridos em /carreira/admin/titulares. */
interface Titular {
  id: string;
  nome: string;
  papel: string;
  foto_url: string;
  foto_posicao: string;
}

function TitularCard({ titular }: { titular: Titular }) {
  return (
    <div className="w-64 shrink-0 rounded-2xl bg-[#1a2332] border border-[#2a3a4e] overflow-hidden">
      <img
        src={titular.foto_url}
        alt={titular.nome}
        className="w-full h-72 object-cover"
        style={{ objectPosition: `center ${titular.foto_posicao || 'center'}` }}
        loading="lazy"
      />
      <div className="p-4">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-orange-400 bg-orange-500/10 border border-orange-500/30 rounded-full px-2 py-0.5 mb-2">
          🏆 Titular da Base
        </span>
        <h4 className="text-white font-bold text-sm truncate">{titular.nome}</h4>
        <p className="text-gray-400 text-xs truncate">{titular.papel}</p>
      </div>
    </div>
  );
}

export function TitularesDaBaseSection() {
  const { data: titulares = [] } = useQuery({
    queryKey: ['titulares-base-landing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('carreira_titulares_base' as any)
        .select('id, nome, papel, foto_url, foto_posicao')
        .eq('ativo', true)
        .order('ordem');
      if (error) throw error;
      return (data || []) as unknown as Titular[];
    },
  });

  if (titulares.length === 0) return null;

  const vagasPreenchidas = titulares.length;
  // Só duplica e anima quando há titulares suficientes pra parecer um loop
  // infinito de verdade — com poucos, duplicar só faz parecer repetido.
  const usaMarquee = titulares.length >= 5;
  const linha = usaMarquee ? [...titulares, ...titulares] : titulares;

  return (
    <section className="bg-[#0d1420] py-20 overflow-hidden">
      <div className="container max-w-3xl mx-auto px-4 text-center mb-12">
        <SectionBadge>Titulares da Base</SectionBadge>
        <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-white">
          Os primeiros a acreditar na base.
        </h2>
        <p className="mt-3 text-gray-400">
          Técnicos, professores, scouts e criadores de conteúdo que apoiaram o Carreira ID desde o início.
          Vagas limitadas a 22 — depois disso, essa lista fecha pra sempre.
        </p>
        <p className="mt-3 text-orange-400 font-semibold text-sm">
          {vagasPreenchidas}/22 vagas preenchidas
        </p>
      </div>

      <div className="relative">
        <div
          className={
            usaMarquee
              ? 'flex gap-5 w-max animate-marquee hover:[animation-play-state:paused]'
              : 'flex flex-wrap gap-5 justify-center container mx-auto px-4'
          }
        >
          {linha.map((titular, i) => (
            <TitularCard key={`${titular.id}-${i}`} titular={titular} />
          ))}
        </div>
        {usaMarquee && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#0d1420] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#0d1420] to-transparent" />
          </>
        )}
      </div>
    </section>
  );
}

export function CarreiraLandingV2() {
  const cadastroLink = carreiraPath('/cadastro');
  const loginLink = carreiraPath('/cadastro');

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "CARREIRA ID",
    "applicationCategory": "SportsApplication",
    "operatingSystem": "Web",
    "description": "Identidade esportiva digital para atletas de base. Organize e valorize a trajetória do atleta desde a base.",
    "url": "https://carreiraid.com.br",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "BRL",
      "description": "Perfil gratuito com opção de assinatura premium"
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f18] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-50 bg-[#000000] border-b border-white/5">
        <div className="container flex items-center justify-between h-16 px-4 max-w-6xl mx-auto">
          <Link to={carreiraPath('/')} className="flex items-center">
            <img src={logoCarreira} alt="Carreira ID" className="h-9" />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-400">
            <a href="#problema" className="hover:text-white transition">O Problema</a>
            <a href="#solucao" className="hover:text-white transition">Solução</a>
            <a href="#planos" className="hover:text-white transition">Planos</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
            <a href="/blog" className="hover:text-white transition">Blog</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to={loginLink}
              className="text-gray-300 hover:text-white text-sm font-medium transition"
            >
              Entrar
            </Link>
            <Link
              to={cadastroLink}
              className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              Criar Perfil
            </Link>
          </div>
        </div>
      </header>

      {/* ═══ Hero ═══ */}
      <section className="relative overflow-hidden">
        <img src={heroLandingV2Bg} alt="" className="absolute inset-0 w-full h-full object-cover" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f18]/95 via-[#0a0f18]/80 to-[#0a0f18]/60" />
        <div className="relative container max-w-6xl mx-auto px-4 py-20 md:py-28">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full border border-lime-400/40 text-lime-400 bg-lime-400/10">
              Plataforma Nacional
            </span>
            <h1 className="mt-6 text-4xl sm:text-5xl md:text-[3.5rem] font-extrabold leading-[1.1] tracking-tight">
              O esporte de base brasileiro precisa de{' '}
              <span className="text-orange-400">registro, organização e valorização</span>.
            </h1>
            <p className="mt-6 text-gray-400 text-lg leading-relaxed max-w-lg">
              O Carreira ID é a identidade esportiva digital que organiza e valoriza a trajetória do atleta desde a base.
            </p>
            <p className="mt-2 text-gray-500 text-sm">
              Para atletas independentes ou integrados a escolas que utilizam o{' '}
              <span className="text-emerald-400 font-medium">Atleta ID</span>.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                to={cadastroLink}
                className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition"
              >
                Criar Perfil Gratuito <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#solucao"
                className="inline-flex items-center justify-center gap-2 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-medium px-7 py-3.5 rounded-xl text-base transition"
              >
                <PlayCircle className="w-5 h-5" /> Ver Como Funciona
              </a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Leva menos de 2 minutos para começar.
            </p>
          </div>
          <div className="flex justify-center">
            <img
              src={mockupCelular}
              alt="Carreira ID - Perfil de atleta no celular"
              className="w-full max-w-[280px] md:max-w-[320px] drop-shadow-2xl"
            />
          </div>
        </div>
        </div>
      </section>

      {/* ═══ O Problema ═══ */}
      <section id="problema" className="bg-[#0d1420] py-20">
        <div className="container max-w-6xl mx-auto px-4 text-center">
          <SectionBadge>O Problema</SectionBadge>
          <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold">
            Talento sem registro é talento{' '}
            <span className="text-orange-400">invisível</span>.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
            {[
              { icon: AlertCircle, title: 'Campeonatos perdidos', desc: 'Participações em campeonatos não ficam organizadas ou registradas.' },
              { icon: Frown, title: 'Premiações esquecidas', desc: 'Conquistas e premiações se perdem com o tempo.' },
              { icon: TrendingUp, title: 'Evolução invisível', desc: 'Evoluções técnicas não são documentadas de forma profissional.' },
              { icon: Ban, title: 'Sem identidade', desc: 'Sem histórico estruturado, não há identidade esportiva nem valorização.' },
            ].map((item) => (
              <div key={item.title} className="bg-[#1a2332] border border-[#2a3a4e] rounded-2xl p-6 text-left">
                <div className="w-12 h-12 rounded-xl bg-amber-700/30 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-orange-400" />
                </div>
                <h3 className="text-white font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ A Solução ═══ */}
      <section id="solucao" className="relative overflow-hidden py-20">
        <img src={heroSolucaoBg} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f18]/95 via-[#0a0f18]/85 to-[#0a0f18]/70" />
        <div className="relative container max-w-6xl mx-auto px-4">
          <SectionBadge>A Solução</SectionBadge>
          <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold">
            O que é o <span className="text-orange-400">Carreira ID</span>?
          </h2>
          <div className="grid md:grid-cols-2 gap-12 mt-12 items-center">
            <div>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                Carreira ID é a <strong className="text-white">identidade esportiva digital</strong> do atleta brasileiro.
                Um registro público, organizado e contínuo da trajetória no esporte.
              </p>
              <div className="space-y-3">
                {[
                  { icon: Building2, label: 'Histórico de clubes e equipes' },
                  { icon: Trophy, label: 'Registro de campeonatos e participações' },
                  { icon: TrendingUp, label: 'Linha do tempo da evolução' },
                  { icon: Image, label: 'Fotos e vídeos organizados' },
                  { icon: Link2, label: 'Link profissional compartilhável' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-3 bg-emerald-700/10 border border-emerald-500/20 rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-700/30 flex items-center justify-center shrink-0">
                      <f.icon className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-white text-sm font-medium">{f.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 bg-emerald-700/10 border border-emerald-500/20 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Não é uma rede social.</p>
                <p className="text-emerald-400 text-sm font-semibold">É um currículo esportivo vivo.</p>
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src={mockupPerfilCelular}
                alt="Perfil de atleta no Carreira ID"
                className="w-full max-w-[380px] lg:max-w-[420px] rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Scouting / Busca de Talentos ═══ */}
      <section id="scouting" className="bg-[#060b14] py-20 border-t border-orange-500/10">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="text-center mb-14">
            <SectionBadge>Para Profissionais</SectionBadge>
            <h2 className="mt-6 text-3xl sm:text-4xl font-extrabold text-white">
              Encontre o <span className="text-orange-400">próximo grande talento</span>.
            </h2>
            <p className="mt-4 max-w-2xl mx-auto text-gray-400 leading-relaxed">
              Técnicos, scouts, olheiros e treinadores usam o Carreira ID para descobrir atletas com filtros avançados — por idade, posição, modalidade, cidade e muito mais.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Mockups lado a lado */}
            <div className="flex gap-4 justify-center items-start">
              <img
                src={mockupScoutPerfil}
                alt="Perfil de scout no Carreira ID"
                className="w-[48%] max-w-[260px] rounded-2xl border border-white/10 shadow-2xl shadow-orange-500/5"
              />
              <img
                src={mockupScoutBusca}
                alt="Busca de talentos com filtros no Carreira ID"
                className="w-[48%] max-w-[260px] rounded-2xl border border-white/10 shadow-2xl shadow-orange-500/5"
              />
            </div>

            {/* Texto e features */}
            <div className="flex flex-col justify-center">
              <h3 className="text-2xl font-bold text-white mb-4">
                Ferramentas de busca profissional
              </h3>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Crie seu perfil como profissional do esporte e acesse a maior base de atletas em formação do Brasil. Use filtros inteligentes para encontrar exatamente o perfil que procura.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Search, label: 'Filtros por categoria, posição, modalidade e cidade' },
                  { icon: Users, label: 'Perfis verificados de técnicos, scouts e agentes de clubes' },
                  { icon: Eye, label: 'Acesse o histórico completo e a evolução de cada atleta' },
                  { icon: Target, label: 'Receba destaques de novos talentos na sua região' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                      <item.icon className="w-4 h-4 text-orange-400" />
                    </div>
                    <p className="text-white/90 text-sm leading-relaxed">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8">
                <a
                  href="/cadastro"
                  className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  Criar Perfil Profissional
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Integração Atleta ID ═══ */}
      <section className="bg-gradient-to-br from-emerald-800 to-emerald-900 py-20">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="bg-emerald-700/20 border border-emerald-500/20 rounded-2xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <img src={logoAtletaIdDark} alt="Atleta ID" className="h-14 rounded-lg" />
                <div>
                  <p className="text-emerald-200 text-sm">Integrado com</p>
                  <p className="text-white font-bold text-xl">Atleta ID</p>
                </div>
              </div>
              <ul className="space-y-3">
                {['Registro oficial de participações', 'Frequência documentada', 'Campeonatos organizados', 'Premiações registradas'].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-white text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <SectionBadge>Integração</SectionBadge>
              <h2 className="mt-6 text-3xl sm:text-4xl font-extrabold text-white">
                Integrado ao Atleta ID.
              </h2>
              <p className="mt-4 text-emerald-100/80 leading-relaxed">
                Se o atleta participa de uma escolinha que utiliza o Atleta ID, o histórico pode ser alimentado com dados técnicos registrados pela própria escola.
              </p>
              <div className="mt-6 bg-emerald-700/20 border border-emerald-500/20 rounded-xl p-5">
                <p className="text-white font-semibold">Mais precisão.</p>
                <p className="text-white font-semibold">Mais credibilidade.</p>
                <p className="text-emerald-300 font-semibold">Mais valorização do trabalho da base.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Para Quem ═══ */}
      <section className="bg-[#0a0f18] py-20">
        <div className="container max-w-6xl mx-auto px-4 text-center">
          <SectionBadge>Para Quem</SectionBadge>
          <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold">
            Para quem leva o esporte <span className="text-orange-400">a sério</span>.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
            {[
              { icon: User, title: 'Para Atletas', desc: 'Construa sua identidade esportiva desde cedo e destaque-se com um histórico organizado.', color: 'emerald' },
              { icon: Users, title: 'Para Pais', desc: 'Organize e acompanhe a evolução do seu filho com segurança e praticidade.', color: 'blue' },
              { icon: School, title: 'Para Escolinhas', desc: 'Profissionalize o registro dos atletas e valorize seu trabalho de formação.', color: 'purple' },
              { icon: Briefcase, title: 'Para Clubes', desc: 'Tenha acesso a trajetórias organizadas e estruturadas de potenciais talentos.', color: 'amber' },
            ].map((item) => {
              const colorMap: Record<string, string> = {
                emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
                blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
                purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
                amber: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
              };
              const iconColorMap: Record<string, string> = {
                emerald: 'bg-emerald-500/20 text-emerald-400',
                blue: 'bg-blue-500/20 text-blue-400',
                purple: 'bg-purple-500/20 text-purple-400',
                amber: 'bg-amber-500/20 text-amber-400',
              };
              return (
                <div key={item.title} className={`bg-gradient-to-b ${colorMap[item.color]} border rounded-2xl p-6 text-left`}>
                  <div className={`w-12 h-12 rounded-xl ${iconColorMap[item.color]} flex items-center justify-center mb-4`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-bold mb-2">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ Como Funciona ═══ */}
      <section className="bg-[#0d1420] py-20">
        <div className="container max-w-6xl mx-auto px-4 text-center">
          <SectionBadge>Como Funciona</SectionBadge>
          <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold">
            Simples de começar.
          </h2>
          <p className="mt-2 text-gray-400">Estratégico no longo prazo.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
            {[
              { step: '1', title: 'Crie o perfil', desc: 'Cadastre-se gratuitamente em menos de 2 minutos.' },
              { step: '2', title: 'Registre eventos', desc: 'Adicione clubes, campeonatos e conquistas.' },
              { step: '3', title: 'Organize a linha do tempo', desc: 'Construa a trajetória completa do atleta.' },
              { step: '4', title: 'Compartilhe', desc: 'Envie o link quando surgir oportunidade.' },
            ].map((item, i) => (
              <div key={item.step} className="bg-[#1a2332] border border-[#2a3a4e] rounded-2xl p-6 text-left relative">
                <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold text-lg mb-4">
                  {item.step}
                </div>
                <h3 className="text-white font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                {i < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 w-6 text-emerald-500/50">—</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Competição & Ranking ═══ */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0">
          <img src={torcidaPaisBg} alt="" className="w-full h-full object-cover" loading="lazy" width={1920} height={1024} />
          <div className="absolute inset-0 bg-[#0a0f18]/85" />
        </div>
        <div className="container max-w-6xl mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="flex justify-center order-2 md:order-1">
              <img
                src={mockupRanking}
                alt="Ranking de atletas no Carreira ID"
                className="w-full max-w-[280px] md:max-w-[320px] drop-shadow-2xl rounded-3xl"
                loading="lazy"
                width={512}
                height={960}
              />
            </div>
            <div className="order-1 md:order-2">
              <SectionBadge>Competição</SectionBadge>
              <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold">
                Jogue, convide e <span className="text-orange-400">suba no ranking</span>.
              </h2>
              <p className="mt-6 text-gray-400 text-lg leading-relaxed">
                No Carreira ID, cada ação conta. Complete seu perfil, registre atividades e convide amigos e familiares para fazerem parte da sua <strong className="text-white">torcida</strong>.
              </p>
              <p className="mt-4 text-gray-400 text-base leading-relaxed">
                Aumente sua autoridade e reputação trazendo novos membros para a plataforma — técnicos, professores, treinadores e atletas profissionais. Quanto mais engajado, mais alto você chega no ranking.
              </p>
              <div className="space-y-3 mt-8">
                {[
                  { icon: Trophy, label: 'Ranking nacional entre atletas', color: 'text-amber-400' },
                  { icon: Users, label: 'Convide amigos e familiares como torcida', color: 'text-emerald-400' },
                  { icon: Star, label: 'Ganhe XP e badges por cada conquista', color: 'text-orange-400' },
                  { icon: TrendingUp, label: 'Atraia técnicos e profissionais para sua rede', color: 'text-blue-400' },
                ].map((f) => (
                  <div key={f.label} className="flex items-center gap-3 bg-[#1a2332] border border-[#2a3a4e] rounded-xl p-4">
                    <div className="w-10 h-10 rounded-lg bg-[#2a3a4e] flex items-center justify-center shrink-0">
                      <f.icon className={`w-5 h-5 ${f.color}`} />
                    </div>
                    <p className="text-white text-sm font-medium">{f.label}</p>
                  </div>
                ))}
              </div>
              <Link
                to={cadastroLink}
                className="mt-8 inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition"
              >
                Entrar na Competição <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Planos ═══ */}
      <section id="planos" className="bg-[#0a0f18] py-20">
        <div className="container max-w-5xl mx-auto px-4 text-center">
          <SectionBadge>Planos</SectionBadge>
          <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold">
            Comece gratuito. <span className="text-orange-400">Evolua quando quiser</span>.
          </h2>
          <div className="grid md:grid-cols-2 gap-5 mt-14 max-w-3xl mx-auto">
            {/* Base */}
            <div className="bg-[#1a2332] border border-[#2a3a4e] rounded-2xl p-7 text-left flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚽</span>
                <h3 className="text-white font-bold text-xl">Base</h3>
              </div>
              <p className="text-gray-400 text-sm mt-1">Comece sua jornada esportiva</p>
              <p className="mt-4">
                <span className="text-3xl font-extrabold text-white">Grátis</span>
              </p>
              <div className="border-t border-white/10 my-4" />
              <ul className="space-y-2.5 flex-1">
                {[
                  'Perfil público do atleta (foto e informações básicas)',
                  'Histórico de carreira — 1 registro por mês',
                  'Registro da Jornada — 1 por mês',
                  'Publicações no feed (texto e fotos) — 1 por dia',
                  'Conexões na plataforma',
                  'Perfil visível para scouts e clubes',
                  'Participação na comunidade',
                  'Liga de Conexões do Atleta',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to={cadastroLink}
                className="mt-6 block text-center border border-gray-500/40 text-gray-300 hover:bg-white/5 font-semibold py-3 rounded-xl transition"
              >
                Começar Grátis
              </Link>
            </div>

            {/* Premium */}
            <div className="bg-gradient-to-b from-purple-900/40 to-[#1a2332] border border-purple-500/30 rounded-2xl p-7 text-left flex flex-col relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <span className="text-[10px] font-bold bg-purple-500 text-white px-3 py-1 rounded-full uppercase tracking-wider">7 dias grátis</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">👑</span>
                <h3 className="text-purple-400 font-bold text-xl">Premium</h3>
              </div>
              <p className="text-gray-400 text-sm mt-1">Acesso completo à plataforma</p>
              <p className="mt-4">
                <span className="text-sm text-gray-400">R$</span>
                <span className="text-3xl font-extrabold text-white mx-0.5">12,00</span>
                <span className="text-sm text-gray-400">/mês</span>
              </p>
              <p className="text-xs text-purple-300 mt-1">Experimente 7 dias grátis — sem cartão</p>
              <div className="border-t border-purple-500/20 my-4" />
              <ul className="space-y-2.5 flex-1">
                {[
                  'Tudo do Base',
                  'Jornada Esportiva ilimitada',
                  'Vídeos de até 1 minuto',
                  'Vídeos do YouTube (highlights)',
                  'Prioridade nas buscas',
                  'Selo Premium',
                  'Destaque em listagens',
                  'Estatísticas avançadas',
                  'Ver quem visualizou o perfil',
                  'Acesso antecipado a novos recursos',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to={`${cadastroLink}?plano=premium`}
                className="mt-6 block text-center bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition"
              >
                Começar 7 dias grátis
              </Link>
            </div>
          </div>
          <p className="mt-8 text-xs text-gray-500">
            Cancele quando quiser • Sem taxa de cancelamento
          </p>
        </div>
      </section>

      {/* ═══ Segurança ═══ */}
      <section className="bg-[#0d1420] py-20">
        <div className="container max-w-6xl mx-auto px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <SectionBadge>Segurança</SectionBadge>
          <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extrabold">
            Visibilidade com{' '}
            <span className="text-orange-400">responsabilidade</span>.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-14 max-w-4xl mx-auto">
            {[
              { icon: Lock, title: 'Controle Parental', desc: 'Perfis de menores são controlados pelos responsáveis.' },
              { icon: EyeOff, title: 'Dados Protegidos', desc: 'Informações sensíveis não são públicas automaticamente.' },
              { icon: Settings, title: 'Você Decide', desc: 'Você decide o que aparece e quem pode ver.' },
            ].map((item) => (
              <div key={item.title} className="bg-[#1a2332] border border-[#2a3a4e] rounded-2xl p-6 text-left">
                <div className="w-12 h-12 rounded-xl bg-emerald-700/30 flex items-center justify-center mb-4">
                  <item.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-white font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA Final ═══ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1420] via-emerald-900/30 to-[#0d1420]" />
        <div className="container max-w-4xl mx-auto px-4 text-center relative">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight">
            O talento brasileiro não pode depender apenas da{' '}
            <span className="text-emerald-400">sorte</span> para ser visto.
          </h2>
          <p className="mt-6 text-gray-300 text-xl font-semibold">
            Registre. Organize. <span className="text-emerald-400">Valorize.</span>
          </p>
          <Link
            to={cadastroLink}
            className="mt-8 inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold px-10 py-4 rounded-xl text-lg transition shadow-lg shadow-orange-500/20"
          >
            Criar Perfil Gratuito <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Gratuito para sempre. Sem cartão de crédito.
          </p>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="bg-[#0a0f18] py-20">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <SectionBadge>Dúvidas Frequentes</SectionBadge>
            <h2 className="mt-6 text-3xl sm:text-4xl font-extrabold">
              Perguntas <span className="text-orange-400">Frequentes</span>
            </h2>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {[
              {
                q: 'O Carreira ID é gratuito?',
                a: 'Sim! O plano Base é gratuito para sempre. Você pode criar seu perfil público, fazer publicações, conectar-se a outros atletas e compartilhar seu link. Os planos Competidor (R$17,90/mês) e Elite (R$29,90/mês) oferecem recursos avançados.',
              },
              {
                q: 'Quem pode criar um perfil?',
                a: 'Qualquer pessoa ligada ao esporte: atletas, pais/responsáveis, profissionais de educação física e escolinhas esportivas. Perfis de menores de idade são controlados exclusivamente pelos responsáveis.',
              },
              {
                q: 'Como funciona para atletas menores de idade?',
                a: 'O responsável legal cria e gerencia o perfil do atleta menor de idade. Ele define o que pode ou não ser exibido publicamente, garantindo total controle parental sobre as informações.',
              },
              {
                q: 'O que é a Liga e como funciona o ranking?',
                a: 'A Liga é o sistema de gamificação do Carreira ID. Cada ação que você realiza — como completar o perfil, fazer publicações, registrar atividades e convidar amigos — gera pontos de XP. Quanto mais pontos, mais alto você sobe no ranking nacional entre atletas.',
              },
              {
                q: 'Como ganho pontos e XP na Liga?',
                a: 'Você ganha XP ao completar ações como: preencher seu perfil, publicar posts, adicionar experiências esportivas, conectar-se a outros atletas e convidar amigos e familiares para a plataforma. Cada ação tem um valor de pontos diferente, que pode ser consultado na Tabela de Pontos.',
              },
              {
                q: 'O que são os níveis da Liga (Cria, Promessa, Craque...)?',
                a: 'São faixas de progressão baseadas no seu XP acumulado. Você começa como "Cria" e pode evoluir para níveis como Promessa, Destaque e Craque. Cada nível traz reconhecimento e visibilidade no ranking.',
              },
              {
                q: 'O que é a integração com o Atleta ID?',
                a: 'O Atleta ID é a plataforma de gestão para escolinhas esportivas. Se o atleta está matriculado em uma escolinha que usa o Atleta ID, dados como frequência, participações em campeonatos e premiações podem ser importados automaticamente para o Carreira ID.',
              },
              {
                q: 'Meus dados ficam seguros?',
                a: 'Sim. Informações sensíveis nunca são exibidas publicamente. Você tem controle total sobre o que aparece no seu perfil. Utilizamos criptografia e práticas modernas de segurança para proteger seus dados.',
              },
              {
                q: 'Posso cancelar o plano a qualquer momento?',
                a: 'Sim, os planos Competidor e Elite podem ser cancelados a qualquer momento sem multa. Seu perfil continua ativo no plano Base gratuito, preservando todas as suas publicações.',
              },
              {
                q: 'Como compartilho meu perfil?',
                a: 'Cada perfil tem um link único (ex: carreiraid.com.br/seu-nome). Você pode copiar e enviar por WhatsApp, redes sociais, e-mail ou qualquer outro meio.',
              },
            ].map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="bg-[#1a2332] border border-[#2a3a4e] rounded-xl px-5 data-[state=open]:border-orange-500/40"
              >
                <AccordionTrigger className="text-white text-left font-medium hover:no-underline py-5">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-gray-400 leading-relaxed pb-5">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ═══ Titulares da Base — TESTE: fotos e nomes abaixo são só placeholder,
          precisam ser trocados por apoiadores reais antes de publicar de vez ═══ */}
      <TitularesDaBaseSection />

      {/* ═══ Comunidade WhatsApp ═══ */}
      <section className="bg-gradient-to-br from-emerald-800 to-emerald-900 py-16">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="bg-[#0a0f18]/40 border border-emerald-500/20 rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shrink-0">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Entre para a comunidade Carreira ID no WhatsApp
              </h2>
              <p className="mt-2 text-emerald-100/80">
                Dicas, novidades e troca com outros pais e mães de atletas de base — direto no seu WhatsApp.
              </p>
            </div>
            <a
              href="https://chat.whatsapp.com/HowU46FP9KfE5da6g9PORV"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-full transition-colors whitespace-nowrap"
            >
              Entrar na comunidade
            </a>
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-white/5 py-8 bg-[#0a0f18]">
        <div className="container max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={logoCarreira} alt="Carreira ID" className="h-8" />
          <nav className="flex items-center gap-6 text-sm text-gray-500">
            <a href="/termos-de-uso" className="hover:text-white transition">Termos de Uso</a>
            <a href="/politica-de-privacidade" className="hover:text-white transition">Privacidade</a>
            <a href={carreiraPath('/contato')} className="hover:text-white transition">Contato</a>
          </nav>
          <p className="text-xs text-gray-600">© 2024 Carreira ID. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* ═══ WhatsApp Flutuante ═══ */}
      <a
        href="https://wa.me/5521969622045?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20o%20Carreira%20ID!"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30 transition-transform hover:scale-110"
        aria-label="Fale conosco no WhatsApp"
      >
        <MessageCircle className="w-7 h-7 text-white" />
      </a>
    </div>
  );
}
