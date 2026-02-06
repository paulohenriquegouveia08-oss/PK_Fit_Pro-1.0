# PK Fit Pro - Sistema de Gestão de Academias (SaaS)

O **PK Fit Pro** é uma plataforma SaaS (Software as a Service) completa para gerenciamento de academias. O sistema permite que administradores globais gerenciem múltiplas academias, enquanto cada academia possui seu próprio ambiente para gerenciar professores, alunos e treinos.

## 🚀 Tecnologias Utilizadas

-   **Frontend**: React (Vite)
-   **Linguagem**: TypeScript
-   **Estilização**: CSS Modules / Variáveis CSS (Design System próprio)
-   **Banco de Dados & Auth**: Supabase
-   **Roteamento**: React Router DOM

## 👥 Perfis de Acesso e Funcionalidades

O sistema conta com 4 níveis de acesso hierárquicos:

### 1. Admin Global
O superusuário do sistema, responsável pela gestão do negócio SaaS.
-   **Dashboard Global**: Visão geral de métricas (Total de academias, receita, alunos).
-   **Gestão de Academias**:
    -   Cadastrar novas academias.
    -   Suspender ou ativar acesso de academias.
    -   Acompanhar status de pagamento (Em dia, Pendente, Atrasado).
-   **Financeiro**:
    -   Controle de pagamentos de mensalidades das academias.
    -   Cálculo de receita mensal e inadimplência.

### 2. Admin Academia
O dono ou gerente de uma unidade específica.
-   **Dashboard da Academia**: Métricas locais (Alunos ativos, professores).
-   **Gestão de Professores**: Cadastrar, editar e remover professores.
-   **Gestão de Alunos**: Cadastrar, editar e remover alunos.
-   **Controle de Acesso**: Ativar ou desativar usuários da sua academia.

### 3. Professor
O profissional responsável pelos treinos.
-   **Gestão de Alunos**: Visualizar lista de alunos vinculados.
-   **Criação de Treinos**:
    -   Ferramenta completa para montar fichas de treino (ABC, etc.).
    -   Banco de exercícios personalizável.
    -   **Modo de Edição**: Capacidade de ajustar treinos existentes.
-   **Solicitações de Treino**:
    -   Receber pedidos de mudança de treino dos alunos.
    -   Aprovar ou rejeitar solicitações diretamente pelo painel.

### 4. Aluno
O usuário final da academia.
-   **Meu Treino**: Acesso digital à ficha de treino atualizada.
-   **Solicitar Mudança**: Canal direto para pedir ajustes no treino ao professor (ex: "Quero focar em hipertrofia").
-   **Perfil**: Visualização de dados cadastrais.

## 🛠️ Configuração e Instalação

### Pré-requisitos
-   Node.js instalado.
-   Conta no Supabase (para backend).

### Passo a Passo

1.  **Clone o repositório**
    ```bash
    git clone https://github.com/seu-usuario/pk-fit-pro.git
    cd pk-fit-pro
    ```

2.  **Instale as dependências**
    ```bash
    npm install
    ```

3.  **Configuração de Ambiente**
    Crie um arquivo `.env` na raiz do projeto com as credenciais do Supabase:
    ```env
    VITE_SUPABASE_URL=sua_url_do_supabase
    VITE_SUPABASE_ANON_KEY=sua_chave_anonima
    ```

4.  **Configuração do Banco de Dados**
    Execute os scripts SQL localizados na pasta `supabase/` no editor SQL do Supabase para criar as tabelas e políticas de segurança (RLS).

5.  **Rodar o projeto**
    ```bash
    npm run dev
    ```

## 🔒 Segurança

-   **Autenticação Robusta**: Login seguro via Supabase Auth.
-   **Row Level Security (RLS)**: Cada usuário só acessa os dados permitidos para seu nível de permissão (ex: um aluno não vê dados de outro aluno, uma academia não acessa dados da concorrente).

---
Desenvolvido com foco em performance e usabilidade.
