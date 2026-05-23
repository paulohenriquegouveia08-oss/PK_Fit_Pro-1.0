# PK Fit Agent - Módulo de Reconhecimento Facial

## Visão Geral

Este módulo implementa a integração de reconhecimento facial com catracas Control ID no agente da academia.

## Arquitetura

```
agent/
├── src/
│   ├── adapters/
│   │   ├── IBaseAdapter.ts      # Interface base para adaptadores
│   │   ├── ControlIdAdapter.ts  # Implementação Control ID
│   │   └── AdapterFactory.ts   # Factory para criar adaptadores
│   │
│   ├── services/
│   │   ├── FaceSyncService.ts       # Serviço de sincronização facial
│   │   └── BulkFaceSyncService.ts   # Sincronização em massa
│   │
│   ├── processors/
│   │   └── imageProcessor.ts  # Processamento de imagens
│   │
│   ├── utils/
│   │   ├── downloadImage.ts   # Download de imagens (com signed URL)
│   │   └── retry.ts          # Retry com backoff exponencial
│   │
│   ├── queues/
│   │   └── faceSyncQueue.ts  # Fila de sincronização
│   │
│   ├── types/
│   │   ├── user.types.ts     # Tipos de usuário
│   │   └── command.types.ts # Tipos de comandos
│   │
│   ├── config/
│   │   ├── logger.ts         # Logger estruturado
│   │   ├── constants.ts      # Constantes da aplicação
│   │   └── agentConfig.ts    # Gerenciador de configurações
│   │
│   └── index.ts             # Entrada principal do agente
```

## Fluxo de Sincronização Facial

1. Usuário cadastra foto no painel admin → salva no Supabase Storage
2. Backend cria comando `SYNC_FACE` na tabela `access_commands`
3. Agent faz polling e recebe o comando
4. Agent baixa imagem do Storage (via signed URL)
5. Agent processa imagem (redimensiona, converte para JPEG)
6. Agent valida formato e tamanho da imagem
7. Agent conecta na Control ID
8. Agent cria usuário na catraca (se não existir)
9. Agent valida imagem facial
10. Agent cadastra template biométrico
11. Usuário liberado via reconhecimento facial

## Instalação

```bash
cd agent
npm install
npm run build
```

## Configuração

O agente pode ser configurado via:

- Variáveis de ambiente (`.env`)
- Arquivo de configuração (`agent-config.json`)
- Código de pareamento (via terminal)

## Comandos Suportados

| Comando | Descrição |
|---------|-----------|
| GRANT_ACCESS | Liberar acesso |
| DENY_ACCESS | Negar acesso |
| SYNC_USERS | Sincronizar usuários |
| SYNC_FACE | Sincronizar face (NOVO) |
| REBOOT | Reiniciar conexão |

## API Control ID

O adapter implementa as seguintes operações:

- `login.fcgi` - Autenticação
- `create_objects.fcgi` - Criar usuário
- `user_set_image.fcgi` - Cadastrar face
- `user_test_image.fcgi` - Validar face
- `user_destroy_image.fcgi` - Remover face
- `execute_actions.fcgi` - Abrir porta

## Segurança

- URLs temporárias (signed URLs) com expiração curta
- Sessão reutilizada com cache
- Retry automático com backoff
- Validação de imagem antes do envio
- Timeout configurável

## Escalar para Outros Fabricantes

A arquitetura permite adicionar novos adaptadores:

```typescript
import { AdapterFactory } from './adapters/AdapterFactory.js';

const adapter = AdapterFactory.createAdapter({
    type: 'hikvision', // ou 'intelbras', 'topdata', etc
    baseUrl: 'http://...',
    username: '...',
    password: '...'
});
```

## Monitoramento

O agente expõe estatísticas da fila:

```typescript
import { getQueueStats } from './queues/faceSyncQueue.js';

const stats = getQueueStats();
// { pending: 5, running: 2, completed: 10, failed: 1 }
```

## Logs

Logs estruturados com Pino:

- Timeout de conexão
- Falha de autenticação
- Face inválida
- Falha de upload
- Erro HTTP
- Catraca offline
- Retry
- Falha de processamento