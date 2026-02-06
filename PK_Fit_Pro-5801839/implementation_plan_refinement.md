# Refinamento da Gestão de Academias - Plano de Implementação

## Problema
O sistema atual permite desativar uma academia, mas esse status pode não impedir efetivamente o login do usuário, especialmente "na etapa do email", conforme solicitado. Além disso, precisamos garantir que a criação/exclusão de academias siga regras firmes (criação atômica, exclusão em cascata completa).

## Mudanças Propostas

### 1. Desativação de Academia (Backend/Serviço)
- **Objetivo**: Quando uma academia for desativada/suspensa, seu usuário administrador (e potencialmente todos os membros) deve ser impedido de fazer login.
- **Abordagem**:
  - Atualizar `updateAcademyStatus` em `academy.service.ts`.
  - Quando o status mudar para `INACTIVE` ou `SUSPENDED`, atualizar automaticamente o status `is_active` do **Usuário Administrador** vinculado para `false`.
  - Inversamente, se reativada (`ACTIVE`), definir `is_active` do administrador para `true`.
  - *Nota*: Poderíamos desativar alunos/professores também, mas bloquear o administrador é o requisito principal. O bloqueio da academia em si deve ser verificado no login.

### 2. Fluxo de Login (Serviço de Autenticação)
- **Objetivo**: "Identificar se está bloqueado já na parte do email".
- **Abordagem**:
  - Atualizar `checkEmail` em `auth.service.ts`.
  - Atualmente, ele apenas verifica se o email existe.
  - Modificá-lo para verificar também:
    1. O usuário está ativo (`is_active`)?
    2. O status da Academia do usuário está ativo?
  - Se algum for falso, retornar uma flag de erro específica (ex: `isBlocked: true`).
  - Atualizar `LoginPage.tsx` para tratar essa flag e mostrar "Acesso Negado" imediatamente, impedindo a etapa da senha.

### 3. Revisão de Criação/Exclusão
- **Criação**: Confirmar que o RPC `create_academy_with_user` está sendo usado (Já feito na etapa anterior).
- **Exclusão**: Confirmar que `deleteAcademy` remove das tabelas públicas/auth (Já feito).

## Alterações Detalhadas no Código

### `src/shared/services/academy.service.ts`
- Modificar `updateAcademyStatus`:
  - Buscar o usuário administrador da academia.
  - Atualizar a tabela `users` definindo `is_active` correspondente ao status da academia (Ativo -> true, Inativo/Suspenso -> false).

### `src/shared/services/auth.service.ts`
- Modificar `checkEmail`:
  - Fazer join com `academy_users` e `academies` para buscar o status.
  - Retornar `{ exists, hasPassword, isBlocked, blockReason }`.

### `src/features/auth/LoginPage.tsx`
- Atualizar `handleEmailSubmit`:
  - Verificar `result.data.isBlocked`.
  - Se verdadeiro, mostrar erro "Acesso bloqueado: Academia inativa ou suspensa" e parar.

## Plano de Verificação
1. **Teste de Desativação**:
   - Criar uma academia.
   - Logar como seu administrador (Sucesso).
   - Logar como Admin Global e "Suspender" a academia.
   - Tentar logar como o administrador da academia novamente.
   - **Expectativa**: Após digitar o email, o sistema diz "Conta bloqueada" e não pede a senha.
2. **Teste de Exclusão**:
   - Excluir a academia.
   - Verificar se os usuários sumiram das tabelas Auth e Pública.
