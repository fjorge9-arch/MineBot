# MineBot

Bot para Minecraft Bedrock Edition com funcionalidades de proxy, gravação de pacotes e comportamento imitativo.

## 🎮 Sobre o Projeto

Este projeto implementa um bot para Minecraft Bedrock que se conecta através de um proxy, permitindo gravação e análise de pacotes para implementar comportamento imitativo baseado em aprendizado.

## ✨ Funcionalidades

- **Proxy Bedrock**: Intercepta e registra pacotes entre cliente e servidor
- **Gravação de Pacotes**: Salva interações do jogador para análise
- **Bot Imitador**: Reproduz comportamentos gravados
- **Bot Caminhante**: Implementa movimento autônomo
- **Análise de Pacotes**: Ferramentas para analisar gravações

## 📋 Pré-requisitos

- Node.js (v14 ou superior)
- Minecraft Bedrock Edition
- Bedrock Dedicated Server

## 🚀 Instalação

```bash
npm install
```

## 📦 Dependências Principais

- `bedrock-protocol`: Comunicação com servidores Bedrock
- `prismarine-auth`: Autenticação Xbox Live

## 🎯 Uso

### Iniciar todos os serviços
```powershell
.\start_all.ps1
```

### Componentes Individuais

- **Gateway/Proxy**: `node gateway.js`
- **Bot Imitador**: `node imitator.js`
- **Bot Caminhante**: `node walker.js`
- **Análise de Gravações**: `node analyze_recording.js`

## 📁 Estrutura do Projeto

- `gateway.js` - Servidor proxy para interceptar pacotes
- `imitator.js` - Bot que imita comportamentos gravados
- `walker.js` - Bot com movimento autônomo
- `analyze_recording.js` - Análise de arquivos de gravação
- `docs/` - Documentação adicional
- `recordings/` - Gravações de pacotes (não versionadas)

## 🛠️ Scripts PowerShell

- `start_all.ps1` - Inicia servidor e proxy
- `start_admin.ps1` - Configurações administrativas
- `reset_world.ps1` - Reseta o mundo do servidor
- `check_firewall.ps1` - Verifica configurações de firewall

## 📝 Notas

Este projeto foi desenvolvido para fins educacionais e de pesquisa em IA aplicada a jogos.

## 📄 Licença

MIT
