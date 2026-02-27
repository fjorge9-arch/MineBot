# Diário de Troubleshooting - Problemas de Conexão do Proxy

## O Problema
**Data**: 14/02/2026
**Sintoma**: O Proxy (Gateway) não conecta. O cliente Minecraft exibe "Falha na conexão" ou "Não foi possível conectar ao mundo".
**Contexto**: O sistema funcionou no dia anterior com o script `proxy.js` (agora arquivado), mas falha com o novo `gateway.js`.

## Investigação

### 1. Comparação de Código (Old vs New)
Estamos comparando `archive/proxy.js` (versão funcional) com `gateway.js` (versão atual).

**Diferenças Identificadas:**
- (A preencher após análise)

### 2. Status da Rede
- Porta Servidor: 19132 (UDP) - OK (Netstat confirmado)
- Porta Gateway: 19134 (UDP) - Falhava em manter aberta (Corrigido com keep-alive)
- Loopback Exemption: Re-aplicado.

### 3. Hipóteses
1. **Falha silenciosa do Processo**: (Descartada - Keep-alive resolveu).
2. **Versão do Protocolo**: O servidor aparece na lista (Ping OK), mas falha ao entrar. Isso indica falha no Handshake por incompatibilidade de versão.
   - Cliente: 1.26.x
   - Proxy: 1.26.0
   - **Solução**: Mudar `version` para `'*'` (wildcard).

## Soluções Tentadas

### Solução A: Keep-Alive
O script `gateway.js` encerrava imediatamente. Adicionamos `setInterval` para manter o event loop ativo.
**Resultado**: O processo fica rodando e a porta abre. O servidor aparece na lista do jogo.

### Solução B: Versão Wildcard (*)
Mudamos `version: '1.26.0'` para `version: '*'` no `gateway.js`.
**Motivo**: Se a versão do cliente for ligeiramente diferente, a biblioteca recusa a conexão.
**Resultado**: (Aguardando teste do usuário)
