# Configuração do Servidor Local Bedrock (Windows)

Este guia explica como configurar o **Minecraft Bedrock Dedicated Server (BDS)** no seu PC para usarmos como alvo de desenvolvimento do bot.

## 1. Download e Extração
1. Baixe o servidor oficial para Windows: [https://www.minecraft.net/en-us/download/server/bedrock](https://www.minecraft.net/en-us/download/server/bedrock)
2. Extraia o arquivo `.zip` para uma pasta, por exemplo: `C:\Projetos\MineBot\server\`

## 2. Liberar Loopback (Crucial)
O Windows bloqueia aplicativos UWP (como o Minecraft Bedrock) de conectar ao `localhost` por segurança. Precisamos criar uma exceção.

1. Abra o **PowerShell** como **Administrador**.
2. Cole e execute este comando:
   ```powershell
   CheckNetIsolation LoopbackExempt -a -n="Microsoft.MinecraftUWP_8wekyb3d8bbwe"
   ```
   *Se der erro, tente pesquisar por "Minecraft Bedrock Loopback Exemption" para métodos alternativos.*

## 3. Configurar `server.properties`
Na pasta do servidor, abra o arquivo `server.properties` com o Bloco de Notas ou VS Code.

Recomendações para desenvolvimento:
- `gamemode=creative`: Facilita testes sem morrer.
- `difficulty=peaceful`: Remove monstros para focar no bot.
- `online-mode=true`: Mantém autenticação Xbox (necessário para bots online/proxy).
- `server-port=19132`: Porta padrão.

## 4. Iniciar o Servidor
1. Execute o arquivo `bedrock_server.exe`.
2. Uma janela de console preta deve abrir. Aguarde aparecer **"Server started."**
3. Se o Firewall do Windows pedir permissão, **Permita** (para redes privadas/públicas).

## 5. Testar Conexão
1. Abra o **Minecraft Bedrock Edition**.
2. Vá em **Jogar** > **Servidores**.
3. Role até o fim e clique em **Adicionar Servidor**.
4. Preencha:
   - **Nome do Servidor**: Local Dev
   - **Endereço do Servidor**: `127.0.0.1` (ou `localhost`)
   - **Porta**: `19132`
5. Salve e clique no servidor para entrar.

---

> [!NOTE]
> Se você conseguir entrar e andar pelo mundo, o ambiente está pronto para iniciarmos o desenvolvimento do Proxy.
