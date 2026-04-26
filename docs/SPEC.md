# MineBot — Especificação do Projeto

## Visão

Um bot autônomo para Minecraft Bedrock que aprende a se comportar no jogo sem programação manual de regras. O servidor Bedrock é autoritativo: o bot só existe se enviar pacotes `player_auth_input` corretos a 20Hz. O objetivo é usar **algoritmos evolutivos** para descobrir automaticamente os parâmetros de comportamento que produzem movimento eficaz e, futuramente, tarefas complexas.

---

## Objetivos Comportamentais (por fase)

### Fase 1 — Locomoção estável ✅ (concluída)
O bot consegue:
- Conectar ao servidor e spawnar sem ser desconectado
- Andar para frente sem receber correções constantes do servidor
- Manter `delta`, `position` e `input_data` sincronizados com a física real do Bedrock
- Cobrir pelo menos **3 blocos** em 30 segundos

**Critério de sucesso:** walker bot roda 30 segundos com < 5 correções do servidor e percorre > 3 blocos.

**Resultado verificado:** 55.78 blocos, 0 correções (2026-04-25).

---

### Fase 2 — Exploração inteligente 🔄 (próxima)
O bot consegue:
- Explorar o mundo sem ficar preso em paredes ou loops
- Detectar e desviar de obstáculos (mudança de direção ao colidir)
- **Detectar quando está preso** em buraco ou depressão de terreno e escapar
- Cobrir **área** em vez de andar em linha reta
- Retornar ao caminho após receber correção do servidor

**Critério de sucesso:** em 60 segundos, o bot visita células distintas de uma grade 5×5 ao redor do spawn. Fitness = número de células únicas visitadas.

**Sinal de "preso":** posição X/Z varia menos de 0.5 blocos em 40 ticks consecutivos (2 segundos) apesar de `walkProbability > 0.5`. Resposta esperada: pular + rotação aleatória de 90°–180°.

---

### Fase 3 — Sobrevivência e navegação 📋 (planejada)
> Escopo limitado a **Peaceful** — sem mobs agressivos.

O bot consegue:
- Não cair em buracos (detectar queda iminente via Y)
- Subir e descer escadas/rampas
- Nadar (detectar estar na água via velocidade vertical e ajustar input)
- Manter-se vivo por pelo menos **5 minutos** (quedas e afogamento são os únicos riscos)

**Critério de sucesso:** bot sobrevive 5 minutos sem morrer em modo Survival Peaceful.

---

### Fase 4 — Coleta de recursos 📋 (futura)
> Tarefa concreta: há uma árvore diretamente atrás do spawn point.

O bot consegue:
- Virar ~180° a partir da direção de spawn para encarar a árvore
- Caminhar até a base da árvore
- Minerar os blocos de madeira (enviar `inventory_transaction` do tipo `destroy_block`)
- Confirmar coleta via pacote de item no inventário

**Critério de sucesso:** bot coleta pelo menos 1 bloco de madeira da árvore em < 60 segundos após spawnar.

**Sequência esperada:**
1. Spawn → girar 180° (yaw ± 180°)
2. Andar até a árvore (detectar proximidade via posição)
3. Olhar para o bloco de tronco mais próximo (ajustar pitch)
4. Enviar sequência de mineração até o bloco quebrar
5. Confirmar item coletado no inventário

---

## Função de Fitness

A fitness atual (distância máxima do spawn) é adequada para a Fase 1 mas insuficiente para as demais. A função evolui conforme as fases:

### Fase 1 (atual)
```
fitness = serverMaxDistance
        + bonuses(1, 5, 10 blocos)
        - correctionCount × 0.05
```

### Fase 2 (proposta)
```
fitness = uniqueCellsVisited × 2          // área explorada (grade 10×10)
        + serverMaxDistance × 0.5         // distância ainda conta
        - correctionCount × 0.1           // penalidade maior por dessincronia
        - stuckPenalty                    // penalidade se ficar parado > 5s
```

### Fase 3 (proposta)
```
fitness = survivalTime / 10               // segundos sobrevividos (quedas/afogamento)
        + uniqueCellsVisited              // exploração
        - deathPenalty × 50              // morte zera a rodada
// Nota: sem penalidade de mobs (modo Peaceful)
```

---

## Arquitetura Técnica

```
MineBot/
├── bots/
│   ├── walker.js           Locomoção autônoma (Fase 1, referência)
│   ├── evolution.js        Runner do algoritmo genético
│   └── evolved_walker.js   Executa o melhor genoma salvo
│
├── src/
│   ├── client/
│   │   └── BaseBot.js      Conexão, estado de jogo, eventos de pacote
│   │
│   ├── movement/
│   │   ├── PhysicsEngine.js     Simulação de física client-side (calibrada)
│   │   ├── MovementController.js Loop 20Hz, envia player_auth_input
│   │   └── InputGenerator.js    Constrói input_data (BigInt flags)
│   │
│   ├── evolution/
│   │   ├── Genome.js            Representação dos genes comportamentais
│   │   ├── Episode.js           Avalia um genoma por N segundos no servidor
│   │   └── EvolutionEngine.js   Seleção por torneio, crossover, mutação
│   │
│   └── utils/
│       └── helpers.js      cameraOrientation, distance2D, getNewestFile
│
└── tools/
    ├── gateway.js          Proxy MITM para gravar sessões reais
    └── compare_packets.js  Valida física do bot contra gravações reais
```

---

## Contratos de Módulo

### BaseBot
- **Entrada:** `{ host, port, username, version }`
- **Saída (eventos):** `spawn`, `start_game`, `move_correction`, `move_player`, `error`, `end`
- **Invariante:** `bot.state.serverTick` incrementa 1 por tick enviado

### PhysicsEngine
- **Entrada:** `tick(yaw, intent)` onde `intent = { forward, backward, left, right, jump, sprint, sneak }`
- **Saída:** `delta { x, y, z }` — deslocamento deste tick, para enviar no pacote
- **Invariante:** `delta.y = -0.0784` quando no chão e parado (gravidade real do Bedrock)
- **Constantes medidas de gravações reais:**
  - `GROUND_FRICTION = 0.535`
  - `GRAVITY = 0.08` blocos/tick²
  - `VERTICAL_DRAG = 0.98`

### MovementController
- **`start()`** — inicia loop 20Hz
- **`onTick`** — callback chamado no início de cada tick (antes da física). Use para comportamento.
- **`moveForward()`, `stopMoving()`, `setSprint(bool)`, `jump()`** — controlam `intent`
- **Invariante:** comportamento e física são sempre síncronos (mesmo tick)

### Genome
**Genes comportamentais:**

| Gene | Range | Descrição |
|------|-------|-----------|
| `walkProbability` | [0.1, 1.0] | Probabilidade de andar neste tick |
| `sprintProbability` | [0.0, 0.5] | Probabilidade de sprinting |
| `sneakProbability` | [0.0, 0.3] | Probabilidade de agachar |
| `jumpProbability` | [0.0, 0.15] | Probabilidade de pular |
| `jumpInterval` | [10, 200] ticks | Intervalo mínimo entre pulos |
| `turnRate` | [-10, 10] °/período | Graus girados por período |
| `turnPeriod` | [5, 200] ticks | Período de rotação |
| `directionChangeProbability` | [0.0, 0.1] | Jitter aleatório de direção |
| `preferredDirection` | [0, 360] ° | Direção inicial de spawn |

**Genes de protocolo** (permitem a evolução explorar flags):

| Gene | Tipo | Default |
|------|------|---------|
| `useUpFlag` | bool | true |
| `useVerticalCollision` | bool | true |
| `useWantUp` | bool | false |

### Episode
- Conecta um genoma ao servidor por `duration` ms
- Mede fitness usando posição reportada pelo servidor (não física local)
- Penaliza correções: `fitness -= correctionCount × 0.05`
- Cleanup automático ao terminar (fecha conexão)

### EvolutionEngine
- **Seleção:** torneio de tamanho 3
- **Elitismo:** 2 melhores passam intactos para próxima geração
- **Crossover:** gene a gene, 50% de cada pai
- **Mutação:** gaussiana com força por gene; todo gene tem chance `mutationRate` por geração

---

## Protocolo de Pacotes

O bot envia `player_auth_input` a cada 50ms (20Hz):

```javascript
{
    pitch, yaw,
    position:           { x, y, z },        // posição prevista pelo PhysicsEngine
    delta:              { x, y, z },        // saída direta do PhysicsEngine.tick()
    move_vector:        { x, z },           // -1/0/1 por direção
    head_yaw:           yaw,
    input_data:         BigInt,             // flags construídas pelo InputGenerator
    input_mode:         'mouse',
    play_mode:          'screen',
    interaction_model:  'touch',
    interact_rotation:  { x: pitch, z: yaw },
    tick:               BigInt,             // serverTick incrementado pelo bot
    camera_orientation: { x, y, z },        // vetor forward calculado de yaw+pitch
    analogue_move_vector: { x: 0, z: 0 },
    raw_move_vector:    { x, z }
}
```

**Flags de `input_data` relevantes:**

| Flag | Bit | Quando setar |
|------|-----|--------------|
| `UP` (W) | 10 | Andando para frente |
| `DOWN` (S) | 11 | Andando para trás |
| `LEFT` (A) | 12 | Estrafando esquerda |
| `RIGHT` (D) | 13 | Estrafando direita |
| `JUMP` | 4 | Pulando |
| `SPRINT` | 7 | Sprinting |
| `SNEAK` | 8 | Agachando |
| `VERTICAL_COLLISION` | 50 | No chão após física |
| `BASE` | 48 | Sempre |

---

## Ciclo Evolutivo

```
1. Inicializar população (N genomas aleatórios)
2. Para cada geração:
   a. Avaliar cada genoma (episódio no servidor)
   b. Ordenar por fitness (decrescente)
   c. Salvar melhor genoma em disco
   d. Criar próxima geração:
      - Copiar elite (2 melhores)
      - Preencher restante com crossover + mutação
3. Parar quando atingir targetFitness ou maxGenerations
4. Melhor genoma salvo em recordings/best_genome_*.json
```

---

## Ferramentas de Validação

| Ferramenta | Uso |
|------------|-----|
| `tools/compare_packets.js` | Compara delta/input_data do bot contra gravação real tick a tick |
| `tools/gateway.js` | Proxy MITM que grava sessões reais do cliente Minecraft |
| `bots/walker.js` | Referência de comportamento (não evolutivo) |

Para validar a física após mudanças:
```bash
node tools/compare_packets.js --skip=5 --ticks=30
```

---

## Configuração do Servidor

| Parâmetro | Valor | Motivo |
|-----------|-------|--------|
| `online-mode` | false | Bots não autenticam no Xbox Live |
| `difficulty` | peaceful | Sem mobs durante evolução |
| `allow-cheats` | true | Permite teleporte para reset |
| `server-authoritative-movement-strict` | false | Aceita posições do cliente com mais tolerância |
| `player-position-acceptance-threshold` | 0.5 | Margem antes de enviar correção |

---

## Roadmap

- [ ] Fase 1: Locomoção estável (walker + physics calibrada)
- [ ] Sistema evolutivo funcional (genomas, episódios, engine)
- [ ] Compatibilidade com Bedrock 1.26.14 (protocolo 944)
- [ ] Fase 2: Fitness de área explorada
- [ ] Fase 2: Detecção de obstáculos (sensor de colisão via correções do servidor)
- [ ] Fase 3: Sobrevivência em modo Survival
- [ ] Fase 4: Navegação até coordenada-alvo
- [ ] Interface de monitoramento (progresso da evolução em tempo real)
