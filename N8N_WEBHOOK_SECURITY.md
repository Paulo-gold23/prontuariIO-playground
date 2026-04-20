# 🔐 Task #16 — Proteção dos Webhooks n8n
**Workflow:** Prontuario_AI_FINAL (IewE4EVkamdV7adX)

## Situação Atual

O frontend **já envia** o header `Authorization: Bearer <JWT>` em todas as chamadas via `getAuthHeaders()`.
O que falta é o **n8n validar** esse token antes de processar o fluxo.

## Estratégia

Adicionar um **Code node** logo após cada node Webhook com o código abaixo.
Se o token for inválido ou ausente → responde 401 e para o fluxo.

---

## Código de Validação (copiar para cada webhook)

```javascript
// ============================================================
// WEBHOOK SECURITY GATE — Cole após cada node Webhook
// Valida o header Authorization: Bearer <JWT Supabase>
// ============================================================
const headers = $input.first().json.headers || {};
const authHeader = headers['authorization'] || headers['Authorization'] || '';

// Extrai o token
const token = authHeader.replace(/^Bearer\s+/i, '').trim();

if (!token) {
  // Sem token — rejeita imediatamente
  return [{
    json: {
      error: 'Unauthorized',
      message: 'Authorization header ausente ou inválido.',
      status: 401
    }
  }];
}

// Decodifica o payload do JWT (sem verificar assinatura — validação leve)
// Para validação criptográfica completa, use a Supabase Admin API
try {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('JWT malformado');
  
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  
  // Verifica expiração
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return [{
      json: { error: 'Unauthorized', message: 'Token expirado.', status: 401 }
    }];
  }
  
  // Verifica issuer do Supabase
  if (!payload.iss || !payload.iss.includes('supabase')) {
    return [{
      json: { error: 'Unauthorized', message: 'Token não é do Supabase.', status: 401 }
    }];
  }

  // Passa o user_id para os próximos nodes
  return [{
    json: {
      ...($input.first().json),
      _auth: {
        user_id: payload.sub,
        email: payload.email,
        role: payload.role,
        valid: true
      }
    }
  }];
  
} catch (err) {
  return [{
    json: { error: 'Unauthorized', message: 'Token inválido: ' + err.message, status: 401 }
  }];
}
```

---

## Passo a Passo no n8n (Interface Gráfica)

> Tempo estimado: 20 minutos

### Para cada um dos 6 webhooks:

1. Abra o workflow **Prontuario_AI_FINAL**
2. Clique no node Webhook (ex: `novaConsulta`)
3. Clique em **"+"** para adicionar um node após ele
4. Busque por **"Code"**
5. Cole o código acima no campo de código
6. Renomeie o node: `[auth_gate] novaConsulta`
7. Conecte a saída do Code node ao próximo node existente

### Webhooks para proteger:
| Webhook | Ação |
|---------|------|
| `novaConsulta` | ✅ Proteger (envia áudio + dados sensíveis) |
| `aprovarConsulta` | ✅ Proteger (gera PDF e finaliza consulta) |
| `webhookListarConsultas` | ✅ Proteger (retorna dados clínicos) |
| `cadastroPaciente` | ✅ Proteger (cria paciente no banco) |
| `webhookExcluir` | ✅ Proteger (deleta paciente) |
| `listarPacientes` | ⚠️ Opcional (dados menos sensíveis) |

### Adicionar Resposta 401 (nó de erro)

Após cada `auth_gate`, adicione um **If node**:
- Condição: `{{ $json.error }}` é igual a `"Unauthorized"`
- Se **true** → adicione um **Respond to Webhook** com:
  - Status Code: `401`
  - Body: `{{ $json }}`
- Se **false** → conecta ao fluxo normal

---

## Verificação

Teste chamando o webhook sem o header Authorization:
```bash
curl -X GET https://n8n.srv1181762.hstgr.cloud/webhook/listarPacientes
# Deve retornar 401 Unauthorized
```

Teste com token válido (copiar do DevTools → Application → Supabase JWT):
```bash
curl -X GET https://n8n.srv1181762.hstgr.cloud/webhook/listarPacientes \
  -H "Authorization: Bearer SEU_JWT_AQUI"
# Deve retornar os dados normalmente
```

---

## Status

- [x] Frontend já envia JWT em todas as chamadas via `getAuthHeaders()`
- [ ] n8n: Adicionar Code nodes de validação (manual — API muito lenta para automatizar)
- [ ] Testar 401 em chamadas sem header

> **Nota:** A API do n8n retornou timeout ao tentar modificar o workflow automaticamente (payload >1MB).
> A configuração manual na interface gráfica é mais segura e leva ~20 minutos.
