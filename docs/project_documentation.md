# MineBot - Documentação do Projeto

> **Data**: 14 de Fevereiro de 2026  
> **Status**: Em desenvolvimento ativo - Sistema de Evolução em execução

---

## 1. Visão Geral

O **MineBot** é um bot para Minecraft Bedrock Edition que aprende a se movimentar através de **aprendizado por imitação** e **algoritmos evolutivos**. O objetivo final é criar um bot que consiga andar, explorar e interagir com o mundo de forma autônoma.

### Objetivos Principais
1. Bot conseguir andar de forma autônoma
2. Aprender movimentos através de gravações de jogadores reais
3. Usar algoritmo evolutivo para descobrir parâmetros de movimento

---

## 2. Transição de Ferramentas

### Antes
- **IDE**: Google Project IDX (Antigravity)
- **AI Assistant**: Google Gemini

### Depois
- **IDE**: VS Code
- **AI Assistant**: Claude Opus 4.5 (GitHub Copilot)
- **Extensão**: GitHub Copilot Chat

### Motivo da Mudança
Migração para ambiente local com melhor integração de ferramentas e assistente de IA mais avançado para tarefas de programação complexas.

---

## 3. Arquitetura do Sistema

```
MineBot/
├── bots/                    # Scripts executáveis
│   ├── walker.js            # Bot de caminhada autônoma
│   ├── replay.js            # Bot de replay de gravações
│   └── evolution.js         # Runner do algoritmo evolutivo
│
├── src/
│   ├── client/
│   │   └── BaseBot.js       # Classe base para todos os bots
│   │
│   ├── movement/
│   │   ├── MovementController.js  # Loop de movimento 20Hz
│   │   ├── PhysicsEngine.js       # Simulação de física
│   │   └── InputGenerator.js      # Geração de flags de input
│   │
│   └── evolution/
│       ├── Genome.js              # Representação genética
│       ├── Episode.js             # Execução de episódio
│       └── EvolutionEngine.js     # Motor evolutivo
│
├── tools/
│   └── gateway.js           # Proxy para gravação de pacotes
│
├── recordings/              # Gravações de sessões
│   └── *.jsonl              # Arquivos de pacotes gravados
│
└── bedrock-server-1.26.0.2/ # Servidor Bedrock dedicado
```

---

## 4. Componentes Principais

### 4.1 BaseBot (`src/client/BaseBot.js`)
Classe base que gerencia:
- Conexão com servidor via `bedrock-protocol`
- Estado do bot (posição, spawn, tick)
- Handlers para pacotes do servidor (`start_game`, `move_player`, `correct_player_move_prediction`)

### 4.2 MovementController (`src/movement/MovementController.js`)
- Loop de movimento a 20 ticks/segundo (50ms)
- Construção de pacotes `player_auth_input`
- Integração com InputGenerator e PhysicsEngine

### 4.3 InputGenerator (`src/movement/InputGenerator.js`)
Gera flags de input como BigInt:
```javascript
INPUT_BASE = 281474976710656n    // Base value
INPUT_UP = 1n << 10n             // Forward (W key)
INPUT_VERTICAL_COLLISION = 1n << 50n  // On ground
```

### 4.4 PhysicsEngine (`src/movement/PhysicsEngine.js`)
Simulação client-side:
- Gravidade: 0.08 blocks/tick²
- Velocidade de caminhada: 0.1 blocks/tick
- Detecção de colisão com chão

---

## 5. Sistema de Evolução

### 5.1 Motivação
Após várias tentativas manuais de configurar os parâmetros de movimento, optamos por usar **otimização black-box** através de algoritmo evolutivo para descobrir automaticamente os valores corretos.

### 5.2 Genome (`src/evolution/Genome.js`)
Representação genética com dois tipos de parâmetros:

#### Parâmetros Técnicos (estrutura do pacote)
| Gene | Tipo | Range | Descrição |
|------|------|-------|-----------|
| `useUpFlag` | boolean | - | Usar flag UP (bit 10) |
| `useVerticalCollision` | boolean | - | Usar flag VERTICAL_COLLISION (bit 50) |
| `useWantUp` | boolean | - | Usar flag WANT_UP (bit 16) |
| `deltaMultiplierX` | float | [0, 0.3] | Multiplicador delta X |
| `deltaMultiplierZ` | float | [0, 0.3] | Multiplicador delta Z |
| `deltaY` | float | [-0.15, 0.05] | Delta Y (gravidade) |
| `moveVectorZ` | float | [0, 1] | move_vector.z |
| `rawMoveVectorZ` | float | [0, 1] | raw_move_vector.z |
| `updatePositionFromDelta` | boolean | - | Atualizar posição do delta |
| `positionLerpFactor` | float | [0, 1] | Fator de interpolação |
| `tickIncrement` | int | [0, 3] | Incremento do tick |

#### Parâmetros Comportamentais
| Gene | Tipo | Range | Descrição |
|------|------|-------|-----------|
| `turnRate` | float | [-10, 10] | Taxa de rotação |
| `turnPeriod` | int | [5, 100] | Período entre rotações |
| `walkProbability` | float | [0, 1] | Probabilidade de andar |
| `preferredDirection` | float | [0, 360] | Direção inicial |

### 5.3 Episode (`src/evolution/Episode.js`)
Executa um episódio de avaliação:
1. Conecta bot ao servidor
2. Aplica genes do genoma aos parâmetros de movimento
3. Mede distância máxima do spawn
4. Retorna fitness (distância + bônus)

### 5.4 EvolutionEngine (`src/evolution/EvolutionEngine.js`)
Gerencia o processo evolutivo:
- **Seleção**: Tournament selection (3 candidatos)
- **Crossover**: Uniform crossover entre genes
- **Mutação**: Gaussian para floats, flip para booleans
- **Elitismo**: Mantém os N melhores

### 5.5 Executando a Evolução
```bash
# Teste rápido
node bots/evolution.js --population=10 --generations=20 --duration=3000

# Descoberta (recomendado)
node bots/evolution.js --population=20 --generations=30 --duration=5000

# Refinamento
node bots/evolution.js --population=30 --generations=50 --duration=8000
```

---

## 6. Descobertas Técnicas

### 6.1 Análise de Pacotes Reais
Analisando gravações de jogadores reais, descobrimos:

```javascript
// Valor de input_data quando o jogador anda para frente
input_data._value = 1407374883554304

// Decomposição:
//   Base:               281474976710656n (bit 48)
//   + UP:               1024n (bit 10)
//   + VERTICAL_COLLISION: 1125899906842624n (bit 50)
```

### 6.2 Estrutura do Pacote `player_auth_input`
```javascript
{
    pitch: 0,
    yaw: 0,
    position: { x, y, z },
    move_vector: { x: 0, z: 1 },  // 1 = forward
    head_yaw: 0,
    input_data: BigInt,  // Flags combinadas
    input_mode: 'mouse',
    play_mode: 'screen',
    interaction_model: 'touch',
    tick: BigInt,  // Server tick
    delta: { x, y, z },  // Movimento no tick
}
```

### 6.3 Portas de Conexão
- **19132**: Servidor Bedrock (conexão direta do bot)
- **19134**: Gateway/Proxy (para gravação)

---

## 7. Status Atual

### ✅ Concluído
- [x] Documentação de transição de ferramentas
- [x] Refatoração modular completa
- [x] BaseBot com gerenciamento de estado
- [x] MovementController com loop 20Hz
- [x] PhysicsEngine básico
- [x] InputGenerator com flags corretas
- [x] Sistema de evolução (Genome, Episode, Engine)
- [x] Runner de evolução com logging

### 🔄 Em Progresso
- [ ] Evolução rodando (população 20, 30 gerações)
- [ ] Descoberta de parâmetros ótimos

### ⏳ Próximos Passos
- [ ] Analisar resultados da evolução
- [ ] Aplicar melhor genoma ao walker
- [ ] Testar movimento visual no jogo
- [ ] Implementar comportamentos mais complexos

---

## 8. Como Usar

### Iniciar Servidor
```powershell
cd bedrock-server-1.26.0.2
./bedrock_server.exe
```

### Rodar Walker Bot
```bash
node bots/walker.js
```

### Rodar Evolução
```bash
node bots/evolution.js --population=20 --generations=30 --duration=5000
```

### Verificar Resultado
O melhor genoma é salvo em `recordings/best_genome_*.json`

---

## 9. Dependências

```json
{
  "bedrock-protocol": "^3.53.0"
}
```

### Instalação
```bash
npm install
```

---

## 10. Referências

- [bedrock-protocol](https://github.com/PrismarineJS/bedrock-protocol)
- [Minecraft Bedrock Protocol Docs](https://wiki.vg/Bedrock_Protocol)
- [Documentação interna](docs/)

---

*Documentação gerada em 14/02/2026*
