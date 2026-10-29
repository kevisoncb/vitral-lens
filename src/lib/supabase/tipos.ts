// Gerado por supabase/gerar_tipos.mjs a partir das migrações. Não edite à mão: rode `npm run tipos`.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      anotacoes_cliente: {
        Row: {
          id: string;
          otica_id: string;
          cliente_id: string;
          texto: string;
          autor_id: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          cliente_id: string;
          texto: string;
          autor_id?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          cliente_id?: string;
          texto?: string;
          autor_id?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "anotacoes_cliente_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anotacoes_cliente_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "anotacoes_cliente_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      atendimento_itens: {
        Row: {
          id: string;
          otica_id: string;
          atendimento_id: string;
          catalogo_item_id: string | null;
          descricao: string;
          quantidade: number;
          preco_unitario: number;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          atendimento_id: string;
          catalogo_item_id?: string | null;
          descricao: string;
          quantidade?: number;
          preco_unitario: number;
        };
        Update: {
          id?: string;
          otica_id?: string;
          atendimento_id?: string;
          catalogo_item_id?: string | null;
          descricao?: string;
          quantidade?: number;
          preco_unitario?: number;
        };
        Relationships: [
          {
            foreignKeyName: "atendimento_itens_atendimento_id_fkey";
            columns: ["atendimento_id"];
            isOneToOne: false;
            referencedRelation: "atendimentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimento_itens_catalogo_item_id_fkey";
            columns: ["catalogo_item_id"];
            isOneToOne: false;
            referencedRelation: "catalogo_itens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimento_itens_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      atendimentos: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string | null;
          cliente_id: string;
          etapa_id: string;
          responsavel_id: string | null;
          receita_id: string | null;
          descricao: string | null;
          valor_total: number;
          motivo_perda_id: string | null;
          observacao_perda: string | null;
          etapa_desde: string;
          criado_em: string;
          atualizado_em: string;
          origem: string;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          loja_id?: string | null;
          cliente_id: string;
          etapa_id: string;
          responsavel_id?: string | null;
          receita_id?: string | null;
          descricao?: string | null;
          valor_total?: number;
          motivo_perda_id?: string | null;
          observacao_perda?: string | null;
          etapa_desde?: string;
          criado_em?: string;
          atualizado_em?: string;
          origem?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string | null;
          cliente_id?: string;
          etapa_id?: string;
          responsavel_id?: string | null;
          receita_id?: string | null;
          descricao?: string | null;
          valor_total?: number;
          motivo_perda_id?: string | null;
          observacao_perda?: string | null;
          etapa_desde?: string;
          criado_em?: string;
          atualizado_em?: string;
          origem?: string;
        };
        Relationships: [
          {
            foreignKeyName: "atendimentos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimentos_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "funil_etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimentos_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimentos_motivo_perda_id_fkey";
            columns: ["motivo_perda_id"];
            isOneToOne: false;
            referencedRelation: "motivos_perda";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimentos_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimentos_receita_id_fkey";
            columns: ["receita_id"];
            isOneToOne: false;
            referencedRelation: "receitas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "atendimentos_responsavel_id_fkey";
            columns: ["responsavel_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      auditoria: {
        Row: {
          id: number;
          otica_id: string;
          usuario_id: string | null;
          tabela: string;
          registro_id: string | null;
          acao: string;
          antes: Json | null;
          depois: Json | null;
          em: string;
        };
        Insert: {
          id?: never;
          otica_id: string;
          usuario_id?: string | null;
          tabela: string;
          registro_id?: string | null;
          acao: string;
          antes?: Json | null;
          depois?: Json | null;
          em?: string;
        };
        Update: {
          id?: never;
          otica_id?: string;
          usuario_id?: string | null;
          tabela?: string;
          registro_id?: string | null;
          acao?: string;
          antes?: Json | null;
          depois?: Json | null;
          em?: string;
        };
        Relationships: [
        ];
      };
      bloqueios_agenda: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string;
          profissional_id: string | null;
          inicio: string;
          fim: string;
          motivo: string | null;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          loja_id: string;
          profissional_id?: string | null;
          inicio: string;
          fim: string;
          motivo?: string | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string;
          profissional_id?: string | null;
          inicio?: string;
          fim?: string;
          motivo?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "bloqueios_agenda_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bloqueios_agenda_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bloqueios_agenda_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      caixa_movimentos: {
        Row: {
          id: string;
          otica_id: string;
          caixa_id: string;
          tipo: string;
          valor: number;
          motivo: string | null;
          usuario_id: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          otica_id: string;
          caixa_id: string;
          tipo: string;
          valor: number;
          motivo?: string | null;
          usuario_id?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          caixa_id?: string;
          tipo?: string;
          valor?: number;
          motivo?: string | null;
          usuario_id?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "caixa_movimentos_caixa_id_fkey";
            columns: ["caixa_id"];
            isOneToOne: false;
            referencedRelation: "caixas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caixa_movimentos_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caixa_movimentos_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      caixas: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string;
          operador_id: string;
          aberto_em: string;
          fechado_em: string | null;
          valor_abertura: number;
          valor_fechamento: number | null;
          valor_esperado: number | null;
          observacao: string | null;
        };
        Insert: {
          id?: string;
          otica_id: string;
          loja_id: string;
          operador_id: string;
          aberto_em?: string;
          fechado_em?: string | null;
          valor_abertura?: number;
          valor_fechamento?: number | null;
          valor_esperado?: number | null;
          observacao?: string | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string;
          operador_id?: string;
          aberto_em?: string;
          fechado_em?: string | null;
          valor_abertura?: number;
          valor_fechamento?: number | null;
          valor_esperado?: number | null;
          observacao?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "caixas_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caixas_operador_id_fkey";
            columns: ["operador_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "caixas_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      catalogo_itens: {
        Row: {
          id: string;
          otica_id: string;
          categoria: string;
          nome: string;
          preco: number;
          ativo: boolean;
          marca: string | null;
          codigo: string | null;
          foto_path: string | null;
          criado_na_venda: boolean;
          criado_por: string | null;
          criado_em: string;
          controla_estoque: boolean;
          estoque_minimo: number;
          custo: number | null;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          categoria: string;
          nome: string;
          preco: number;
          ativo?: boolean;
          marca?: string | null;
          codigo?: string | null;
          foto_path?: string | null;
          criado_na_venda?: boolean;
          criado_por?: string | null;
          criado_em?: string;
          controla_estoque?: boolean;
          estoque_minimo?: number;
          custo?: number | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          categoria?: string;
          nome?: string;
          preco?: number;
          ativo?: boolean;
          marca?: string | null;
          codigo?: string | null;
          foto_path?: string | null;
          criado_na_venda?: boolean;
          criado_por?: string | null;
          criado_em?: string;
          controla_estoque?: boolean;
          estoque_minimo?: number;
          custo?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "catalogo_itens_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalogo_itens_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      categorias_custo: {
        Row: {
          id: string;
          otica_id: string;
          nome: string;
          tipo: string;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          nome: string;
          tipo: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          nome?: string;
          tipo?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categorias_custo_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      clientes: {
        Row: {
          id: string;
          otica_id: string;
          nome: string;
          telefone: string | null;
          email: string | null;
          cpf: string | null;
          nascimento: string | null;
          endereco: string | null;
          consentimento_lgpd_em: string | null;
          criado_por: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          nome: string;
          telefone?: string | null;
          email?: string | null;
          cpf?: string | null;
          nascimento?: string | null;
          endereco?: string | null;
          consentimento_lgpd_em?: string | null;
          criado_por?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          nome?: string;
          telefone?: string | null;
          email?: string | null;
          cpf?: string | null;
          nascimento?: string | null;
          endereco?: string | null;
          consentimento_lgpd_em?: string | null;
          criado_por?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clientes_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clientes_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      comissao_regras: {
        Row: {
          id: string;
          otica_id: string;
          usuario_id: string | null;
          categoria: string | null;
          percentual: number;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          usuario_id?: string | null;
          categoria?: string | null;
          percentual: number;
        };
        Update: {
          id?: string;
          otica_id?: string;
          usuario_id?: string | null;
          categoria?: string | null;
          percentual?: number;
        };
        Relationships: [
          {
            foreignKeyName: "comissao_regras_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissao_regras_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      comissoes: {
        Row: {
          id: string;
          otica_id: string;
          usuario_id: string;
          atendimento_id: string | null;
          venda_id: string | null;
          base: number;
          valor: number;
          competencia: string;
          status: string;
          paga_em: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          otica_id: string;
          usuario_id: string;
          atendimento_id?: string | null;
          venda_id?: string | null;
          base: number;
          valor: number;
          competencia: string;
          status?: string;
          paga_em?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          usuario_id?: string;
          atendimento_id?: string | null;
          venda_id?: string | null;
          base?: number;
          valor?: number;
          competencia?: string;
          status?: string;
          paga_em?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comissoes_atendimento_id_fkey";
            columns: ["atendimento_id"];
            isOneToOne: false;
            referencedRelation: "atendimentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissoes_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissoes_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comissoes_venda_id_fkey";
            columns: ["venda_id"];
            isOneToOne: false;
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      consultas: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string;
          profissional_id: string | null;
          cliente_id: string | null;
          nome_contato: string | null;
          telefone_contato: string | null;
          inicio: string;
          fim: string;
          status: Database["public"]["Enums"]["consulta_status"];
          origem: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          loja_id: string;
          profissional_id?: string | null;
          cliente_id?: string | null;
          nome_contato?: string | null;
          telefone_contato?: string | null;
          inicio: string;
          fim: string;
          status?: Database["public"]["Enums"]["consulta_status"];
          origem?: string;
          criado_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string;
          profissional_id?: string | null;
          cliente_id?: string | null;
          nome_contato?: string | null;
          telefone_contato?: string | null;
          inicio?: string;
          fim?: string;
          status?: Database["public"]["Enums"]["consulta_status"];
          origem?: string;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consultas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultas_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultas_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "consultas_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      contadores: {
        Row: {
          otica_id: string;
          nome: string;
          valor: number;
        };
        Insert: {
          otica_id: string;
          nome: string;
          valor?: number;
        };
        Update: {
          otica_id?: string;
          nome?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "contadores_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      contas_pagar: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string | null;
          categoria_id: string | null;
          descricao: string;
          valor: number;
          vencimento: string;
          pago_em: string | null;
          criado_em: string;
          fornecedor: string | null;
          observacao: string | null;
          recorrencia_id: string | null;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          loja_id?: string | null;
          categoria_id?: string | null;
          descricao: string;
          valor: number;
          vencimento: string;
          pago_em?: string | null;
          criado_em?: string;
          fornecedor?: string | null;
          observacao?: string | null;
          recorrencia_id?: string | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string | null;
          categoria_id?: string | null;
          descricao?: string;
          valor?: number;
          vencimento?: string;
          pago_em?: string | null;
          criado_em?: string;
          fornecedor?: string | null;
          observacao?: string | null;
          recorrencia_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contas_pagar_categoria_id_fkey";
            columns: ["categoria_id"];
            isOneToOne: false;
            referencedRelation: "categorias_custo";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contas_pagar_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contas_pagar_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      contas_receber: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string | null;
          venda_id: string | null;
          cliente_id: string | null;
          descricao: string;
          valor: number;
          vencimento: string;
          recebido_em: string | null;
          criado_em: string;
          observacao: string | null;
          recebido_forma: string | null;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          loja_id?: string | null;
          venda_id?: string | null;
          cliente_id?: string | null;
          descricao: string;
          valor: number;
          vencimento: string;
          recebido_em?: string | null;
          criado_em?: string;
          observacao?: string | null;
          recebido_forma?: string | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string | null;
          venda_id?: string | null;
          cliente_id?: string | null;
          descricao?: string;
          valor?: number;
          vencimento?: string;
          recebido_em?: string | null;
          criado_em?: string;
          observacao?: string | null;
          recebido_forma?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contas_receber_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contas_receber_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contas_receber_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contas_receber_venda_id_fkey";
            columns: ["venda_id"];
            isOneToOne: false;
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      estoque_movimentos: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string;
          item_id: string;
          tipo: string;
          quantidade: number;
          custo_unitario: number | null;
          atendimento_id: string | null;
          venda_id: string | null;
          motivo: string | null;
          usuario_id: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          otica_id: string;
          loja_id: string;
          item_id: string;
          tipo: string;
          quantidade: number;
          custo_unitario?: number | null;
          atendimento_id?: string | null;
          venda_id?: string | null;
          motivo?: string | null;
          usuario_id?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string;
          item_id?: string;
          tipo?: string;
          quantidade?: number;
          custo_unitario?: number | null;
          atendimento_id?: string | null;
          venda_id?: string | null;
          motivo?: string | null;
          usuario_id?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estoque_movimentos_atendimento_id_fkey";
            columns: ["atendimento_id"];
            isOneToOne: false;
            referencedRelation: "atendimentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estoque_movimentos_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "catalogo_itens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estoque_movimentos_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estoque_movimentos_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estoque_movimentos_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estoque_movimentos_venda_id_fkey";
            columns: ["venda_id"];
            isOneToOne: false;
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      estoque_saldos: {
        Row: {
          otica_id: string;
          loja_id: string;
          item_id: string;
          quantidade: number;
          atualizado_em: string;
        };
        Insert: {
          otica_id: string;
          loja_id: string;
          item_id: string;
          quantidade?: number;
          atualizado_em?: string;
        };
        Update: {
          otica_id?: string;
          loja_id?: string;
          item_id?: string;
          quantidade?: number;
          atualizado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estoque_saldos_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "catalogo_itens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estoque_saldos_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estoque_saldos_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      exame_olhos: {
        Row: {
          id: string;
          otica_id: string;
          exame_id: string;
          olho: string;
          av_sc: string | null;
          av_cc: string | null;
          esferico: number | null;
          cilindrico: number | null;
          eixo: number | null;
          adicao: number | null;
          dnp: number | null;
          altura: number | null;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          exame_id: string;
          olho: string;
          av_sc?: string | null;
          av_cc?: string | null;
          esferico?: number | null;
          cilindrico?: number | null;
          eixo?: number | null;
          adicao?: number | null;
          dnp?: number | null;
          altura?: number | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          exame_id?: string;
          olho?: string;
          av_sc?: string | null;
          av_cc?: string | null;
          esferico?: number | null;
          cilindrico?: number | null;
          eixo?: number | null;
          adicao?: number | null;
          dnp?: number | null;
          altura?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "exame_olhos_exame_id_fkey";
            columns: ["exame_id"];
            isOneToOne: false;
            referencedRelation: "exames";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exame_olhos_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      exames: {
        Row: {
          id: string;
          otica_id: string;
          cliente_id: string;
          consulta_id: string | null;
          profissional_id: string | null;
          registro_profissional: string | null;
          queixa: string | null;
          historico: string | null;
          usa_oculos: boolean | null;
          usa_lente_contato: boolean | null;
          observacoes: string | null;
          conduta: string | null;
          retorno_em: string | null;
          status: string;
          concluido_em: string | null;
          criado_em: string;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          cliente_id: string;
          consulta_id?: string | null;
          profissional_id?: string | null;
          registro_profissional?: string | null;
          queixa?: string | null;
          historico?: string | null;
          usa_oculos?: boolean | null;
          usa_lente_contato?: boolean | null;
          observacoes?: string | null;
          conduta?: string | null;
          retorno_em?: string | null;
          status?: string;
          concluido_em?: string | null;
          criado_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          cliente_id?: string;
          consulta_id?: string | null;
          profissional_id?: string | null;
          registro_profissional?: string | null;
          queixa?: string | null;
          historico?: string | null;
          usa_oculos?: boolean | null;
          usa_lente_contato?: boolean | null;
          observacoes?: string | null;
          conduta?: string | null;
          retorno_em?: string | null;
          status?: string;
          concluido_em?: string | null;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exames_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exames_consulta_id_fkey";
            columns: ["consulta_id"];
            isOneToOne: false;
            referencedRelation: "consultas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exames_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exames_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      funil_etapas: {
        Row: {
          id: string;
          otica_id: string;
          nome: string;
          tipo: Database["public"]["Enums"]["etapa_tipo"];
          ordem: number;
          visivel: boolean;
          dias_para_sem_retorno: number | null;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          nome: string;
          tipo?: Database["public"]["Enums"]["etapa_tipo"];
          ordem: number;
          visivel?: boolean;
          dias_para_sem_retorno?: number | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          nome?: string;
          tipo?: Database["public"]["Enums"]["etapa_tipo"];
          ordem?: number;
          visivel?: boolean;
          dias_para_sem_retorno?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "funil_etapas_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      horarios_trabalho: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string;
          profissional_id: string | null;
          dia_semana: number;
          inicio: string;
          fim: string;
          duracao_min: number;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          loja_id: string;
          profissional_id?: string | null;
          dia_semana: number;
          inicio: string;
          fim: string;
          duracao_min?: number;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string;
          profissional_id?: string | null;
          dia_semana?: number;
          inicio?: string;
          fim?: string;
          duracao_min?: number;
        };
        Relationships: [
          {
            foreignKeyName: "horarios_trabalho_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "horarios_trabalho_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "horarios_trabalho_profissional_id_fkey";
            columns: ["profissional_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      lista_espera: {
        Row: {
          id: string;
          nome: string;
          otica_nome: string;
          cidade: string | null;
          uf: string | null;
          telefone: string;
          email: string | null;
          lojas: number | null;
          aceite_lgpd_em: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          nome: string;
          otica_nome: string;
          cidade?: string | null;
          uf?: string | null;
          telefone: string;
          email?: string | null;
          lojas?: number | null;
          aceite_lgpd_em: string;
          criado_em?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          otica_nome?: string;
          cidade?: string | null;
          uf?: string | null;
          telefone?: string;
          email?: string | null;
          lojas?: number | null;
          aceite_lgpd_em?: string;
          criado_em?: string;
        };
        Relationships: [
        ];
      };
      lojas: {
        Row: {
          id: string;
          otica_id: string;
          nome: string;
          telefone: string | null;
          endereco: string | null;
          ativa: boolean;
          criado_em: string;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          nome: string;
          telefone?: string | null;
          endereco?: string | null;
          ativa?: boolean;
          criado_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          nome?: string;
          telefone?: string | null;
          endereco?: string | null;
          ativa?: boolean;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lojas_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      motivos_perda: {
        Row: {
          id: string;
          otica_id: string;
          nome: string;
          ativo: boolean;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          nome: string;
          ativo?: boolean;
        };
        Update: {
          id?: string;
          otica_id?: string;
          nome?: string;
          ativo?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "motivos_perda_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      ordens_servico: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string | null;
          numero: number | null;
          atendimento_id: string | null;
          cliente_id: string;
          receita_id: string | null;
          etapa_id: string;
          descricao: string;
          laboratorio_nome: string | null;
          data_prometida: string | null;
          data_entrega: string | null;
          garantia_ate: string | null;
          retrabalho: boolean;
          motivo_retrabalho: string | null;
          etapa_desde: string;
          criado_em: string;
          lente: string | null;
          tratamentos: string | null;
          armacao: string | null;
          armacao_tipo: string | null;
          aro: number | null;
          ponte: number | null;
          diagonal_maior: number | null;
          dnp_od: number | null;
          dnp_oe: number | null;
          altura_od: number | null;
          altura_oe: number | null;
          obs_tecnica: string | null;
          cliente_nome: string | null;
          responsavel_lab_id: string | null;
          puxada_em: string | null;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          loja_id?: string | null;
          numero?: number | null;
          atendimento_id?: string | null;
          cliente_id: string;
          receita_id?: string | null;
          etapa_id: string;
          descricao: string;
          laboratorio_nome?: string | null;
          data_prometida?: string | null;
          data_entrega?: string | null;
          garantia_ate?: string | null;
          retrabalho?: boolean;
          motivo_retrabalho?: string | null;
          etapa_desde?: string;
          criado_em?: string;
          lente?: string | null;
          tratamentos?: string | null;
          armacao?: string | null;
          armacao_tipo?: string | null;
          aro?: number | null;
          ponte?: number | null;
          diagonal_maior?: number | null;
          dnp_od?: number | null;
          dnp_oe?: number | null;
          altura_od?: number | null;
          altura_oe?: number | null;
          obs_tecnica?: string | null;
          cliente_nome?: string | null;
          responsavel_lab_id?: string | null;
          puxada_em?: string | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string | null;
          numero?: number | null;
          atendimento_id?: string | null;
          cliente_id?: string;
          receita_id?: string | null;
          etapa_id?: string;
          descricao?: string;
          laboratorio_nome?: string | null;
          data_prometida?: string | null;
          data_entrega?: string | null;
          garantia_ate?: string | null;
          retrabalho?: boolean;
          motivo_retrabalho?: string | null;
          etapa_desde?: string;
          criado_em?: string;
          lente?: string | null;
          tratamentos?: string | null;
          armacao?: string | null;
          armacao_tipo?: string | null;
          aro?: number | null;
          ponte?: number | null;
          diagonal_maior?: number | null;
          dnp_od?: number | null;
          dnp_oe?: number | null;
          altura_od?: number | null;
          altura_oe?: number | null;
          obs_tecnica?: string | null;
          cliente_nome?: string | null;
          responsavel_lab_id?: string | null;
          puxada_em?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ordens_servico_atendimento_id_fkey";
            columns: ["atendimento_id"];
            isOneToOne: false;
            referencedRelation: "atendimentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordens_servico_etapa_id_fkey";
            columns: ["etapa_id"];
            isOneToOne: false;
            referencedRelation: "os_etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordens_servico_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordens_servico_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordens_servico_receita_id_fkey";
            columns: ["receita_id"];
            isOneToOne: false;
            referencedRelation: "receitas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordens_servico_responsavel_lab_id_fkey";
            columns: ["responsavel_lab_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      os_etapas: {
        Row: {
          id: string;
          otica_id: string;
          nome: string;
          ordem: number;
          final: boolean;
          avisa_cliente: boolean;
          area: string;
        };
        Insert: {
          id?: string;
          otica_id: string;
          nome: string;
          ordem: number;
          final?: boolean;
          avisa_cliente?: boolean;
          area?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          nome?: string;
          ordem?: number;
          final?: boolean;
          avisa_cliente?: boolean;
          area?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_etapas_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      os_historico: {
        Row: {
          id: string;
          otica_id: string;
          os_id: string;
          de_etapa: string | null;
          para_etapa: string | null;
          usuario_id: string | null;
          em: string;
        };
        Insert: {
          id?: string;
          otica_id: string;
          os_id: string;
          de_etapa?: string | null;
          para_etapa?: string | null;
          usuario_id?: string | null;
          em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          os_id?: string;
          de_etapa?: string | null;
          para_etapa?: string | null;
          usuario_id?: string | null;
          em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_historico_de_etapa_fkey";
            columns: ["de_etapa"];
            isOneToOne: false;
            referencedRelation: "os_etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_historico_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_historico_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_historico_para_etapa_fkey";
            columns: ["para_etapa"];
            isOneToOne: false;
            referencedRelation: "os_etapas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_historico_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
      os_mensagens: {
        Row: {
          id: string;
          otica_id: string;
          os_id: string;
          autor_id: string | null;
          area: string | null;
          texto: string;
          criado_em: string;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          os_id: string;
          autor_id?: string | null;
          area?: string | null;
          texto: string;
          criado_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          os_id?: string;
          autor_id?: string | null;
          area?: string | null;
          texto?: string;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_mensagens_autor_id_fkey";
            columns: ["autor_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_mensagens_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_mensagens_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      os_producao: {
        Row: {
          id: string;
          otica_id: string;
          os_id: string;
          etapa: string;
          aprovado: boolean;
          observacao: string | null;
          feito_por: string | null;
          feito_em: string;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          os_id: string;
          etapa: string;
          aprovado?: boolean;
          observacao?: string | null;
          feito_por?: string | null;
          feito_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          os_id?: string;
          etapa?: string;
          aprovado?: boolean;
          observacao?: string | null;
          feito_por?: string | null;
          feito_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "os_producao_feito_por_fkey";
            columns: ["feito_por"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_producao_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "os_producao_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      otica_adicionais: {
        Row: {
          otica_id: string;
          recurso: string;
          quantidade: number;
          desde: string;
        };
        Insert: {
          otica_id: string;
          recurso: string;
          quantidade?: number;
          desde?: string;
        };
        Update: {
          otica_id?: string;
          recurso?: string;
          quantidade?: number;
          desde?: string;
        };
        Relationships: [
          {
            foreignKeyName: "otica_adicionais_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "otica_adicionais_recurso_fkey";
            columns: ["recurso"];
            isOneToOne: false;
            referencedRelation: "recursos_adicionais";
            referencedColumns: ["recurso"];
          },
        ];
      };
      oticas: {
        Row: {
          id: string;
          nome: string;
          cnpj: string | null;
          telefone: string | null;
          logo_url: string | null;
          plano: Database["public"]["Enums"]["plano_tipo"];
          status: Database["public"]["Enums"]["otica_status"];
          criado_em: string;
          slug: string | null;
          site_publicado: boolean;
          site_titulo: string | null;
          site_sobre: string | null;
          site_endereco: string | null;
          site_whatsapp: string | null;
          site_horario: string | null;
          site_instagram: string | null;
          site_cor: string | null;
          aliquota_imposto: number | null;
        };
        Insert: {
          id?: string;
          nome: string;
          cnpj?: string | null;
          telefone?: string | null;
          logo_url?: string | null;
          plano?: Database["public"]["Enums"]["plano_tipo"];
          status?: Database["public"]["Enums"]["otica_status"];
          criado_em?: string;
          slug?: string | null;
          site_publicado?: boolean;
          site_titulo?: string | null;
          site_sobre?: string | null;
          site_endereco?: string | null;
          site_whatsapp?: string | null;
          site_horario?: string | null;
          site_instagram?: string | null;
          site_cor?: string | null;
          aliquota_imposto?: number | null;
        };
        Update: {
          id?: string;
          nome?: string;
          cnpj?: string | null;
          telefone?: string | null;
          logo_url?: string | null;
          plano?: Database["public"]["Enums"]["plano_tipo"];
          status?: Database["public"]["Enums"]["otica_status"];
          criado_em?: string;
          slug?: string | null;
          site_publicado?: boolean;
          site_titulo?: string | null;
          site_sobre?: string | null;
          site_endereco?: string | null;
          site_whatsapp?: string | null;
          site_horario?: string | null;
          site_instagram?: string | null;
          site_cor?: string | null;
          aliquota_imposto?: number | null;
        };
        Relationships: [
        ];
      };
      pagamentos: {
        Row: {
          id: string;
          otica_id: string;
          atendimento_id: string | null;
          venda_id: string | null;
          forma: string;
          valor: number;
          parcelas: number;
          sinal: boolean;
          pago_em: string;
          registrado_por: string | null;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          atendimento_id?: string | null;
          venda_id?: string | null;
          forma: string;
          valor: number;
          parcelas?: number;
          sinal?: boolean;
          pago_em?: string;
          registrado_por?: string | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          atendimento_id?: string | null;
          venda_id?: string | null;
          forma?: string;
          valor?: number;
          parcelas?: number;
          sinal?: boolean;
          pago_em?: string;
          registrado_por?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pagamentos_atendimento_id_fkey";
            columns: ["atendimento_id"];
            isOneToOne: false;
            referencedRelation: "atendimentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagamentos_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagamentos_registrado_por_fkey";
            columns: ["registrado_por"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pagamentos_venda_id_fkey";
            columns: ["venda_id"];
            isOneToOne: false;
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      perfis: {
        Row: {
          id: string;
          otica_id: string;
          chave: string;
          nome: string;
          permissoes: Json;
          do_sistema: boolean;
          area: string;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          chave: string;
          nome: string;
          permissoes?: Json;
          do_sistema?: boolean;
          area?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          chave?: string;
          nome?: string;
          permissoes?: Json;
          do_sistema?: boolean;
          area?: string;
        };
        Relationships: [
          {
            foreignKeyName: "perfis_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      plano_recursos: {
        Row: {
          plano: Database["public"]["Enums"]["plano_tipo"];
          recurso: string;
        };
        Insert: {
          plano: Database["public"]["Enums"]["plano_tipo"];
          recurso: string;
        };
        Update: {
          plano?: Database["public"]["Enums"]["plano_tipo"];
          recurso?: string;
        };
        Relationships: [
        ];
      };
      receita_olhos: {
        Row: {
          id: string;
          otica_id: string;
          receita_id: string;
          olho: string;
          distancia: string;
          esferico: number | null;
          cilindrico: number | null;
          eixo: number | null;
          adicao: number | null;
          prisma: number | null;
          base: string | null;
          dnp: number | null;
          altura: number | null;
          curva_base: number | null;
          diametro: number | null;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          receita_id: string;
          olho: string;
          distancia?: string;
          esferico?: number | null;
          cilindrico?: number | null;
          eixo?: number | null;
          adicao?: number | null;
          prisma?: number | null;
          base?: string | null;
          dnp?: number | null;
          altura?: number | null;
          curva_base?: number | null;
          diametro?: number | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          receita_id?: string;
          olho?: string;
          distancia?: string;
          esferico?: number | null;
          cilindrico?: number | null;
          eixo?: number | null;
          adicao?: number | null;
          prisma?: number | null;
          base?: string | null;
          dnp?: number | null;
          altura?: number | null;
          curva_base?: number | null;
          diametro?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "receita_olhos_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receita_olhos_receita_id_fkey";
            columns: ["receita_id"];
            isOneToOne: false;
            referencedRelation: "receitas";
            referencedColumns: ["id"];
          },
        ];
      };
      receitas: {
        Row: {
          id: string;
          otica_id: string;
          cliente_id: string;
          data_receita: string;
          tipo: string;
          medico: string | null;
          crm: string | null;
          validade: string | null;
          externa: boolean;
          anexo_path: string | null;
          observacao: string | null;
          criado_por: string | null;
          criado_em: string;
          exame_id: string | null;
        };
        Insert: {
          id?: string;
          otica_id?: string;
          cliente_id: string;
          data_receita?: string;
          tipo?: string;
          medico?: string | null;
          crm?: string | null;
          validade?: string | null;
          externa?: boolean;
          anexo_path?: string | null;
          observacao?: string | null;
          criado_por?: string | null;
          criado_em?: string;
          exame_id?: string | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          cliente_id?: string;
          data_receita?: string;
          tipo?: string;
          medico?: string | null;
          crm?: string | null;
          validade?: string | null;
          externa?: boolean;
          anexo_path?: string | null;
          observacao?: string | null;
          criado_por?: string | null;
          criado_em?: string;
          exame_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receitas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receitas_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receitas_exame_id_fkey";
            columns: ["exame_id"];
            isOneToOne: false;
            referencedRelation: "exames";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receitas_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
        ];
      };
      recursos_adicionais: {
        Row: {
          recurso: string;
          nome: string;
        };
        Insert: {
          recurso: string;
          nome: string;
        };
        Update: {
          recurso?: string;
          nome?: string;
        };
        Relationships: [
        ];
      };
      usuarios: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string | null;
          perfil_id: string;
          nome: string;
          email: string;
          ativo: boolean;
          criado_em: string;
        };
        Insert: {
          id: string;
          otica_id: string;
          loja_id?: string | null;
          perfil_id: string;
          nome: string;
          email: string;
          ativo?: boolean;
          criado_em?: string;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string | null;
          perfil_id?: string;
          nome?: string;
          email?: string;
          ativo?: boolean;
          criado_em?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usuarios_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usuarios_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usuarios_perfil_id_fkey";
            columns: ["perfil_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
        ];
      };
      venda_itens: {
        Row: {
          id: string;
          otica_id: string;
          venda_id: string;
          catalogo_item_id: string | null;
          descricao: string;
          quantidade: number;
          preco_unitario: number;
        };
        Insert: {
          id?: string;
          otica_id: string;
          venda_id: string;
          catalogo_item_id?: string | null;
          descricao: string;
          quantidade: number;
          preco_unitario: number;
        };
        Update: {
          id?: string;
          otica_id?: string;
          venda_id?: string;
          catalogo_item_id?: string | null;
          descricao?: string;
          quantidade?: number;
          preco_unitario?: number;
        };
        Relationships: [
          {
            foreignKeyName: "venda_itens_catalogo_item_id_fkey";
            columns: ["catalogo_item_id"];
            isOneToOne: false;
            referencedRelation: "catalogo_itens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venda_itens_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "venda_itens_venda_id_fkey";
            columns: ["venda_id"];
            isOneToOne: false;
            referencedRelation: "vendas";
            referencedColumns: ["id"];
          },
        ];
      };
      vendas: {
        Row: {
          id: string;
          otica_id: string;
          loja_id: string;
          caixa_id: string | null;
          cliente_id: string | null;
          atendimento_id: string | null;
          vendedor_id: string | null;
          subtotal: number;
          desconto: number;
          total: number;
          cancelada: boolean;
          criado_em: string;
          numero: number | null;
          observacao: string | null;
          cancelada_em: string | null;
          cancelada_por: string | null;
          motivo_cancelamento: string | null;
        };
        Insert: {
          id?: string;
          otica_id: string;
          loja_id: string;
          caixa_id?: string | null;
          cliente_id?: string | null;
          atendimento_id?: string | null;
          vendedor_id?: string | null;
          subtotal: number;
          desconto?: number;
          total: number;
          cancelada?: boolean;
          criado_em?: string;
          numero?: number | null;
          observacao?: string | null;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          motivo_cancelamento?: string | null;
        };
        Update: {
          id?: string;
          otica_id?: string;
          loja_id?: string;
          caixa_id?: string | null;
          cliente_id?: string | null;
          atendimento_id?: string | null;
          vendedor_id?: string | null;
          subtotal?: number;
          desconto?: number;
          total?: number;
          cancelada?: boolean;
          criado_em?: string;
          numero?: number | null;
          observacao?: string | null;
          cancelada_em?: string | null;
          cancelada_por?: string | null;
          motivo_cancelamento?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vendas_atendimento_id_fkey";
            columns: ["atendimento_id"];
            isOneToOne: false;
            referencedRelation: "atendimentos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendas_caixa_id_fkey";
            columns: ["caixa_id"];
            isOneToOne: false;
            referencedRelation: "caixas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendas_cancelada_por_fkey";
            columns: ["cancelada_por"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendas_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendas_loja_id_fkey";
            columns: ["loja_id"];
            isOneToOne: false;
            referencedRelation: "lojas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendas_otica_id_fkey";
            columns: ["otica_id"];
            isOneToOne: false;
            referencedRelation: "oticas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vendas_vendedor_id_fkey";
            columns: ["vendedor_id"];
            isOneToOne: false;
            referencedRelation: "usuarios";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      abrir_caixa: { Args: { p_loja: string | null; p_valor: number | null }; Returns: string };
      acesso: { Args: { modulo: string | null; acao: string | null }; Returns: boolean };
      acesso_algum: { Args: { modulos: string[] | null; acao: string | null }; Returns: boolean };
      agendar_pelo_site: { Args: { p_slug: string | null; p_inicio: string | null; p_nome: string | null; p_telefone: string | null; p_aceite_lgpd: boolean | null }; Returns: boolean };
      caixa_do_operador: { Args: { p_caixa: string | null }; Returns: Database["public"]["Tables"]["caixas"]["Row"] };
      cancelar_venda: { Args: { p_venda: string | null; p_motivo: string | null }; Returns: boolean };
      card_do_exame: { Args: { p_exame: string | null; p_receita: string | null }; Returns: undefined };
      catalogo_balcao: { Args: { p_otica: string | null }; Returns: undefined };
      concluir_exame: { Args: { p_exame: string | null }; Returns: string };
      criar_os_do_atendimento: { Args: { p_atendimento: string | null; p_data_prometida?: string | null }; Returns: string };
      definir_foto_produto: { Args: { p_item: string | null; p_caminho: string | null }; Returns: boolean };
      entrar_lista_espera: { Args: { p_nome: string | null; p_otica: string | null; p_cidade: string | null; p_uf: string | null; p_telefone: string | null; p_email: string | null; p_lojas: number | null; p_aceite_lgpd: boolean | null }; Returns: boolean };
      fechar_caixa: { Args: { p_caixa: string | null; p_contado: number | null; p_observacao?: string | null }; Returns: Json };
      horarios_livres: { Args: { p_slug: string | null; p_dia: string | null }; Returns: { inicio: string; fim: string }[] };
      horarios_ocupados: { Args: { p_loja: string | null; p_dia: string | null }; Returns: { inicio: string; fim: string }[] };
      importar_clientes: { Args: { p_linhas: Json | null }; Returns: Json };
      importar_produtos: { Args: { p_linhas: Json | null }; Returns: Json };
      loja_ou_primeira: { Args: { p_otica: string | null; p_loja: string | null }; Returns: string };
      marcar_comissoes_pagas: { Args: { p_ids: string[] | null }; Returns: number };
      minha_area: { Args: Record<PropertyKey, never>; Returns: string };
      minha_otica: { Args: Record<PropertyKey, never>; Returns: string };
      mover_sem_retorno: { Args: Record<PropertyKey, never>; Returns: number };
      movimentar_caixa: { Args: { p_caixa: string | null; p_tipo: string | null; p_valor: number | null; p_motivo: string | null }; Returns: boolean };
      movimentar_estoque: { Args: { p_item: string | null; p_loja: string | null; p_tipo: string | null; p_quantidade: number | null; p_custo?: number | null; p_motivo?: string | null }; Returns: number };
      pedido_orcamento_site: { Args: { p_slug: string | null; p_nome: string | null; p_telefone: string | null; p_mensagem: string | null; p_aceite_lgpd: boolean | null }; Returns: boolean };
      percentual_comissao: { Args: { p_otica: string | null; p_usuario: string | null; p_categoria: string | null }; Returns: number };
      perfis_por_area: { Args: { p_otica: string | null }; Returns: undefined };
      perfis_v4: { Args: { p_otica: string | null }; Returns: undefined };
      permissoes_consultorio: { Args: { p_otica: string | null }; Returns: undefined };
      permissoes_v3: { Args: { p_otica: string | null }; Returns: undefined };
      proximo_numero: { Args: { p_otica: string | null; p_nome: string | null }; Returns: number };
      recurso_ativo: { Args: { r: string | null }; Returns: boolean };
      registrar_pagamento: { Args: { p_atendimento: string | null; p_valor: number | null; p_forma: string | null; p_parcelas?: number | null; p_sinal?: boolean | null; p_data_prometida?: string | null }; Returns: string };
      registrar_venda: { Args: { p_caixa: string | null; p_cliente: string | null; p_itens: Json | null; p_desconto: number | null; p_pagamentos: Json | null; p_observacao?: string | null }; Returns: string };
      site_da_otica: { Args: { p_slug: string | null }; Returns: { nome: string; titulo: string; sobre: string; endereco: string; whatsapp: string; horario: string; instagram: string; cor: string; logo_url: string; agendamento_online: boolean }[] };
      transferir_estoque: { Args: { p_item: string | null; p_de: string | null; p_para: string | null; p_quantidade: number | null }; Returns: boolean };
    };
    Enums: {
      plano_tipo: "essencial" | "profissional" | "rede";
      otica_status: "teste" | "ativa" | "suspensa" | "cancelada";
      etapa_tipo: "aberta" | "ganha" | "perdida";
      consulta_status: "agendada" | "confirmada" | "compareceu" | "faltou" | "remarcada" | "cancelada";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tabela<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
