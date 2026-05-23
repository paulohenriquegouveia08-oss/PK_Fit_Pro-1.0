# Sistema de Reconhecimento Facial - PK Fit Pro

## Visão Geral

Este documento descreve a implementação do sistema de reconhecimento facial para catracas Control ID no ecossistema PK Fit Pro.

---

## Arquitetura do Sistema

```
pk-fit-web                    Supabase                 pk-fit-agent-v2              Control ID
    │                            │                           │                           │
    │ 1. Upload foto             │                           │                           │
    ├──────────────────────────►│                           │                           │
    │                    2. Salva no Storage              │                           │
    │                    (avatars bucket)                 │                           │
    │                            │                           │                           │
    │ 3. Cria comando           │                           │                           │
    │    SYNC_FACE              │                           │                           │
    ├──────────────────────────►│                           │                           │
    │                            │                           │                           │
    │                            │ 4. Realtime escuta       │                           │
    │                            │◄─────────────────────────┤                           │
    │                            │                           │                           │
    │                            │ 5. Baixa imagem         │                           │
    │                            │    (signed URL)          │                           │
    │                            │◄─────────────────────────┤                           │
    │                            │                           │                           │
    │                            │ 6. Processa imagem       │                           │
    │                            │                           │                           │
    │                            │ 7. Envia para            │                           │
    │                            │    Control ID            │                           │
    │                            │                           │─────────────────────────►│
    │                            │                           │                           │
    │                            │ 8. Control ID            │                           │
    │                            │    cria usuário          │◄──────────────────────────┤
    │                            │    + biometria           │                           │
    │                            │                           │                           │
    │ 9. Atualiza status        │                           │                           │
    │◄──────────────────────────┤                           │                           │
```

---

## Estrutura de Arquivos

### 1. Sistema Web (PK_Fit_Pro) - Pasta: `src/`

#### Arquivo: `src/shared/services/faceSync.service.ts` (NOVA CRIAÇÃO)

Serviço para criar comandos de sincronização facial no banco de dados.

**Funções principais:**
- `createFaceSyncCommand()` - Cria registro na tabela `access_commands`
- `triggerFaceSyncForUser()` - Dispara sincronização para um usuário
- `getFaceSyncStatus()` - Consulta status da sincronização
- `checkAndSyncFace()` - Verifica e dispara sync se necessário

#### Arquivo: `src/features/adminAcademia/pages/Alunos.tsx` (ATUALIZADO)

Página de gerenciamento de alunos.

**Alterações:**
- Adicionado import do `triggerFaceSyncForUser`
- Após criar aluno com foto, dispara comando SYNC_FACE automaticamente

---

### 2. Agent Desktop (pk-fit-agent-v2) - Pasta: `pk-fit-agent-v2/src/main/`

#### Arquivos Criados:

| Arquivo | Descrição |
|---------|-----------|
| `types/user.types.ts` | Tipos para usuário e status de sync |
| `types/command.types.ts` | Tipos para comandos do sistema |
| `utils/retry.ts` | Retry com backoff exponencial |
| `utils/downloadImage.ts` | Download de imagens com signed URLs |
| `processors/imageProcessor.ts` | Processamento e validação de imagens |
| `services/FaceSyncService.ts` | Serviço principal de sincronização facial |
| `queues/faceSyncQueue.ts` | Fila assíncrona para processamento |

#### Arquivo Atualizado:

| Arquivo | Alteração |
|---------|-----------|
| `supabase/listener.ts` | Adicionado suporte ao comando `SYNC_FACE` |

---

## Fluxo Detalhado

### Passo 1: Cadastro de Aluno (Frontend)

1. Admin acessa painel "Alunos" no sistema web
2. Clica em "Novo Aluno"
3. Preenche dados e captura foto via câmera
4. Foto é uploadada para Supabase Storage (bucket `avatars`)
5. URL da foto é salva no campo `photo_url` da tabela `users`
6. Sistema cria comando `SYNC_FACE` na tabela `access_commands`

### Passo 2: Agent Recebe Comando (Supabase Realtime)

1. Agent escuta tabela `access_commands` via Supabase Realtime
2. Quando novo comando `SYNC_FACE` com status `PENDING` é detectado
3. Agent marca status como `SENT`
4. Extrai payload: `{ user_id, user_name, user_photo_url }`

### Passo 3: Processamento da Imagem

1. Agent baixa imagem do Supabase Storage (usando signed URL)
2. Valida formato da imagem (JPEG/PNG/GIF)
3. Processa imagem (resize/compressão se necessário)
4. Converte para formato esperado pela Control ID

### Passo 4: Envio para Control ID

1. Agent conecta na catraca via HTTP
2. Cria usuário na Control ID (ou atualiza se existir)
3. Envia imagem facial via endpoint `/set_user_face.fcgi`
4. Control ID gera template biométrico

### Passo 5: Finalização

1. Agent atualiza status do comando para `COMPLETED`
2. Usuário agora pode liberar acesso via reconhecimento facial

---

## Tabela access_commands

Estrutura do comando criado:

```sql
INSERT INTO access_commands (
    command_type,   -- 'SYNC_FACE'
    academy_id,     -- ID da academia
    user_id,        -- ID do usuário
    payload,        -- JSON com user_id, user_name, user_photo_url
    status          -- 'PENDING' | 'SENT' | 'COMPLETED' | 'FAILED'
) VALUES (
    'SYNC_FACE',
    'academy-uuid',
    'user-uuid',
    '{"user_id": "...", "user_name": "João", "user_photo_url": "https://..."}',
    'PENDING'
);
```

---

## Comandos Suportados

| Comando | Descrição | Origem |
|---------|-----------|--------|
| `GRANT_ACCESS` | Liberar acesso manualmente | Painel Web |
| `DENY_ACCESS` | Negar acesso | Painel Web |
| `SYNC_USERS` | Sincronizar todos os usuários | Painel Web |
| `SYNC_FACE` | Sincronizar biometria facial | Automático |
| `REBOOT` | Reiniciar conexão com catraca | Painel Web |

---

## Configurações do Agent

O agent utiliza as configurações do `config.ts`:

```typescript
interface AgentConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  academyId: string;
  turnstileConfigId: string;
  brand: 'CONTROL_ID' | 'TOP_DATA' | 'HENRY';
  ip: string;
  port: number;
  authUser: string;
  authPassword: string;
}
```

---

## Control ID Adapter (Existente)

O adapter existente em `src/main/adapters/controlid.adapter.ts` já possui:

- `syncUserFace(userId, name, photoUrl)` - Sincroniza usuário + face
- `removeUser(userId)` - Remove usuário
- `grantAccess()` / `denyAccess()` - Controle de acesso
- Polling de eventos de credencial

---

## Status de Sincronização

O `FaceSyncService` mantém estados:

| Status | Descrição |
|--------|-----------|
| `PENDING` | Comando criado, ainda não processado |
| `PROCESSING` | Em andamento |
| `SUCCESS` | Sincronizado com sucesso |
| `FAILED` | Falhou |
| `RETRYING` | Tentando novamente |

---

## Segurança

- **Signed URLs**: Imagens baixadas via URLs temporárias (expiração curta)
- **Session Reuse**: Autenticação na Control ID reutilizada (cache)
- **Retry Automático**: Backoff exponencial em falhas
- **Timeout**: Tempo limite configurável para downloads

---

## Dependências do Agent (package.json)

```json
{
  "@supabase/supabase-js": "^2.102.1",
  "dotenv": "^17.4.1",
  "logback": "^1.0.16"
}
```

---

## Próximos Passos Futuros

1. Adicionar mais adaptadores (Hikvision, Intelbras, TopData)
2. Implementar sincronização em massa (BulkFaceSyncService)
3. Adicionar dashboard de status de sync no frontend
4. Implementar processamento de imagem com Sharp
5. Adicionar health check específico para biometria

---

## Referências

- `agent/` - Antigo agente Node.js (substituído pelo pk-fit-agent-v2)
- `pk-fit-agent-v2/` - Novo agente Electron com biometria
- `src/shared/services/faceSync.service.ts` - Serviço web
- `src/features/adminAcademia/pages/Alunos.tsx` - Página de alunos

---

*Documento gerado em: 15/05/2026*
*Versão do sistema: PK Fit Pro v1.1.0*