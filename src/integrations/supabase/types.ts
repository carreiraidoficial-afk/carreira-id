export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      atividades_externas: {
        Row: {
          carga_horaria_horas: number | null
          created_at: string
          credibilidade_status: Database["public"]["Enums"]["atividade_credibilidade_status"]
          criado_por: string
          crianca_id: string
          data: string
          data_fim: string | null
          duracao_minutos: number
          evidencia_tipo: string | null
          evidencia_url: string | null
          fotos_urls: string[] | null
          frequencia_semanal: number | null
          id: string
          local_atividade: string
          local_id: string | null
          metodologia: string | null
          objetivos: string[] | null
          observacoes: string | null
          organizador: string | null
          origem: string
          profissionais_envolvidos: string[] | null
          profissional_id: string | null
          profissional_instituicao: string
          slug_publico: string | null
          tipo: Database["public"]["Enums"]["atividade_externa_tipo"]
          tipo_outro_descricao: string | null
          tornar_publico: boolean | null
          torneio_abrangencia:
            | Database["public"]["Enums"]["torneio_abrangencia"]
            | null
          torneio_id: string | null
          torneio_nome: string | null
          updated_at: string
          validado_em: string | null
          validado_por: string | null
          visibilidade: string
        }
        Insert: {
          carga_horaria_horas?: number | null
          created_at?: string
          credibilidade_status?: Database["public"]["Enums"]["atividade_credibilidade_status"]
          criado_por: string
          crianca_id: string
          data: string
          data_fim?: string | null
          duracao_minutos: number
          evidencia_tipo?: string | null
          evidencia_url?: string | null
          fotos_urls?: string[] | null
          frequencia_semanal?: number | null
          id?: string
          local_atividade: string
          local_id?: string | null
          metodologia?: string | null
          objetivos?: string[] | null
          observacoes?: string | null
          organizador?: string | null
          origem?: string
          profissionais_envolvidos?: string[] | null
          profissional_id?: string | null
          profissional_instituicao: string
          slug_publico?: string | null
          tipo: Database["public"]["Enums"]["atividade_externa_tipo"]
          tipo_outro_descricao?: string | null
          tornar_publico?: boolean | null
          torneio_abrangencia?:
            | Database["public"]["Enums"]["torneio_abrangencia"]
            | null
          torneio_id?: string | null
          torneio_nome?: string | null
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
          visibilidade?: string
        }
        Update: {
          carga_horaria_horas?: number | null
          created_at?: string
          credibilidade_status?: Database["public"]["Enums"]["atividade_credibilidade_status"]
          criado_por?: string
          crianca_id?: string
          data?: string
          data_fim?: string | null
          duracao_minutos?: number
          evidencia_tipo?: string | null
          evidencia_url?: string | null
          fotos_urls?: string[] | null
          frequencia_semanal?: number | null
          id?: string
          local_atividade?: string
          local_id?: string | null
          metodologia?: string | null
          objetivos?: string[] | null
          observacoes?: string | null
          organizador?: string | null
          origem?: string
          profissionais_envolvidos?: string[] | null
          profissional_id?: string | null
          profissional_instituicao?: string
          slug_publico?: string | null
          tipo?: Database["public"]["Enums"]["atividade_externa_tipo"]
          tipo_outro_descricao?: string | null
          tornar_publico?: boolean | null
          torneio_abrangencia?:
            | Database["public"]["Enums"]["torneio_abrangencia"]
            | null
          torneio_id?: string | null
          torneio_nome?: string | null
          updated_at?: string
          validado_em?: string | null
          validado_por?: string | null
          visibilidade?: string
        }
        Relationships: []
      }
      atividades_externas_whitelist: {
        Row: {
          ativo: boolean
          created_at: string
          expires_at: string | null
          id: string
          motivo: string
          tipo_isencao: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          motivo?: string
          tipo_isencao?: string | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          motivo?: string
          tipo_isencao?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      atleta_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_perfil_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_perfil_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_perfil_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "atleta_follows_following_perfil_id_fkey"
            columns: ["following_perfil_id"]
            isOneToOne: false
            referencedRelation: "perfil_atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_words: {
        Row: {
          category: string
          created_at: string
          id: string
          word: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          word: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          word?: string
        }
        Relationships: []
      }
      carreira_asaas_jobs: {
        Row: {
          created_at: string
          erro: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          resultado: Json | null
          status: string
          tipo: string
        }
        Insert: {
          created_at?: string
          erro?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          resultado?: Json | null
          status: string
          tipo: string
        }
        Update: {
          created_at?: string
          erro?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          resultado?: Json | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      carreira_assinaturas: {
        Row: {
          cancelada_em: string | null
          card_brand: string | null
          card_last4: string | null
          created_at: string
          crianca_id: string
          expira_em: string | null
          familia_id: string | null
          gateway: string | null
          gateway_card_token: string | null
          gateway_subscription_id: string | null
          id: string
          inicio_em: string
          lembrete_trial_2d_em: string | null
          lembrete_trial_expirado_em: string | null
          metodo_pagamento: string | null
          observacoes: string | null
          plano: string
          status: string
          trial_termina_em: string | null
          updated_at: string
          user_id: string
          valor: number | null
        }
        Insert: {
          cancelada_em?: string | null
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string
          crianca_id: string
          expira_em?: string | null
          familia_id?: string | null
          gateway?: string | null
          gateway_card_token?: string | null
          gateway_subscription_id?: string | null
          id?: string
          inicio_em?: string
          lembrete_trial_2d_em?: string | null
          lembrete_trial_expirado_em?: string | null
          metodo_pagamento?: string | null
          observacoes?: string | null
          plano?: string
          status?: string
          trial_termina_em?: string | null
          updated_at?: string
          user_id: string
          valor?: number | null
        }
        Update: {
          cancelada_em?: string | null
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string
          crianca_id?: string
          expira_em?: string | null
          familia_id?: string | null
          gateway?: string | null
          gateway_card_token?: string | null
          gateway_subscription_id?: string | null
          id?: string
          inicio_em?: string
          lembrete_trial_2d_em?: string | null
          lembrete_trial_expirado_em?: string | null
          metodo_pagamento?: string | null
          observacoes?: string | null
          plano?: string
          status?: string
          trial_termina_em?: string | null
          updated_at?: string
          user_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "carreira_assinaturas_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "carreira_assinaturas_familia"
            referencedColumns: ["id"]
          },
        ]
      }
      carreira_assinaturas_familia: {
        Row: {
          cancelada_em: string | null
          created_at: string
          expira_em: string | null
          gateway: string | null
          gateway_subscription_id: string | null
          id: string
          inicio_em: string | null
          metodo_pagamento: string | null
          status: string
          updated_at: string
          user_id: string
          valor: number | null
        }
        Insert: {
          cancelada_em?: string | null
          created_at?: string
          expira_em?: string | null
          gateway?: string | null
          gateway_subscription_id?: string | null
          id?: string
          inicio_em?: string | null
          metodo_pagamento?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor?: number | null
        }
        Update: {
          cancelada_em?: string | null
          created_at?: string
          expira_em?: string | null
          gateway?: string | null
          gateway_subscription_id?: string | null
          id?: string
          inicio_em?: string | null
          metodo_pagamento?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor?: number | null
        }
        Relationships: []
      }
      carreira_cadastro_bancario: {
        Row: {
          agencia: string
          asaas_account_id: string | null
          asaas_api_key: string | null
          asaas_atualizado_em: string | null
          asaas_enviado_em: string | null
          asaas_status: string | null
          asaas_status_detail: Json | null
          asaas_wallet_id: string | null
          bairro: string | null
          banco: string
          cep: string | null
          cidade: string | null
          complemento: string | null
          conta: string
          cpf_cnpj: string | null
          created_at: string
          data_nascimento: string | null
          email: string
          estado: string | null
          id: string
          income_value: number | null
          nome: string
          numero: string | null
          rua: string | null
          telefone: string | null
          tipo_conta: string
          tipo_pessoa: string
          updated_at: string
        }
        Insert: {
          agencia: string
          asaas_account_id?: string | null
          asaas_api_key?: string | null
          asaas_atualizado_em?: string | null
          asaas_enviado_em?: string | null
          asaas_status?: string | null
          asaas_status_detail?: Json | null
          asaas_wallet_id?: string | null
          bairro?: string | null
          banco: string
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          conta: string
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email: string
          estado?: string | null
          id?: string
          income_value?: number | null
          nome: string
          numero?: string | null
          rua?: string | null
          telefone?: string | null
          tipo_conta: string
          tipo_pessoa: string
          updated_at?: string
        }
        Update: {
          agencia?: string
          asaas_account_id?: string | null
          asaas_api_key?: string | null
          asaas_atualizado_em?: string | null
          asaas_enviado_em?: string | null
          asaas_status?: string | null
          asaas_status_detail?: Json | null
          asaas_wallet_id?: string | null
          bairro?: string | null
          banco?: string
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string
          cpf_cnpj?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string
          estado?: string | null
          id?: string
          income_value?: number | null
          nome?: string
          numero?: string | null
          rua?: string | null
          telefone?: string | null
          tipo_conta?: string
          tipo_pessoa?: string
          updated_at?: string
        }
        Relationships: []
      }
      carreira_campeonato_premiacoes: {
        Row: {
          campeonato_id: string
          created_at: string
          criado_por: string
          crianca_id: string
          id: string
          jogo_id: string | null
          tipo_premiacao: string
          titulo: string | null
          updated_at: string
        }
        Insert: {
          campeonato_id: string
          created_at?: string
          criado_por: string
          crianca_id: string
          id?: string
          jogo_id?: string | null
          tipo_premiacao: string
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          campeonato_id?: string
          created_at?: string
          criado_por?: string
          crianca_id?: string
          id?: string
          jogo_id?: string | null
          tipo_premiacao?: string
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carreira_campeonato_premiacoes_campeonato_id_fkey"
            columns: ["campeonato_id"]
            isOneToOne: false
            referencedRelation: "carreira_campeonatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carreira_campeonato_premiacoes_jogo_id_fkey"
            columns: ["jogo_id"]
            isOneToOne: false
            referencedRelation: "carreira_jogos"
            referencedColumns: ["id"]
          },
        ]
      }
      carreira_campeonatos: {
        Row: {
          abrangencia:
            | Database["public"]["Enums"]["torneio_abrangencia_novo"]
            | null
          categoria: string | null
          created_at: string
          criado_por: string
          crianca_id: string
          data_final: string | null
          data_inicio: string
          id: string
          logo_url: string | null
          modalidade: string
          nome: string
          nome_time: string | null
          organizador: string | null
          posicao_final: string | null
          updated_at: string
        }
        Insert: {
          abrangencia?:
            | Database["public"]["Enums"]["torneio_abrangencia_novo"]
            | null
          categoria?: string | null
          created_at?: string
          criado_por: string
          crianca_id: string
          data_final?: string | null
          data_inicio: string
          id?: string
          logo_url?: string | null
          modalidade?: string
          nome: string
          nome_time?: string | null
          organizador?: string | null
          posicao_final?: string | null
          updated_at?: string
        }
        Update: {
          abrangencia?:
            | Database["public"]["Enums"]["torneio_abrangencia_novo"]
            | null
          categoria?: string | null
          created_at?: string
          criado_por?: string
          crianca_id?: string
          data_final?: string | null
          data_inicio?: string
          id?: string
          logo_url?: string | null
          modalidade?: string
          nome?: string
          nome_time?: string | null
          organizador?: string | null
          posicao_final?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      carreira_comunicados: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          criado_por: string
          destinatario_filtro: Json | null
          destinatario_tipo: string
          enviar_push: boolean | null
          id: string
          mensagem: string
          tipo: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          criado_por: string
          destinatario_filtro?: Json | null
          destinatario_tipo?: string
          enviar_push?: boolean | null
          id?: string
          mensagem: string
          tipo?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          criado_por?: string
          destinatario_filtro?: Json | null
          destinatario_tipo?: string
          enviar_push?: boolean | null
          id?: string
          mensagem?: string
          tipo?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      carreira_comunicados_leituras: {
        Row: {
          comunicado_id: string
          id: string
          lido_em: string | null
          user_id: string
        }
        Insert: {
          comunicado_id: string
          id?: string
          lido_em?: string | null
          user_id: string
        }
        Update: {
          comunicado_id?: string
          id?: string
          lido_em?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carreira_comunicados_leituras_comunicado_id_fkey"
            columns: ["comunicado_id"]
            isOneToOne: false
            referencedRelation: "carreira_comunicados"
            referencedColumns: ["id"]
          },
        ]
      }
      carreira_documentos: {
        Row: {
          asaas_document_id: string | null
          asaas_status: string | null
          created_at: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number
          tipo_documento: string
        }
        Insert: {
          asaas_document_id?: string | null
          asaas_status?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          storage_path: string
          tamanho_bytes: number
          tipo_documento: string
        }
        Update: {
          asaas_document_id?: string | null
          asaas_status?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          storage_path?: string
          tamanho_bytes?: number
          tipo_documento?: string
        }
        Relationships: []
      }
      carreira_experiencias: {
        Row: {
          atual: boolean
          bairro: string | null
          categoria_instituicao: string | null
          cidade: string | null
          created_at: string
          crianca_id: string
          data_fim: string | null
          data_inicio: string
          escolinha_id: string | null
          estado: string | null
          id: string
          nome_escola: string
          observacoes: string | null
          posicao_jogada: string | null
          tipo_instituicao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          atual?: boolean
          bairro?: string | null
          categoria_instituicao?: string | null
          cidade?: string | null
          created_at?: string
          crianca_id: string
          data_fim?: string | null
          data_inicio: string
          escolinha_id?: string | null
          estado?: string | null
          id?: string
          nome_escola: string
          observacoes?: string | null
          posicao_jogada?: string | null
          tipo_instituicao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          atual?: boolean
          bairro?: string | null
          categoria_instituicao?: string | null
          cidade?: string | null
          created_at?: string
          crianca_id?: string
          data_fim?: string | null
          data_inicio?: string
          escolinha_id?: string | null
          estado?: string | null
          id?: string
          nome_escola?: string
          observacoes?: string | null
          posicao_jogada?: string | null
          tipo_instituicao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      carreira_jogo_midias: {
        Row: {
          created_at: string
          id: string
          jogo_id: string
          ordem: number | null
          tipo_midia: Database["public"]["Enums"]["tipo_midia_enum"]
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          jogo_id: string
          ordem?: number | null
          tipo_midia: Database["public"]["Enums"]["tipo_midia_enum"]
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          jogo_id?: string
          ordem?: number | null
          tipo_midia?: Database["public"]["Enums"]["tipo_midia_enum"]
          url?: string
        }
        Relationships: []
      }
      carreira_jogos: {
        Row: {
          assistencias: number | null
          campeonato_id: string | null
          created_at: string
          criado_por: string
          crianca_id: string
          data_jogo: string
          defesas_importantes: number | null
          defesas_realizadas: number | null
          erros_cometidos: number | null
          erros_recepcao: number | null
          fase_campeonato: string | null
          gols_marcados: number | null
          gols_sofridos: number | null
          id: string
          local: string | null
          minutos_jogados: number | null
          modalidade: string
          observacoes: string | null
          penaltis_defendidos: number | null
          penaltis_defendidos_disputa: number | null
          penaltis_gol_lado_correto: number | null
          penaltis_gol_lado_errado: number | null
          placar_adversario: number | null
          placar_penaltis_adversario: number | null
          placar_penaltis_time: number | null
          placar_time_atleta: number | null
          pontos_ataque: number | null
          pontos_bloqueio: number | null
          pontos_saque: number | null
          posicao_jogo: string | null
          recepcoes_realizadas: number | null
          sets_detalhe: Json | null
          teve_disputa_penaltis: boolean | null
          time_adversario: string
          time_atleta: string | null
          tipo_jogo: Database["public"]["Enums"]["tipo_jogo_enum"]
          updated_at: string
        }
        Insert: {
          assistencias?: number | null
          campeonato_id?: string | null
          created_at?: string
          criado_por: string
          crianca_id: string
          data_jogo: string
          defesas_importantes?: number | null
          defesas_realizadas?: number | null
          erros_cometidos?: number | null
          erros_recepcao?: number | null
          fase_campeonato?: string | null
          gols_marcados?: number | null
          gols_sofridos?: number | null
          id?: string
          local?: string | null
          minutos_jogados?: number | null
          modalidade?: string
          observacoes?: string | null
          penaltis_defendidos?: number | null
          penaltis_defendidos_disputa?: number | null
          penaltis_gol_lado_correto?: number | null
          penaltis_gol_lado_errado?: number | null
          placar_adversario?: number | null
          placar_penaltis_adversario?: number | null
          placar_penaltis_time?: number | null
          placar_time_atleta?: number | null
          pontos_ataque?: number | null
          pontos_bloqueio?: number | null
          pontos_saque?: number | null
          posicao_jogo?: string | null
          recepcoes_realizadas?: number | null
          sets_detalhe?: Json | null
          teve_disputa_penaltis?: boolean | null
          time_adversario: string
          time_atleta?: string | null
          tipo_jogo?: Database["public"]["Enums"]["tipo_jogo_enum"]
          updated_at?: string
        }
        Update: {
          assistencias?: number | null
          campeonato_id?: string | null
          created_at?: string
          criado_por?: string
          crianca_id?: string
          data_jogo?: string
          defesas_importantes?: number | null
          defesas_realizadas?: number | null
          erros_cometidos?: number | null
          erros_recepcao?: number | null
          fase_campeonato?: string | null
          gols_marcados?: number | null
          gols_sofridos?: number | null
          id?: string
          local?: string | null
          minutos_jogados?: number | null
          modalidade?: string
          observacoes?: string | null
          penaltis_defendidos?: number | null
          penaltis_defendidos_disputa?: number | null
          penaltis_gol_lado_correto?: number | null
          penaltis_gol_lado_errado?: number | null
          placar_adversario?: number | null
          placar_penaltis_adversario?: number | null
          placar_penaltis_time?: number | null
          placar_time_atleta?: number | null
          pontos_ataque?: number | null
          pontos_bloqueio?: number | null
          pontos_saque?: number | null
          posicao_jogo?: string | null
          recepcoes_realizadas?: number | null
          sets_detalhe?: Json | null
          teve_disputa_penaltis?: boolean | null
          time_adversario?: string
          time_atleta?: string | null
          tipo_jogo?: Database["public"]["Enums"]["tipo_jogo_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      carreira_planos_config: {
        Row: {
          ativo: boolean
          carreira_mes: number
          cor: string
          created_at: string
          curriculo_pdf: boolean
          descricao: string
          destaque_listagem: boolean
          icone: string
          id: string
          jornada_mes: number
          liga_conexoes: boolean
          nome: string
          plano: string
          posts_dia: number
          preco: number
          prioridade_busca: boolean
          selo_elite: boolean
          stats_avancadas: boolean
          updated_at: string
          ver_views: boolean
          video_max_mb: number
          video_seg: number
          youtube: boolean
        }
        Insert: {
          ativo?: boolean
          carreira_mes?: number
          cor?: string
          created_at?: string
          curriculo_pdf?: boolean
          descricao?: string
          destaque_listagem?: boolean
          icone?: string
          id?: string
          jornada_mes?: number
          liga_conexoes?: boolean
          nome: string
          plano: string
          posts_dia?: number
          preco?: number
          prioridade_busca?: boolean
          selo_elite?: boolean
          stats_avancadas?: boolean
          updated_at?: string
          ver_views?: boolean
          video_max_mb?: number
          video_seg?: number
          youtube?: boolean
        }
        Update: {
          ativo?: boolean
          carreira_mes?: number
          cor?: string
          created_at?: string
          curriculo_pdf?: boolean
          descricao?: string
          destaque_listagem?: boolean
          icone?: string
          id?: string
          jornada_mes?: number
          liga_conexoes?: boolean
          nome?: string
          plano?: string
          posts_dia?: number
          preco?: number
          prioridade_busca?: boolean
          selo_elite?: boolean
          stats_avancadas?: boolean
          updated_at?: string
          ver_views?: boolean
          video_max_mb?: number
          video_seg?: number
          youtube?: boolean
        }
        Relationships: []
      }
      carreira_push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      carreira_tutoriais: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          ordem: number
          slides: Json
          target_user_ids: string[] | null
          tipo_perfil: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          slides?: Json
          target_user_ids?: string[] | null
          tipo_perfil?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          slides?: Json
          target_user_ids?: string[] | null
          tipo_perfil?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      carreira_tutorial_leituras: {
        Row: {
          id: string
          tutorial_id: string
          user_id: string
          visto_em: string
        }
        Insert: {
          id?: string
          tutorial_id: string
          user_id: string
          visto_em?: string
        }
        Update: {
          id?: string
          tutorial_id?: string
          user_id?: string
          visto_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "carreira_tutorial_leituras_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "carreira_tutoriais"
            referencedColumns: ["id"]
          },
        ]
      }
      conta_deletada_backup: {
        Row: {
          dados_conexoes: Json | null
          dados_experiencias: Json | null
          dados_perfil_atleta: Json | null
          dados_perfis_rede: Json | null
          dados_posts: Json | null
          deletado_em: string
          email: string | null
          expira_em: string
          id: string
          motivo: string | null
          nome: string | null
          recuperado: boolean
          recuperado_em: string | null
          tipo_perfil: string | null
          user_id: string
        }
        Insert: {
          dados_conexoes?: Json | null
          dados_experiencias?: Json | null
          dados_perfil_atleta?: Json | null
          dados_perfis_rede?: Json | null
          dados_posts?: Json | null
          deletado_em?: string
          email?: string | null
          expira_em?: string
          id?: string
          motivo?: string | null
          nome?: string | null
          recuperado?: boolean
          recuperado_em?: string | null
          tipo_perfil?: string | null
          user_id: string
        }
        Update: {
          dados_conexoes?: Json | null
          dados_experiencias?: Json | null
          dados_perfil_atleta?: Json | null
          dados_perfis_rede?: Json | null
          dados_posts?: Json | null
          deletado_em?: string
          email?: string | null
          expira_em?: string
          id?: string
          motivo?: string | null
          nome?: string | null
          recuperado?: boolean
          recuperado_em?: string | null
          tipo_perfil?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crianca_escolinha: {
        Row: {
          ativo: boolean
          created_at: string
          crianca_id: string
          data_fim: string | null
          data_inicio: string
          escolinha_id: string
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          crianca_id: string
          data_fim?: string | null
          data_inicio?: string
          escolinha_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          crianca_id?: string
          data_fim?: string | null
          data_inicio?: string
          escolinha_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      criancas: {
        Row: {
          ativo: boolean
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      desafio_progresso: {
        Row: {
          completado: boolean
          completado_em: string | null
          created_at: string
          desafio_id: string
          id: string
          progresso_atual: number
          user_id: string
        }
        Insert: {
          completado?: boolean
          completado_em?: string | null
          created_at?: string
          desafio_id: string
          id?: string
          progresso_atual?: number
          user_id: string
        }
        Update: {
          completado?: boolean
          completado_em?: string | null
          created_at?: string
          desafio_id?: string
          id?: string
          progresso_atual?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "desafio_progresso_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafios_convite"
            referencedColumns: ["id"]
          },
        ]
      }
      desafios_convite: {
        Row: {
          ativo: boolean
          badge_premio_cor: string | null
          badge_premio_icone: string | null
          badge_premio_nome: string | null
          badge_premio_tipo: string | null
          cor: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          icone: string | null
          id: string
          pontos_bonus: number
          quantidade_meta: number
          tipo_perfil_alvo: string[] | null
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          badge_premio_cor?: string | null
          badge_premio_icone?: string | null
          badge_premio_nome?: string | null
          badge_premio_tipo?: string | null
          cor?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          pontos_bonus?: number
          quantidade_meta?: number
          tipo_perfil_alvo?: string[] | null
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          badge_premio_cor?: string | null
          badge_premio_icone?: string | null
          badge_premio_nome?: string | null
          badge_premio_tipo?: string | null
          cor?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          pontos_bonus?: number
          quantidade_meta?: number
          tipo_perfil_alvo?: string[] | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      gamificacao_acoes_config: {
        Row: {
          acao_tipo: string
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          descricao: string | null
          icone: string | null
          id: string
          label: string
          pontos: number
          updated_at: string | null
        }
        Insert: {
          acao_tipo: string
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          label: string
          pontos?: number
          updated_at?: string | null
        }
        Update: {
          acao_tipo?: string
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          descricao?: string | null
          icone?: string | null
          id?: string
          label?: string
          pontos?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      gamificacao_niveis: {
        Row: {
          cor: string
          created_at: string
          icone: string
          id: string
          nivel: number
          nome: string
          updated_at: string
          xp_minimo: number
        }
        Insert: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nivel: number
          nome: string
          updated_at?: string
          xp_minimo?: number
        }
        Update: {
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nivel?: number
          nome?: string
          updated_at?: string
          xp_minimo?: number
        }
        Relationships: []
      }
      gamificacao_pontos_tipo: {
        Row: {
          created_at: string
          icone: string | null
          id: string
          label: string
          pontos: number
          tipo_perfil: string
        }
        Insert: {
          created_at?: string
          icone?: string | null
          id?: string
          label: string
          pontos?: number
          tipo_perfil: string
        }
        Update: {
          created_at?: string
          icone?: string | null
          id?: string
          label?: string
          pontos?: number
          tipo_perfil?: string
        }
        Relationships: []
      }
      moderation_logs: {
        Row: {
          content: string
          content_id: string | null
          content_type: string
          created_at: string
          id: string
          justificativa: string | null
          level: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          content: string
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          justificativa?: string | null
          level?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          content?: string
          content_id?: string | null
          content_type?: string
          created_at?: string
          id?: string
          justificativa?: string | null
          level?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      peneira_convites: {
        Row: {
          atleta_perfil_id: string
          atleta_user_id: string
          created_at: string
          id: string
          peneira_id: string
          respondido_em: string | null
          status: string
          updated_at: string
        }
        Insert: {
          atleta_perfil_id: string
          atleta_user_id: string
          created_at?: string
          id?: string
          peneira_id: string
          respondido_em?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          atleta_perfil_id?: string
          atleta_user_id?: string
          created_at?: string
          id?: string
          peneira_id?: string
          respondido_em?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "peneira_convites_peneira_id_fkey"
            columns: ["peneira_id"]
            isOneToOne: false
            referencedRelation: "peneiras"
            referencedColumns: ["id"]
          },
        ]
      }
      peneiras: {
        Row: {
          alcance: string
          banner_url: string | null
          categorias: string[] | null
          cidade: string | null
          contato_email: string | null
          contato_whatsapp: string | null
          created_at: string
          criador_id: string
          criador_perfil_rede_id: string | null
          data_evento: string
          data_fim: string | null
          descricao: string | null
          estado: string | null
          filtro_status_federado: string | null
          id: string
          local_endereco: string | null
          local_nome: string
          modalidade: string
          posicoes: string[] | null
          requisitos: string | null
          status: string
          titulo: string
          updated_at: string
          vagas: number | null
        }
        Insert: {
          alcance?: string
          banner_url?: string | null
          categorias?: string[] | null
          cidade?: string | null
          contato_email?: string | null
          contato_whatsapp?: string | null
          created_at?: string
          criador_id: string
          criador_perfil_rede_id?: string | null
          data_evento: string
          data_fim?: string | null
          descricao?: string | null
          estado?: string | null
          filtro_status_federado?: string | null
          id?: string
          local_endereco?: string | null
          local_nome: string
          modalidade?: string
          posicoes?: string[] | null
          requisitos?: string | null
          status?: string
          titulo: string
          updated_at?: string
          vagas?: number | null
        }
        Update: {
          alcance?: string
          banner_url?: string | null
          categorias?: string[] | null
          cidade?: string | null
          contato_email?: string | null
          contato_whatsapp?: string | null
          created_at?: string
          criador_id?: string
          criador_perfil_rede_id?: string | null
          data_evento?: string
          data_fim?: string | null
          descricao?: string | null
          estado?: string | null
          filtro_status_federado?: string | null
          id?: string
          local_endereco?: string | null
          local_nome?: string
          modalidade?: string
          posicoes?: string[] | null
          requisitos?: string | null
          status?: string
          titulo?: string
          updated_at?: string
          vagas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "peneiras_criador_perfil_rede_id_fkey"
            columns: ["criador_perfil_rede_id"]
            isOneToOne: false
            referencedRelation: "perfis_rede"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_atleta: {
        Row: {
          atleta_app_id: string | null
          banner_url: string | null
          bio: string | null
          categoria: string | null
          cidade: string | null
          conexoes_count: number
          convite_codigo: string | null
          cor_destaque: string | null
          cpf_cnpj: string | null
          created_at: string
          crianca_id: string | null
          dados_publicos: Json
          estado: string | null
          followers_count: number
          foto_url: string | null
          id: string
          instagram_url: string | null
          is_public: boolean
          is_teste: boolean
          modalidade: string
          modalidades: string[] | null
          nome: string
          origem: string
          pe_dominante: string | null
          posicao_principal: string | null
          posicao_secundaria: string | null
          slug: string
          status_conta: string | null
          telefone_whatsapp: string | null
          tema: string | null
          tipo_documento: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          atleta_app_id?: string | null
          banner_url?: string | null
          bio?: string | null
          categoria?: string | null
          cidade?: string | null
          conexoes_count?: number
          convite_codigo?: string | null
          cor_destaque?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          crianca_id?: string | null
          dados_publicos?: Json
          estado?: string | null
          followers_count?: number
          foto_url?: string | null
          id?: string
          instagram_url?: string | null
          is_public?: boolean
          is_teste?: boolean
          modalidade?: string
          modalidades?: string[] | null
          nome: string
          origem?: string
          pe_dominante?: string | null
          posicao_principal?: string | null
          posicao_secundaria?: string | null
          slug: string
          status_conta?: string | null
          telefone_whatsapp?: string | null
          tema?: string | null
          tipo_documento?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          atleta_app_id?: string | null
          banner_url?: string | null
          bio?: string | null
          categoria?: string | null
          cidade?: string | null
          conexoes_count?: number
          convite_codigo?: string | null
          cor_destaque?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          crianca_id?: string | null
          dados_publicos?: Json
          estado?: string | null
          followers_count?: number
          foto_url?: string | null
          id?: string
          instagram_url?: string | null
          is_public?: boolean
          is_teste?: boolean
          modalidade?: string
          modalidades?: string[] | null
          nome?: string
          origem?: string
          pe_dominante?: string | null
          posicao_principal?: string | null
          posicao_secundaria?: string | null
          slug?: string
          status_conta?: string | null
          telefone_whatsapp?: string | null
          tema?: string | null
          tipo_documento?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      perfil_atleta_colaboradores: {
        Row: {
          ativado_em: string | null
          codigo_convite: string
          convidado_por: string
          created_at: string
          crianca_id: string
          email: string | null
          id: string
          nome: string
          revogado_em: string | null
          status: string
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativado_em?: string | null
          codigo_convite: string
          convidado_por: string
          created_at?: string
          crianca_id: string
          email?: string | null
          id?: string
          nome: string
          revogado_em?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativado_em?: string | null
          codigo_convite?: string
          convidado_por?: string
          created_at?: string
          crianca_id?: string
          email?: string | null
          id?: string
          nome?: string
          revogado_em?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfil_atleta_colaboradores_crianca_id_fkey"
            columns: ["crianca_id"]
            isOneToOne: false
            referencedRelation: "criancas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_visualizacoes: {
        Row: {
          created_at: string
          id: string
          perfil_atleta_id: string
          viewed_date: string
          viewer_foto_url: string | null
          viewer_nome: string | null
          viewer_tipo: string | null
          viewer_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          perfil_atleta_id: string
          viewed_date?: string
          viewer_foto_url?: string | null
          viewer_nome?: string | null
          viewer_tipo?: string | null
          viewer_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          perfil_atleta_id?: string
          viewed_date?: string
          viewer_foto_url?: string | null
          viewer_nome?: string | null
          viewer_tipo?: string | null
          viewer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_visualizacoes_perfil_atleta_id_fkey"
            columns: ["perfil_atleta_id"]
            isOneToOne: false
            referencedRelation: "perfil_atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_rede: {
        Row: {
          bio: string | null
          cidade: string | null
          convite_codigo: string | null
          cpf_cnpj: string | null
          created_at: string
          dados_perfil: Json
          estado: string | null
          foto_url: string | null
          id: string
          instagram: string | null
          nome: string
          site: string | null
          slug: string | null
          status_conta: string | null
          telefone_whatsapp: string | null
          tema: string | null
          tipo: string
          tipo_documento: string | null
          updated_at: string
          user_id: string
          whatsapp_publico: boolean
        }
        Insert: {
          bio?: string | null
          cidade?: string | null
          convite_codigo?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          dados_perfil?: Json
          estado?: string | null
          foto_url?: string | null
          id?: string
          instagram?: string | null
          nome: string
          site?: string | null
          slug?: string | null
          status_conta?: string | null
          telefone_whatsapp?: string | null
          tema?: string | null
          tipo: string
          tipo_documento?: string | null
          updated_at?: string
          user_id: string
          whatsapp_publico?: boolean
        }
        Update: {
          bio?: string | null
          cidade?: string | null
          convite_codigo?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          dados_perfil?: Json
          estado?: string | null
          foto_url?: string | null
          id?: string
          instagram?: string | null
          nome?: string
          site?: string | null
          slug?: string | null
          status_conta?: string | null
          telefone_whatsapp?: string | null
          tema?: string | null
          tipo?: string
          tipo_documento?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_publico?: boolean
        }
        Relationships: []
      }
      pontos_historico: {
        Row: {
          acao_tipo: string
          created_at: string
          descricao: string
          id: string
          pontos: number
          referencia_id: string | null
          user_id: string
        }
        Insert: {
          acao_tipo: string
          created_at?: string
          descricao: string
          id?: string
          pontos: number
          referencia_id?: string | null
          user_id: string
        }
        Update: {
          acao_tipo?: string
          created_at?: string
          descricao?: string
          id?: string
          pontos?: number
          referencia_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      post_comentarios: {
        Row: {
          created_at: string
          id: string
          post_id: string
          texto: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          texto: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          texto?: string
          user_id?: string
        }
        Relationships: []
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: []
      }
      posts_atleta: {
        Row: {
          autor_id: string | null
          comments_count: number
          created_at: string
          criado_por: string | null
          id: string
          imagens_urls: string[] | null
          likes_count: number
          link_preview: Json | null
          perfil_rede_id: string | null
          texto: string
          titulo: string | null
          updated_at: string
          video_url: string | null
          visibilidade: string
        }
        Insert: {
          autor_id?: string | null
          comments_count?: number
          created_at?: string
          criado_por?: string | null
          id?: string
          imagens_urls?: string[] | null
          likes_count?: number
          link_preview?: Json | null
          perfil_rede_id?: string | null
          texto: string
          titulo?: string | null
          updated_at?: string
          video_url?: string | null
          visibilidade?: string
        }
        Update: {
          autor_id?: string | null
          comments_count?: number
          created_at?: string
          criado_por?: string | null
          id?: string
          imagens_urls?: string[] | null
          likes_count?: number
          link_preview?: Json | null
          perfil_rede_id?: string | null
          texto?: string
          titulo?: string | null
          updated_at?: string
          video_url?: string | null
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_atleta_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfil_atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_atleta_perfil_rede_id_fkey"
            columns: ["perfil_rede_id"]
            isOneToOne: false
            referencedRelation: "perfis_rede"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          password_needs_change: boolean | null
          provider: string | null
          push_optout: boolean
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          nome: string
          password_needs_change?: boolean | null
          provider?: string | null
          push_optout?: boolean
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          password_needs_change?: boolean | null
          provider?: string | null
          push_optout?: boolean
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rede_conexoes: {
        Row: {
          created_at: string
          destinatario_id: string
          destinatario_perfil_atleta_id: string | null
          id: string
          solicitante_id: string
          solicitante_perfil_atleta_id: string | null
          status: string
          unidade_nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          destinatario_id: string
          destinatario_perfil_atleta_id?: string | null
          id?: string
          solicitante_id: string
          solicitante_perfil_atleta_id?: string | null
          status?: string
          unidade_nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          destinatario_id?: string
          destinatario_perfil_atleta_id?: string | null
          id?: string
          solicitante_id?: string
          solicitante_perfil_atleta_id?: string | null
          status?: string
          unidade_nome?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rede_conexoes_destinatario_perfil_atleta_id_fkey"
            columns: ["destinatario_perfil_atleta_id"]
            isOneToOne: false
            referencedRelation: "perfil_atleta"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rede_conexoes_solicitante_perfil_atleta_id_fkey"
            columns: ["solicitante_perfil_atleta_id"]
            isOneToOne: false
            referencedRelation: "perfil_atleta"
            referencedColumns: ["id"]
          },
        ]
      }
      rede_convites: {
        Row: {
          convidado_user_id: string
          convidante_perfil_id: string
          created_at: string
          desafio_id: string | null
          id: string
          pontos_concedidos: number | null
          tipo_convidado: string | null
        }
        Insert: {
          convidado_user_id: string
          convidante_perfil_id: string
          created_at?: string
          desafio_id?: string | null
          id?: string
          pontos_concedidos?: number | null
          tipo_convidado?: string | null
        }
        Update: {
          convidado_user_id?: string
          convidante_perfil_id?: string
          created_at?: string
          desafio_id?: string | null
          id?: string
          pontos_concedidos?: number | null
          tipo_convidado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rede_convites_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "desafios_convite"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_config: {
        Row: {
          chave: string
          created_at: string
          id: string
          valor: string
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          valor: string
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          valor?: string
        }
        Relationships: []
      }
      termos_aceites: {
        Row: {
          aceito_em: string
          id: string
          metodo: string
          user_id: string
          versao: string
        }
        Insert: {
          aceito_em?: string
          id?: string
          metodo: string
          user_id: string
          versao: string
        }
        Update: {
          aceito_em?: string
          id?: string
          metodo?: string
          user_id?: string
          versao?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_cor: string | null
          badge_descricao: string
          badge_icone: string | null
          badge_nome: string
          badge_tipo: string
          conquistado_em: string
          id: string
          user_id: string
        }
        Insert: {
          badge_cor?: string | null
          badge_descricao: string
          badge_icone?: string | null
          badge_nome: string
          badge_tipo: string
          conquistado_em?: string
          id?: string
          user_id: string
        }
        Update: {
          badge_cor?: string | null
          badge_descricao?: string
          badge_icone?: string | null
          badge_nome?: string
          badge_tipo?: string
          conquistado_em?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_gamificacao: {
        Row: {
          atividades_registradas: number
          conexoes_feitas: number
          convites_confirmados: number
          convites_enviados: number
          created_at: string
          id: string
          nivel: number
          pontos_total: number
          posts_criados: number
          updated_at: string
          user_id: string
          xp_atual: number
        }
        Insert: {
          atividades_registradas?: number
          conexoes_feitas?: number
          convites_confirmados?: number
          convites_enviados?: number
          created_at?: string
          id?: string
          nivel?: number
          pontos_total?: number
          posts_criados?: number
          updated_at?: string
          user_id: string
          xp_atual?: number
        }
        Update: {
          atividades_registradas?: number
          conexoes_feitas?: number
          convites_confirmados?: number
          convites_enviados?: number
          created_at?: string
          id?: string
          nivel?: number
          pontos_total?: number
          posts_criados?: number
          updated_at?: string
          user_id?: string
          xp_atual?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adicionar_pontos: {
        Args: {
          p_acao_tipo: string
          p_descricao: string
          p_pontos: number
          p_referencia_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      calcular_nivel: { Args: { xp_atual: number }; Returns: number }
      check_carreira_atividade_limit: {
        Args: { p_crianca_id: string; p_user_id: string }
        Returns: Json
      }
      crianca_has_public_profile: {
        Args: { p_crianca_id: string; p_data_type?: string }
        Returns: boolean
      }
      dar_badge: {
        Args: {
          p_badge_cor?: string
          p_badge_descricao: string
          p_badge_icone?: string
          p_badge_nome: string
          p_badge_tipo: string
          p_user_id: string
        }
        Returns: undefined
      }
      expirar_trials_carreira: { Args: never; Returns: number }
      get_acao_pontos: { Args: { p_acao_tipo: string }; Returns: number }
      get_premium_crianca_ids: {
        Args: { p_crianca_ids: string[] }
        Returns: {
          crianca_id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_atividades_externas_access: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      has_atividades_externas_access_for_child: {
        Args: { check_crianca_id: string; check_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_perfil_atleta_owner: {
        Args: { check_crianca_id: string; check_user_id: string }
        Returns: boolean
      }
      is_perfil_atleta_owner_or_colaborador: {
        Args: { check_crianca_id: string; check_user_id: string }
        Returns: boolean
      }
      verificar_badges_convites: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      xp_para_proximo_nivel: { Args: { nivel_atual: number }; Returns: number }
    }
    Enums: {
      atividade_credibilidade_status:
        | "registrado"
        | "com_evidencia"
        | "validado"
      atividade_externa_tipo:
        | "clinica_camp"
        | "treino_preparador_fisico"
        | "treino_tecnico"
        | "avaliacao"
        | "competicao_torneio"
        | "jogo_amistoso_externo"
        | "outro"
      tipo_jogo_enum: "campeonato" | "amistoso"
      tipo_midia_enum: "foto" | "video"
      torneio_abrangencia:
        | "municipal"
        | "regional"
        | "estadual"
        | "nacional"
        | "internacional"
      torneio_abrangencia_novo:
        | "regional"
        | "estadual"
        | "nacional"
        | "internacional"
      user_role: "admin" | "school" | "teacher" | "guardian"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      atividade_credibilidade_status: [
        "registrado",
        "com_evidencia",
        "validado",
      ],
      atividade_externa_tipo: [
        "clinica_camp",
        "treino_preparador_fisico",
        "treino_tecnico",
        "avaliacao",
        "competicao_torneio",
        "jogo_amistoso_externo",
        "outro",
      ],
      tipo_jogo_enum: ["campeonato", "amistoso"],
      tipo_midia_enum: ["foto", "video"],
      torneio_abrangencia: [
        "municipal",
        "regional",
        "estadual",
        "nacional",
        "internacional",
      ],
      torneio_abrangencia_novo: [
        "regional",
        "estadual",
        "nacional",
        "internacional",
      ],
      user_role: ["admin", "school", "teacher", "guardian"],
    },
  },
} as const
