# MineBot

Bot autônomo para **Minecraft Bedrock Edition** que aprende a se movimentar através de **algoritmos evolutivos** e **aprendizado por imitação**.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Minecraft](https://img.shields.io/badge/Minecraft%20Bedrock-1.26.x-brightgreen)
![Status](https://img.shields.io/badge/Status-Em%20Desenvolvimento-yellow)

---

## Sobre o Projeto

O MineBot é um projeto experimental que usa **otimização black-box** via algoritmo evolutivo para descobrir automaticamente os parâmetros corretos de movimento em Minecraft Bedrock. O servidor Bedrock é autoritativo sobre o movimento do jogador, então o bot precisa enviar pacotes `player_auth_input` com valores específicos de `input_data`, `delta`, e `position` para que o servidor aceite o movimento.

### Abordagens Implementadas

| Abordagem | Descrição | Status |
|-----------|-----------|--------|
| **Replay Bot** | Reproduz gravações de jogadores reais | ✅ Funciona |
| **Walker Bot** | Movimento autônomo com física simulada | 🔄 Em teste |
| **Evolution Bot** | Descobre parâmetros via algoritmo genético | 🔄 Em teste |
| **Imitator Bot** | Replay com offset de coordenadas | ⚠️ Instável |

---

## Arquitetura

```
MineBot/
├── bots/                        # Bots executáveis
│   ├── evolution.js             # Runner do algoritmo evolutivo
│   ├── walker.js                # Bot de caminhada autônoma
│   ├── replay.js                # Replay de gravações
│   └── evolved_walker.js        # Walker com genoma otimizado
│
├── src/                         # Módulos principais
│   ├── client/
│   │   └── BaseBot.js           # Classe base (conexão, estado, eventos)
│   │
│   ├── movement/
│   │   ├── MovementController.js  # Loop de movimento 20Hz
│   │   ├── PhysicsEngine.js       # Simulação de física client-side
│   │   └── InputGenerator.js      # Geração de flags de input
│   │
│   └── evolution/
│       ├── Genome.js              # Representação genética
│       ├── Episode.js             # Execução de episódio de avaliação
│       └── EvolutionEngine.js     # Motor evolutivo (seleção, crossover, mutação)
│
├── tools/
│   └── gateway.js               # Proxy MITM para gravação de pacotes
│
├── recordings/                  # Gravações de sessões (.jsonl)
├── docs/                        # Documentação detalhada
└── archive/                     # Experimentos antigos
```

---

## Instalação

### Pré-requisitos

- **Node.js** 18 ou superior
- **Minecraft Bedrock Edition** (Windows 10/11)
- **Bedrock Dedicated Server** 1.26.x (incluído em `bedrock-server-1.26.0.2/`)

### Setup

```bash
# Clonar repositório
git clone https://github.com/fjorge9-arch/MineBot.git
cd MineBot

# Instalar dependências
npm install
```

### Configurar Loopback (Windows)

O Windows bloqueia apps UWP de conectar ao localhost. Execute como **Administrador**:

```powershell
CheckNetIsolation LoopbackExempt -a -n="Microsoft.MinecraftUWP_8wekyb3d8bbwe"
```

---

## Uso

### Iniciar Tudo (Recomendado)

```powershell
.\start_all.ps1
```

Isso inicia o servidor Bedrock e o Gateway/Proxy.

### Componentes Individuais

```bash
# Gateway/Proxy (porta 19134) - para gravar pacotes
node tools/gateway.js

# Replay Bot - reproduz gravações
node bots/replay.js

# Walker Bot - movimento autônomo
node bots/walker.js

# Evolution Runner - otimização evolutiva
node bots/evolution.js --population=20 --generations=30 --duration=5000
```

### Conectar ao Servidor

| Componente | Endereço | Porta |
|------------|----------|-------|
| Servidor Bedrock (direto) | `127.0.0.1` | `19132` |
| Gateway/Proxy (gravar) | `127.0.0.1` | `19134` |

---

## Sistema de Evolução

O algoritmo evolutivo descobre os parâmetros de movimento automaticamente:

### Genes Evoluídos

| Gene | Tipo | Descrição |
|------|------|-----------|
| `useUpFlag` | boolean | Flag de movimento forward (bit 10) |
| `useVerticalCollision` | boolean | Flag de colisão com chão (bit 50) |
| `deltaMultiplierX/Z` | float | Multiplicadores de movimento |
| `deltaY` | float | Ajuste de gravidade |
| `tickIncrement` | int | Incremento do tick por pacote |
| `turnRate` | float | Taxa de rotação |

### Executar Evolução

```bash
# Teste rápido (5 min)
node bots/evolution.js --population=10 --generations=20 --duration=3000

# Descoberta completa (30+ min)
node bots/evolution.js --population=20 --generations=50 --duration=5000

# Com múltiplos bots paralelos
node bots/evolution.js --population=30 --generations=50 --parallel=3
```

O melhor genoma é salvo em `recordings/best_genome_*.json`.

---

## Gravação e Replay

### Gravar Sessão

1. Inicie o Gateway: `node tools/gateway.js`
2. Conecte o Minecraft a `127.0.0.1:19134`
3. Jogue normalmente - os pacotes são gravados em `recordings/`

### Reproduzir Gravação

```bash
node bots/replay.js
# Ou especificar arquivo:
node bots/replay.js recordings/session-2026-02-14T01-32-52-586Z.jsonl
```

---

## Descobertas Técnicas

### Estrutura do Pacote `player_auth_input`

```javascript
{
    position: { x, y, z },           // Posição atual
    delta: { x, y, z },              // Movimento neste tick
    move_vector: { x: 0, z: 1 },     // Direção (1 = forward)
    input_data: 1407374883554304n,   // Flags de input (BigInt)
    tick: 12345n,                    // Tick do servidor
    input_mode: 'mouse',
    play_mode: 'screen',
    interaction_model: 'touch'
}
```

### Decodificação de `input_data`

```javascript
// Valor quando andando para frente:
input_data = 1407374883554304n

// Composição:
//   Base:                    281474976710656n (bit 48)
//   + UP (W key):            1024n (bit 10)
//   + VERTICAL_COLLISION:    1125899906842624n (bit 50)
```

---

## Scripts Utilitários

| Script | Descrição |
|--------|-----------|
| `start_all.ps1` | Inicia servidor + proxy |
| `start_admin.ps1` | Setup completo (requer admin) |
| `reset_world.ps1` | Deleta o mundo (reset) |
| `check_firewall.ps1` | Verifica regras de firewall |
| `test_all_bots.js` | Testa todos os bots automaticamente |

---

## Dependências

```json
{
  "bedrock-protocol": "^3.53.0"
}
```

---

## Documentação

- [Documentação do Projeto](docs/project_documentation.md)
- [Plano de Refatoração](docs/REFACTORING.md)
- [Setup do Servidor](docs/server_setup.md)
- [Troubleshooting](docs/troubleshooting.md)

---

## Roadmap

- [x] Gateway/Proxy funcional
- [x] Gravação de pacotes
- [x] Replay de gravações
- [x] Sistema de evolução
- [ ] Movimento autônomo estável
- [ ] Comportamentos complexos (mineração, combate)
- [ ] Interface visual de monitoramento

---

## Licença

MIT

---

*Desenvolvido com assistência de IA (Claude Opus 4.5 via GitHub Copilot)*
