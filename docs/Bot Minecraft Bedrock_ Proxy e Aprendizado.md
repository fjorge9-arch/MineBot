# **Arquitetura e Implementação de um Sistema de Agente Autônomo para Minecraft Bedrock: Uma Abordagem de Proxy Gateway baseada em Aprendizado por Imitação e Vibe Coding**

O desenvolvimento de sistemas autônomos complexos no ecossistema de Minecraft Bedrock Edition representa um desafio técnico significativo, exigindo uma integração profunda entre engenharia de redes, processamento de protocolos em tempo real e algoritmos avançados de aprendizado de máquina. A transição de bots tradicionais, baseados em scripts rígidos, para agentes capazes de mimetizar o comportamento humano exige uma mudança de paradigma arquitetural. Este relatório detalha a construção de um sistema de bot "do zero", fundamentado em uma arquitetura de proxy gateway, utilizando a metodologia de "vibe coding" e orquestração via ferramentas agentic como o Google Antigravity. O foco reside não apenas na automação, mas no aprendizado contínuo através da interceptação de pacotes e na criação de uma biblioteca técnica reutilizável para o protocolo Bedrock.

## **A Filosofia da Arquitetura de Proxy: O Caminho Difícil como Fundamento**

A escolha de uma arquitetura de proxy (Gateway) em vez de um cliente de bot isolado é uma decisão estratégica que prioriza a fidelidade dos dados e a capacidade de observação. Enquanto um bot convencional opera como uma entidade separada que tenta simular um jogador, o proxy posiciona o agente "dentro" da conexão entre o jogador humano e o servidor. Esta topologia permite que o sistema capture a totalidade dos inputs e outputs em tempo real, servindo como a base ideal para o aprendizado por imitação (Imitation Learning).

### **Vantagens da Interceptação em Nível de Protocolo**

Ao atuar como um intermediário transparente, o sistema ganha acesso a fluxos de dados que seriam invisíveis em camadas superiores de abstração. Isso inclui a temporização exata de pacotes de movimento, a sequência de interações com blocos e a gestão de inventário em microssegundos. A arquitetura de gateway resolve o problema da "caixa-preta" do comportamento do jogador, permitindo que o bot mapeie ações diretamente para mudanças no estado do mundo.1

| Componente | Função no Sistema | Impacto na Autonomia |
| :---- | :---- | :---- |
| Gateway de Rede | Interceptação e encaminhamento de datagramas RakNet | Base para observação total do tráfego |
| Decodificador de Protocolo | Tradução de VarInts e estruturas binárias | Transformação de dados brutos em estados lógicos |
| Motor de Injeção | Inserção de pacotes sintetizados no fluxo | Capacidade de assumir o controle do "Ator" |
| Buffer de Gravação | Armazenamento de trajetórias (estado-ação) | Fonte de dados para o modelo de aprendizado |

## **Infraestrutura de Rede e o Protocolo RakNet**

A base de toda a comunicação em Minecraft Bedrock é o protocolo RakNet, um motor de rede baseado em UDP que fornece confiabilidade e ordenação sobre um transporte inerentemente não confiável.2 Para construir um proxy do zero, é imperativo implementar a máquina de estados completa do RakNet, desde o handshake inicial até a gestão de frames encapsulados.

### **O Ciclo de Vida da Conexão e Handshake**

O processo de conexão é dividido em fases "não conectadas" e "conectadas". Inicialmente, o cliente envia pings não conectados para descobrir o servidor e obter o MOTD (Message of the Day). O proxy deve interceptar esses pacotes e responder adequadamente para ser visível na lista de servidores do jogador.2

O handshake formal envolve uma sequência rigorosa de troca de pacotes para negociar o MTU (Maximum Transmission Unit) e estabelecer identificadores únicos (GUIDs). A falha na negociação correta do MTU pode resultar na fragmentação de pacotes ou na perda de conexão em redes instáveis.2

| Nome do Pacote | ID (Hex) | Campos Chave | Finalidade Técnica |
| :---- | :---- | :---- | :---- |
| Unconnected Ping | 0x01 | Magic, Client GUID | Descoberta de servidor e latência |
| Open Connection Request 1 | 0x05 | Magic, Protocol Version | Início da negociação de MTU |
| Open Connection Reply 1 | 0x06 | Magic, Server GUID, MTU | Confirmação de suporte e MTU inicial |
| Open Connection Request 2 | 0x07 | Magic, Cookie, MTU, Port | Finalização da negociação de MTU |
| Open Connection Reply 2 | 0x08 | Magic, GUID, MTU, Security | Estabelecimento da sessão RakNet |

Um aspecto crítico descoberto em implementações como o Geyser é a necessidade de verificação de cookies e limites de taxa para mitigar ataques de amplificação DDoS baseados no protocolo RakNet.3 O proxy deve implementar essas proteções para garantir a estabilidade do sistema de bot em ambientes de produção.

## **Decodificação do Protocolo Bedrock: VarInts e Serialização**

Uma vez estabelecida a camada RakNet, o sistema deve lidar com os GamePackets do Minecraft Bedrock. O protocolo utiliza uma combinação de tipos de dados de comprimento fixo e variável para otimizar o uso de largura de banda.4

### **Codificação de Inteiros e VarInts**

A Bedrock Edition faz uso extensivo de Variable-Length Integers (VarInts). Esta técnica utiliza o bit mais significativo (MSB) de cada byte como um sinalizador de continuação. Se o MSB for 1, o próximo byte também faz parte do número. Isso permite que valores pequenos (como a maioria dos IDs de pacotes e contagens de itens) ocupem apenas um byte, enquanto valores maiores escalam dinamicamente.4

A ordem dos bytes (endianness) também varia conforme o tipo de dado. Enquanto VarInts seguem uma lógica específica de bits, tipos de ponto flutuante (f32, f64) e inteiros de tamanho fixo são quase sempre codificados em Little Endian.4

| Tipo de Dado | Codificação | Aplicação Típica |
| :---- | :---- | :---- |
| VarInt u32 | MSB-encoded | IDs de pacotes, comprimentos de array |
| VarInt i64 | ZigZag encoded | Timestamps, coordenadas relativas |
| f32 | Little Endian | Coordenadas de movimento (X, Y, Z) |
| String | u16 length \+ UTF-8 | Chat, nomes de entidades, comandos |

### **Compressão e Batched Packets**

Para economizar largura de banda, a Bedrock agrupa múltiplos pacotes de jogo em um único "batch" que é então comprimido. Os algoritmos suportados incluem Zlib e Snappy, sendo o Zlib o mais comum devido à sua configurabilidade entre velocidade e taxa de compressão.4 O proxy deve ser capaz de descompactar esses batches em tempo real para analisar as ações do jogador e, inversamente, comprimir pacotes injetados para que o servidor os aceite como válidos.

## **Aprendizado por Imitação (Imitation Learning): O Modo de Observação**

O coração do sistema é a capacidade do bot de aprender "como o jogo funciona" apenas observando o jogador humano. Este processo é fundamentado no Aprendizado por Imitação (IL), onde o objetivo é aprender uma política ![][image1] que mapeia estados ![][image2] para ações ![][image3], baseando-se em um conjunto de demonstrações de especialistas.5

### **Coleta de Dados e Mapeamento de Inputs**

Durante o "Modo de Aprendizado", o proxy atua como um gravador de alta fidelidade. Ele captura pares de estado-ação ![][image4]. O estado é extraído de pacotes como LevelChunk (geometria do mundo), UpdateAttributes (status do jogador) e InventoryContent (itens disponíveis). As ações são derivadas de pacotes como MovePlayer (posicionamento), PlayerAction (quebra de blocos, agachar) e InventoryTransaction (cliques e gestão de itens).7

Uma análise profunda do pacote PlayerAction revela uma lista de ações que o bot deve aprender a identificar:

1. **Start Break / Abort Break / Stop Break:** Ciclo de destruição de blocos.  
2. **Release Item:** Uso de arcos ou ferramentas.  
3. **Start Sneak / Stop Sneak:** Movimentação furtiva.  
4. **Jump:** Detecção de saltos para navegação.8

### **Metodologias de Treinamento e Redes Neurais**

Pesquisas recentes em ambientes de Minecraft, como as competições MineRL no NeurIPS, demonstram que o uso de "Replay Estimation" é vital. Esta técnica envolve a execução repetida de ações capturadas em um simulador ou ambiente de teste para suavizar a distribuição de visitas do agente e melhorar a generalização.9

Modelos de última geração para Minecraft frequentemente utilizam arquiteturas hierárquicas. Uma Rede Neural Convolucional (CNN) processa a visão ou os dados de voxels locais, enquanto uma rede Long Short-Term Memory (LSTM) ou um Transformer gerencia as dependências temporais de tarefas longas, como a mineração.10 O sistema de bot deve converter as sequências de pacotes interceptadas em arquivos JSONL formatados para o treinamento desses modelos, garantindo que cada "prompt" (estado do jogo) tenha uma "conclusão" (ação do jogador) correspondente.11

![][image5]  
A equação acima representa a perda de entropia cruzada usada para treinar o bot a prever a próxima ação humana com base no histórico de pacotes.

## **O Ator e a Automação: Injeção de Pacotes e Controle**

A transição do aprendizado para a execução transforma o bot em um "Ator" capaz de assumir o controle do personagem no servidor. Isso exige que o bot injete pacotes no fluxo de rede de forma que o servidor não detecte inconsistências.

### **Replay de Ações Complexas**

O replay não é meramente a repetição cega de pacotes gravados. Devido à natureza estocástica do servidor (como o spawn aleatório de mobs ou variações de lag), o bot deve ajustar os pacotes de replay dinamicamente. Se a gravação mostra o jogador caminhando para ![][image6], mas o bot detecta um obstáculo imprevisto em ![][image7], o motor de injeção deve pausar o replay e acionar o sistema de pathfinding para contornar o problema antes de retomar a sequência.12

### **Mineração Inteligente de Recursos**

Para a busca de diamantes e outros materiais, o bot utiliza uma combinação de "visão de raio-X" (derivada da análise de chunks) e lógica de exploração. Ao contrário de um script simples que cava em linha reta, o bot avançado utiliza algoritmos de busca para identificar a rota mais eficiente até os minérios desejados, considerando a durabilidade da ferramenta e a presença de perigos.12

| Tarefa de Automação | Pacotes Injetados | Lógica de Controle |
| :---- | :---- | :---- |
| Movimentação | MovePlayer | Interpolação de coordenadas para evitar detecção de anticheat |
| Mineração | PlayerAction | Sincronização entre animação de braço e quebra do bloco |
| Combate | InventoryTransaction | Seleção da melhor arma e cálculo de hitbox |
| Gestão de Inventário | InventoryTransaction | Troca de slots e descarte de itens inúteis |

## **Navegação Avançada e Pathfinding em Voxel 3D**

Navegar por terrenos complexos, evitando lava e obstáculos, exige uma representação precisa do mundo. O bot constrói uma grade de navegação (navmesh) interna baseada nos dados de voxels extraídos dos pacotes de chunk.

### **Algoritmo A\* e Heurísticas de Custo**

O algoritmo A\* é a escolha preferencial para navegação em Minecraft devido à sua eficiência em mundos baseados em grades.12 A função de custo ![][image8] é adaptada para o ambiente 3D, onde o custo ![][image9] inclui penalidades por passar perto de lava ou fogo, e a heurística ![][image10] estima a distância até o objetivo.15

Para otimizar o processamento em tempo real dentro do proxy, implementações eficientes utilizam o método de Newton-Raphson para cálculos de raiz quadrada, permitindo que o bot realize operações geométricas complexas usando apenas aritmética básica.16

### **Mitigação de Falhas de IA Específicas da Bedrock**

A versão Bedrock possui idiossincrasias conhecidas em sua IA de pathfinding, como a falha de vilões e mobs ao interagir com blocos de caminho (path blocks) ou trapdoors.17 O bot deve superar essas limitações codificando regras explícitas de colisão que transcendem a lógica padrão do jogo. Por exemplo, identificar que um bloco de grama ligeiramente mais baixo pode atuar como um "degrau" invisível que impede a movimentação fluida se não for tratado corretamente.18

* **Classificação de Blocos:** AIR (passável), SOLID (obstáculo), WATER (movimentação lenta/nado), DANGER (lava/fogo \- custo infinito).12  
* **Path Segmentation:** Para viagens de longa distância (milhares de blocos), o bot segmenta a rota em trechos menores, recalculando o caminho à medida que novos chunks são carregados pelo servidor.12

## **Logística de Inventário e Gestão de Baús**

A autonomia completa exige que o bot saiba quando suas capacidades de armazenamento estão exaustas e tome medidas para preservar os recursos coletados.

### **A Complexidade do InventoryTransaction**

O gerenciamento de itens na Bedrock Edition é centralizado no pacote InventoryTransaction (ID 30). Este pacote suporta diferentes tipos de transações que o bot deve dominar para interagir com o inventário e recipientes externos.7

| Tipo de Transação | Nome | Descrição Técnica |
| :---- | :---- | :---- |
| 0 | Normal | Movimentação simples de itens entre slots |
| 1 | Mismatch | Sincronização de estado entre cliente e servidor |
| 2 | ItemUse | Uso de um item no mundo (ex: colocar bloco, comer) |
| 3 | ItemUseOnEntity | Interação com entidades (ex: alimentar animal, atacar) |

O bot deve monitorar o campo inventory\_size (geralmente 36 slots para jogadores) para determinar quando retornar à base.19 A interação com baús envolve o envio de um ContainerOpen (ID 46), seguido por transações de inventário de tipo 0 para transferir itens, e finalizando com um ContainerClose (ID 47).7

### **Localização e Construção de Baús**

Um bot avançado não apenas localiza baús existentes através de metadados de entidades de bloco (Block Entities), mas também é capaz de fabricar e colocar seus próprios baús. Isso envolve a lógica de crafting (enviando pacotes de CraftingEvent) e a seleção de um local plano e seguro para o armazenamento, garantindo que os itens preciosos, como diamantes, sejam guardados antes que o inventário fique superlotado.12

## **Metodologia de Desenvolvimento: Vibe Coding e Google Antigravity**

O projeto é executado utilizando o paradigma de "vibe coding", uma metodologia emergente que utiliza modelos de linguagem de grande escala (LLMs) para gerar código funcional a partir de descrições em linguagem natural.21

### **Orquestração com Google Antigravity**

O Google Antigravity atua como a plataforma central para este desenvolvimento. Diferente de uma IDE tradicional, o Antigravity é um sistema "agentic" que permite despachar múltiplos agentes para trabalhar em paralelo em diferentes partes do código.23

* **Planning Mode:** Antes de escrever uma única linha de código para o decodificador RakNet, o agente gera um "Task List" e um "Implementation Plan". Isso permite que o desenvolvedor revise a lógica arquitetural antes da execução.25  
* **Artifacts:** Durante o desenvolvimento, os agentes produzem artefatos como diagramas de arquitetura, diffs de código e walkthroughs. Estes permitem verificar o progresso sem a necessidade de ler logs brutos exaustivos.23  
* **Manager Surface:** Uma interface dedicada onde é possível observar os agentes trabalhando de forma assíncrona, gerenciando tarefas como a implementação da biblioteca de criptografia ou o refinamento do algoritmo A\*.23

### **Práticas de Vibe Coding para Sistemas Complexos**

Para manter a qualidade em um projeto desta escala, aplicam-se boas práticas de desenvolvimento assistido por IA:

1. **PRD (Product Requirements Document) como Bússola:** Escrever requisitos detalhados em linguagem natural para guiar os agentes e evitar tangentes desnecessárias no código gerado.27  
2. **Modularização Estrita:** Dividir o sistema em "fatias" (ex: auth, rede, pathfinding, inventário) e solicitar que a IA implemente uma de cada vez para garantir testabilidade e manutenibilidade.27  
3. **Loops de Feedback Iterativos:** Testar cada módulo imediatamente após a geração. Se o bot falhar ao decodificar um pacote de MovePlayer, o erro é fornecido ao agente para refatoração instantânea.21

## **Documentação de Desafios Técnicos e Soluções (PoC)**

Como uma prova de conceito (PoC) desenvolvida via vibe coding, o projeto registrou diversos obstáculos técnicos e as estratégias adotadas para superá-los.

### **Problema 1: Sincronização de Criptografia no Proxy**

**Problema:** O servidor Minecraft utiliza ECDH para estabelecer chaves de criptografia após o login. O proxy perdia a conexão porque não conseguia descriptografar os pacotes subsequentes para inspeção. **Solução:** Implementou-se um sistema de Man-in-the-Middle (MitM) completo onde o proxy mantém duas sessões de criptografia separadas: uma com o cliente e outra com o servidor oficial. O bot gerencia as chaves de ambos os lados, descriptografando o tráfego de entrada e re-criptografando-o para a saída.4

### **Problema 2: "Rubber-banding" no Controle do Ator**

**Problema:** Ao injetar pacotes de movimento para minerar, o bot era frequentemente teleportado de volta pelo anticheat do servidor (rubber-banding). **Solução:** A análise dos pacotes gravados mostrou que o bot estava enviando coordenadas muito rapidamente sem considerar o lag da rede. A solução foi implementar um sistema de latência adaptativa que monitora o pacote NetworkStackLatency e ajusta a taxa de injeção de MovePlayer para corresponder ao ping atual do servidor.4

### **Problema 3: Ambiguidade em Transações de Inventário**

**Problema:** O bot falhava ao mover itens para baús porque os IDs de transação (transaction IDs) gerados não batiam com a sequência esperada pelo servidor, resultando em "mismatch" (tipo 1). **Solução:** Criou-se um gerenciador de estado de inventário local no bot que espelha exatamente o inventário do servidor. Antes de enviar uma transação de tipo 0, o bot verifica se o estado local está sincronizado e utiliza o request\_id correto derivado do fluxo interceptado.7

## **Construção da Biblioteca Bedrock Reutilizável**

O objetivo final de organizar o conhecimento técnico em uma biblioteca visa permitir que futuros projetos herdem a complexidade já resolvida. Esta biblioteca é estruturada em módulos independentes, seguindo princípios de design limpo (SOLID) para garantir que componentes como o decodificador RakNet ou o motor de pathfinding possam ser usados em outros contextos, como servidores personalizados ou ferramentas de análise de rede.31

* **Módulo de Protocolo:** Classes para serialização e desserialização de cada pacote Bedrock identificado.32  
* **Módulo de Voxel:** Estruturas de dados otimizadas para armazenar e consultar o estado do mundo ao redor do jogador.34  
* **Módulo de Agente:** Lógica abstrata para planejamento de tarefas e execução de políticas de aprendizado.36

## **Conclusões e Direções Futuras**

A criação de um sistema de bot avançado para Minecraft Bedrock via proxy gateway demonstra que a complexidade da rede e da IA pode ser domada através de uma abordagem estruturada de aprendizado por imitação e ferramentas de desenvolvimento de última geração. O uso de "vibe coding" no Google Antigravity acelerou drasticamente a fase de prototipagem, permitindo que o foco permanecesse na arquitetura lógica e na solução de problemas de baixo nível do protocolo RakNet.

O sistema resultante não é apenas um autômato para mineração de diamantes, mas um framework de pesquisa capaz de evoluir. À medida que o bot observa mais jogadores, sua biblioteca de comportamentos cresce, aproximando-o de uma autonomia indistinguível da agência humana. A documentação rigorosa dos problemas de sincronização, criptografia e navegação serve como um guia indispensável para a próxima geração de desenvolvedores que desejam explorar as fronteiras da automação em ambientes virtuais complexos. O futuro deste projeto reside na integração de modelos de linguagem ainda mais potentes para a tomada de decisões éticas e estratégicas dentro do jogo, transformando o bot de um simples operário em um companheiro de jogo inteligente.

#### **Referências citadas**

1. minecraft-proxy · GitHub Topics, acessado em fevereiro 14, 2026, [https://github.com/topics/minecraft-proxy](https://github.com/topics/minecraft-proxy)  
2. RakNet Protocol \- Bedrock Wiki, acessado em fevereiro 14, 2026, [https://wiki.bedrock.dev/servers/raknet](https://wiki.bedrock.dev/servers/raknet)  
3. RakNet Amplification Attack Summary and Response \- GeyserMC, acessado em fevereiro 14, 2026, [https://geysermc.org/blog/raknet-amplification-attack/](https://geysermc.org/blog/raknet-amplification-attack/)  
4. Bedrock Protocol, acessado em fevereiro 14, 2026, [https://wiki.bedrock.dev/servers/bedrock](https://wiki.bedrock.dev/servers/bedrock)  
5. \[PDF\] Scaling Imitation Learning in Minecraft \- Semantic Scholar, acessado em fevereiro 14, 2026, [https://www.semanticscholar.org/paper/Scaling-Imitation-Learning-in-Minecraft-Amiranashvili-Dorka/041a0b2f4f81ca66f36fe64b039fc4a9c52ea15a](https://www.semanticscholar.org/paper/Scaling-Imitation-Learning-in-Minecraft-Amiranashvili-Dorka/041a0b2f4f81ca66f36fe64b039fc4a9c52ea15a)  
6. \[2007.02701\] Scaling Imitation Learning in Minecraft \- arXiv, acessado em fevereiro 14, 2026, [https://arxiv.org/abs/2007.02701](https://arxiv.org/abs/2007.02701)  
7. Minecraft (Bedrock Engine) 160, acessado em fevereiro 14, 2026, [https://sel-utils.github.io/protocol/bedrock160/play](https://sel-utils.github.io/protocol/bedrock160/play)  
8. ICY105/PlayerAction: A Minecraft datapack library that has hooks for certian player actions., acessado em fevereiro 14, 2026, [https://github.com/ICY105/PlayerAction](https://github.com/ICY105/PlayerAction)  
9. Minimax Optimal Online Imitation Learning via Replay Estimation \- CMU Robotics Institute, acessado em fevereiro 14, 2026, [https://www.ri.cmu.edu/app/uploads/2022/10/minimax\_il.pdf](https://www.ri.cmu.edu/app/uploads/2022/10/minimax_il.pdf)  
10. Sample Efficient Reinforcement Learning through Learning from Demonstrations in Minecraft \- Proceedings of Machine Learning Research, acessado em fevereiro 14, 2026, [http://proceedings.mlr.press/v123/scheller20a/scheller20a.pdf](http://proceedings.mlr.press/v123/scheller20a/scheller20a.pdf)  
11. How do I prepare and format my training data for fine-tuning a foundation model on Bedrock (for example, using JSONL files with prompt-completion pairs)? \- Milvus, acessado em fevereiro 14, 2026, [https://milvus.io/ai-quick-reference/how-do-i-prepare-and-format-my-training-data-for-finetuning-a-foundation-model-on-bedrock-for-example-using-jsonl-files-with-promptcompletion-pairs](https://milvus.io/ai-quick-reference/how-do-i-prepare-and-format-my-training-data-for-finetuning-a-foundation-model-on-bedrock-for-example-using-jsonl-files-with-promptcompletion-pairs)  
12. stylextv/maple: Minecraft path-finding bot. \- GitHub, acessado em fevereiro 14, 2026, [https://github.com/stylextv/maple](https://github.com/stylextv/maple)  
13. \[::\] Bot with PathFinding AI that autonomeously switches between three Algorithms: Dijkstra's Concurrent, semi-A\* and a simple Chase algorithm, all compatible with 3d terrain, collision detection & easily configurable search radius \- More info in comments : r/Minecraft \- Reddit, acessado em fevereiro 14, 2026, [https://www.reddit.com/r/Minecraft/comments/37yiye/bot\_with\_pathfinding\_ai\_that\_autonomeously/](https://www.reddit.com/r/Minecraft/comments/37yiye/bot_with_pathfinding_ai_that_autonomeously/)  
14. A\* Pathfinding is not working in a 3D Minecraft Environment \- Stack Overflow, acessado em fevereiro 14, 2026, [https://stackoverflow.com/questions/65655920/a-pathfinding-is-not-working-in-a-3d-minecraft-environment](https://stackoverflow.com/questions/65655920/a-pathfinding-is-not-working-in-a-3d-minecraft-environment)  
15. What pathfinding algorithm does Minecraft use? : r/gamedev \- Reddit, acessado em fevereiro 14, 2026, [https://www.reddit.com/r/gamedev/comments/udmbre/what\_pathfinding\_algorithm\_does\_minecraft\_use/](https://www.reddit.com/r/gamedev/comments/udmbre/what_pathfinding_algorithm_does_minecraft_use/)  
16. I am currently working on an A\*-algorithm (pathfinding). Instead of using Manhattan distance, I managed to use the Newton-Raphson method to calculate square roots in Minecraft. The method only uses addition, subtraction, multiplication, and division. Takes 11 blocks to make. Commands in comments... : r/ \- Reddit, acessado em fevereiro 14, 2026, [https://www.reddit.com/r/MinecraftCommands/comments/15n338x/i\_am\_currently\_working\_on\_an\_aalgorithm/](https://www.reddit.com/r/MinecraftCommands/comments/15n338x/i_am_currently_working_on_an_aalgorithm/)  
17. (OC) Minecraft Mob Pathfinding Cheat Sheet : r/technicalminecraft \- Reddit, acessado em fevereiro 14, 2026, [https://www.reddit.com/r/technicalminecraft/comments/1nfmg5u/oc\_minecraft\_mob\_pathfinding\_cheat\_sheet/](https://www.reddit.com/r/technicalminecraft/comments/1nfmg5u/oc_minecraft_mob_pathfinding_cheat_sheet/)  
18. Critical AI Pathfinding Issue in Minecraft Bedrock, acessado em fevereiro 14, 2026, [https://feedback.minecraft.net/hc/en-us/community/posts/40817293193741-Critical-AI-Pathfinding-Issue-in-Minecraft-Bedrock](https://feedback.minecraft.net/hc/en-us/community/posts/40817293193741-Critical-AI-Pathfinding-Issue-in-Minecraft-Bedrock)  
19. Entity Documentation \- minecraft:inventory | Microsoft Learn, acessado em fevereiro 14, 2026, [https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent\_inventory?view=minecraft-bedrock-stable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_inventory?view=minecraft-bedrock-stable)  
20. Item Functions \- Bedrock Wiki, acessado em fevereiro 14, 2026, [https://wiki.bedrock.dev/loot/item-functions](https://wiki.bedrock.dev/loot/item-functions)  
21. Vibe Coding Explained: Tools and Guides | Google Cloud, acessado em fevereiro 14, 2026, [https://cloud.google.com/discover/what-is-vibe-coding](https://cloud.google.com/discover/what-is-vibe-coding)  
22. acessado em fevereiro 14, 2026, [https://www.cloudflare.com/learning/ai/ai-vibe-coding/\#:\~:text=What%20is%20the%20core%20concept,Andrej%20Karpathy%20in%20February%202025.](https://www.cloudflare.com/learning/ai/ai-vibe-coding/#:~:text=What%20is%20the%20core%20concept,Andrej%20Karpathy%20in%20February%202025.)  
23. Build with Google Antigravity, our new agentic development platform, acessado em fevereiro 14, 2026, [https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/](https://developers.googleblog.com/build-with-google-antigravity-our-new-agentic-development-platform/)  
24. Google Antigravity Documentation, acessado em fevereiro 14, 2026, [https://antigravity.google/docs/home](https://antigravity.google/docs/home)  
25. Getting Started with Google Antigravity, acessado em fevereiro 14, 2026, [https://codelabs.developers.google.com/getting-started-google-antigravity](https://codelabs.developers.google.com/getting-started-google-antigravity)  
26. Artifacts \- Google Antigravity Documentation, acessado em fevereiro 14, 2026, [https://antigravity.google/docs/artifacts](https://antigravity.google/docs/artifacts)  
27. How to Vibe Code: 11 AI-Assisted Coding Best Practices \- Hexaware Technologies, acessado em fevereiro 14, 2026, [https://hexaware.com/blogs/level-up-your-ai-workflow-11-vibe-coding-best-practices-for-real-world-builders/](https://hexaware.com/blogs/level-up-your-ai-workflow-11-vibe-coding-best-practices-for-real-world-builders/)  
28. How to vibe code: 11 vibe coding best practices to start building with AI \- Zapier, acessado em fevereiro 14, 2026, [https://zapier.com/blog/how-to-vibe-code/](https://zapier.com/blog/how-to-vibe-code/)  
29. AI Debugging in Vibe Coding: Can Vibes Fix Bugs for You? \- GoCodeo, acessado em fevereiro 14, 2026, [https://www.gocodeo.com/post/ai-debugging-in-vibe-coding-can-vibes-fix-bugs-for-you](https://www.gocodeo.com/post/ai-debugging-in-vibe-coding-can-vibes-fix-bugs-for-you)  
30. 1.17.1 \- Packet Set Slot and Window Items Field | SpigotMC \- High Performance Minecraft Software, acessado em fevereiro 14, 2026, [https://www.spigotmc.org/threads/packet-set-slot-and-window-items-field.517201/](https://www.spigotmc.org/threads/packet-set-slot-and-window-items-field.517201/)  
31. how do you keep your vibecoded projects understandable 3 months later? \- Reddit, acessado em fevereiro 14, 2026, [https://www.reddit.com/r/VibeCodeCamp/comments/1qdgurv/how\_do\_you\_keep\_your\_vibecoded\_projects/](https://www.reddit.com/r/VibeCodeCamp/comments/1qdgurv/how_do_you_keep_your_vibecoded_projects/)  
32. Implementing new Minecraft version support in PocketMine-MP, acessado em fevereiro 14, 2026, [https://doc.pmmp.io/en/rtfd/developers/internals-docs/updating-minecraft-protocol.html](https://doc.pmmp.io/en/rtfd/developers/internals-docs/updating-minecraft-protocol.html)  
33. Mojang/bedrock-protocol-docs: Documentation of the Bedrock network protocol. Protocol is subject to change release over release. \- GitHub, acessado em fevereiro 14, 2026, [https://github.com/Mojang/bedrock-protocol-docs](https://github.com/Mojang/bedrock-protocol-docs)  
34. Bedrock \- A simply python library to access Minecraft \- GitHub, acessado em fevereiro 14, 2026, [https://github.com/BluCodeGH/bedrock](https://github.com/BluCodeGH/bedrock)  
35. obscraft23/pybedrock: Python libraries to analyze and edit world data in Minecraft Bedrock, acessado em fevereiro 14, 2026, [https://github.com/obscraft23/pybedrock](https://github.com/obscraft23/pybedrock)  
36. Customizing Scripted Bots: Sample Efficient Imitation Learning for Human-like Behavior in Minecraft \- Microsoft Research, acessado em fevereiro 14, 2026, [https://www.microsoft.com/en-us/research/publication/customizing-scripted-bots-sample-efficient-imitation-learning-for-human-like-behavior-in-minecraft/](https://www.microsoft.com/en-us/research/publication/customizing-scripted-bots-sample-efficient-imitation-learning-for-human-like-behavior-in-minecraft/)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAXCAYAAAA/ZK6/AAAAqElEQVR4XmNgGAWDDbACsTgQS+LAAgilDAwGQPwIiP/jwXuAmBukWAWIDwCxBxArAvEKIDYDYgcgnsWAsIEHpBgEIoBYGcrWBOL5QMwBxJ5AXAlThA3wA/EhIHaB8hcCcTlCGhOAnHQLiKWhfJCGOQhpVAAKoVVAvAaIWaBiIA3XGSAhhwF0gfgdA8Q/MJADxC+BWB1JDA4YgVgQiJmRxEC2gvw1CkgGAFl5GZJVsJT8AAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAYCAYAAAAoG9cuAAAAp0lEQVR4XmNgGAXkAEYgVgDiACC2A2JWFFmowFQgXg7EIUBcB8RrgZgTWZEHEB8DYkEgZmGAKL4KxCLIisqB+CcQpwGxMBDrQjEKcAXiv0D8H4p3A7EoigooUAHiMiC+wgBRWASTADkM5MBbQCwGFQO56zQQp8MUiQPxbSCez4DwiQEQX2CAmAwGoLApZIDonAXEC4H4JBDbwxQgAw4glgRiAXSJ4Q0AAgEYuzqMmgwAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAZCAYAAAAIcL+IAAAAx0lEQVR4Xu3RMQtBURjG8VeYKIsYZVHKdidllDJQrMpqsbDJB7iTxcw38AXEcEerMimbbEaTgf/r3HM7mSwmnvp1nee87j1ckX++kTjKaCD1thelhB189BHggrEzIwUcMUEs7Hp4oG2HEljgjKItxdzpKuYor3w8qB+0WIn5kkavug6QDjtpiTnLwBYkjxPmThcNNp2uhju6qGKkZUXMo+2vy2CLGzxMUdcN/TuG2GOJDTo4YI0Zkjpoo4fOiXk7Gt3MOusfzBNijSGBwLzOUwAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAYCAYAAABjswTDAAACh0lEQVR4Xu2WTaiMURjH/0IR+ejqSkg+IlFu+cjC10JiwYJCkWxkYSPXR1mxsFAWYieSlQVlIZKUuxDChigpC5KSohQ7H/+/5xxz5plzZubVNLO5v/o1M+c5M/O85zzPeV9gmO4yno7xg11gNJ3oB5sxQC+j4pc6hJI9S7f6QI4Z9D5d5ANdpI/epit8IGUE7KpOuPFesJHehZVjlsX0dXjtNSrBh3SnD0SO0VvoTWPlOEWv01E+oASV6HEfcOiKN9DNsNr6H9REy+ia8L7EJvoO1kd1TAsBJVFCHfqU7qF76WNUb8S19AUdpAfoI/oVlphnKf1Al+cCn+gqHwhMpc9Qi6uWftL1/2a0Rt2t/9iRjGmrv8P+31NcQE1+H15zaFw/eonOhSW/Ds23MUVdPQTbjfT8vkhf0SnJWCQmu8sHWiXbT1/S38HPdHXdjOZoB37BVjIyGVZWugHp2PTEZA/5QKtkxQS6m96AJXyPjqubUUYnjZJNy2YJ/Ub3J2MpxTKYQz8iX+j7YPWpgzqiFfLH3KRgDiWrxJRgRNv7A9ZAquNtSUwUc1LNqHZyV6m60s1ifvis+rsDW+XIAljzqHtnJ+MRXegX1HZuFn0DW7mZ9DxdGGIRXcTbzPjfmlHtnPMB2Jn4nF6hF2BNcgT1zaWzUHO01Q3bBpt7hj6A/c5N2Eqq9PQccBCNdauVH0Lhlqvj6Ams8D0jYU0m9b6ESqZh2xJUJn2oJaYySj9HdNe6iibPKfqSrjytzSroD7R6uTKoyjzYDuq1yBZ6jY71gTbQRZ5G4ypVRd8/SY+G90UUVD3KphMdWtXt6MwDu85vPcC09VtqhsN0pQ90gemwY7GtRIfpFH8AYQFp6i9tSugAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAYCAYAAABZY7uwAAACoElEQVR4Xu2XS6hNURzGvxtC3pdIlEiKzNzcFDMDj6SkkMTEIxNRrtHtKhndGWUgeQzkkciAmMhrIEwMUB5dpETJBIU8vu/893bWXnuvzt5ed6f11a+zz1rrv89Z31rrv9YCoqKiouqjWeQJ+e7wkSxI6vd7dX1kRlLXHxpKNpDRXnmqkWQbOUi6ycRsdUNtpJPsIwfIUjIg06JA88gn8hjZlw4m50gPGeaU/0u1k1XkKHlHnqO441PIPbKRDCGLySMy12kjc7rINTKVjCXHYYYOctrlpJG5RL6RRUmZXrYzQc/9JRm0nHSQkyg2aCA5RM4kz6n2wvql/klzyGsy/2cLYBrsnWm/g1oNW0YnYG7KmN7kuS46hmKD1MlXZJdXvoJ8gBkjyTA/fgS5QY6gxUSYQB7CpvEeWP6pkzlSyKCFsNnvG7QMNuhrYcvuAvLxw8lVcoeMccoLJYf1wutklFdXB4UMSo0IGaTy1Ag/PlReqCWwkbiFXzNoDXlRgbtkeiOynEIGyYBWBilGsX58aYNmkiuwzO8m6zopZNAOtDZIKeQp8vGlDNIWeR42mm6ydneEOihk0F9dYlpKp9E8L7jJenbaqKSUCPUjZdFvVdkIQgZp2/6CsEHazTTYOgb48alB2sm0o2Ukc87CTpOudsNerM8q0kxcWQGdb3TOKauQQZPIM9jp2NVm8haWPiQZ6H6XxpH7yMc2TpJaVtv9CjRH5DbstFkXyaCXZLJX3gY7mribi2amVoabKpRCFK80kkrXqjew20RD68hnNO9XX2EjmWprUubWX0a1kf6TGg+b/u+R/U/q6BannYy5SE7BrhmHyU3kzdRy6yObyHryANZnmfzfS5dOnZq1fPUZuoRqVSg/iTqtkKioqKioqN/QD//Wr88MV3muAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAAYCAYAAABN9iVRAAAChUlEQVR4Xu2XTYhNYRjH/0JMRI2FpkaukiKTJDNNGUkWIh9hQbKyUFJCZmLjSlaaDUVJyUJKPrJQlIQNSbGifDSIrLCikI///z7vO+c9xz3nzL3l3CbnX7/mvM/znnvv8z4f5wxQqlSp/1nzyEvyO+Ar6XP+EwnfEJnjfEVqDOkhx8lJstTZkppCdpPT5KBb56qXfCMvSEdgn0CukkNkUmAvUuNJlTwkXWQuuUsOI34Asj8le2Ex7HDr3GS1kRvkF1npbPrg/Y56p1yUNpDviH6XtIR8hCVNmkzuwGJQLNI4colccNeZ2gwrbW3WaSvoY+66VZpIrpMvZFFgV2bfwNpAWgFL3LnhHaYB2CGpKjI1nTwjn8kRWL+3MnDJZzQtePm0Zw0scfWCl13+XB2Fbb5HpiZ8rVBe8K9gScsLXnMgV6tg5fMAzQW/hbxtgEdkdu3OdFVhT6DFgU09/wN2ADqIWeQdOY9oPvmeV/A6hEypL26T54gPvlZrJuw3HYAFplY8AwvKBy97P+xpVandZY/GT25fZvD6gmuwLISDL3dKFqQKuUXek8dkG+I9L40lu2AV9Rr2PqDZldnzKu+LpNutw8E3328aoTSdlYmRou9qZqiqSjXF/bRPk/yp016BXyGrE/Yq7MT0txGpgjY1wDrSXrszXQvIE7I+sK2FzYFet1aFDpLLiGaVH5Z1K1hDQqW+J+lANFD0VjUt4StafpJX3VrBqQVOIQrKB6qhp7ikjeQDWejWNalf9MakDxQ/YRnw2ulsof8m8jP0r9QJeyqof7e767P4+3V7H7lPtsLKfYgsj+0YpdIsWQYr/Rlx17A08SuwPfrHp5lZUqpUqVKlRr3+AFyJmTn0UtUmAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAYCAYAAAB9ejRwAAACjUlEQVR4Xu2WTYhOYRTH/zKKDJKvJGlkkihNPkpYTA2RbFhQKBvDyoKixuZKsmKBjVKyMEZZkHwsFKWkLLCQEol8NMmCoiSa/7/zPOO557339b533mz416+3+5zbc885zznneYH/+juaRMb4xQbUTsb6xVZoAzmOak7NIZfDb8vURe6Q6d7QhFaTK7Bsj1jjyFWy1Rua1Chymhz0hipaR56QGd5QQSvIM9LhDc1I0Z0jJ72hoiaTh2SbN3iNJ2vJEjLa2aaSp2STW5cmkvVkdnhWAywlG1E/q2fJBVjANZIDe8lj0kuOkkfkFekM78jRN+E3lVr8DDlM3pId5Bpsn0PkM+kZfjsv1dQ9MsEb5OUB2IbzwpoK+hYsM8qQpKg/kLnhOUp1thvm7FdyG7+7aiZ5jfKC1p6y672cFpKPsG6IaYznnaa2bINdZAHsWH+Q7sSm9U9kX7KWqixQZOQX8ileTL7AMhBV5lSUGiDNrKTR8Z2sStZSaU99R98blrKgbHhv1RHfyLJkrZ5TqgnVhiZ1W1jT70XyAOVDsnTP88gXW2x9H7WifQ8XVVDRMXXA6jSD1egxMiWxSwr+JQo6dE8wzII5tIX8RG2r6sNyqqiTYj2lx6QsxGyvIX2JLUpr11FwQWumKIp35DkZgH0grSdJrX+3YF3KYJM+zYTK4QW5SfpRe4Q6Xh13WWfmpJSqtf08kjLk6yZKkcppLwWsEvCDWNLx6prRdZPTStiHpoXnPxWn5pgG7CJvqKDt5BIK/v5o0A2S+bD62QmbwEVXSdR+cgIlV0OD0jHfIMu9QdI9dx9WK8qAuk4O1pMiO0U2e0ODUjAZLLiRBFYjXdxHUDCJG5ASoXuxpQ79exoCdYpxzNJhBb0AAAAASUVORK5CYII=>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAYCAYAAACWTY9zAAACl0lEQVR4Xu2WS6hPURTGP6E8Q0SiPDIRRZEorwFiQDJBZGDAhIlnGf0jA0UhMlEyQKLcujGhKJIw9RhQl0QGUopyb+L7rL27+6yzz3XOvTcTvvp1/metc85ee6+19v4D//X3NYIM8cYaavTeADKWjPaOCs0lF8go76ihKeR6uPao4+RnYI/z5TSZ3CWzvKOBlpA21JjYBtJFFnuHk1b2JGk5e1PpO2fIQe/wOk06yCRn95pNXoZrX7WIvCDTvCNKxXgPlvdBRVdJmuFNNCjeHjSGPCFbvCNqJvkEG3QCWUuWksHpQ7BgFNQhZ5cGwspgXvitVE0l62Hfly2n8+QS7PmS1pEf5A45RzaRh6SdDE2em0jewAL32k0Ok+ew+jtLjpBt5BU5gfzgWoz7ZKR3SKovBbYR3S/rBQWhYKK0Gh9RbhCt8ikyHlYSn8mCxH8x2FUyXpqkH+e3Yn3dQDF1R8lr2KBRCuxtuKaaTzbDtpF35Bi6JxjTr2wMD7ZUCuwDme4daX1FVTVDVWBRK0hnuEap4xSsJpqTAvtC5niH6us7iunRwF9R7pY/Baam8LNXvX6DbQ05VaZSM+lAcf9qwWap2a4kO4JdA74na8J9qlzKtNpXyCPYDr+dLAu+KE3el0w2ZaltGKyoZwTfOPKM7Az3qWJ9pSmLXayVVGNoa/BHkHylfVGHqFZgV2JT0R6AtbiC0z6U+nRwq4u9lCp14/LEpma6TJ6S27AmSaXF0BilY0kDaffNbX76l5Frb9XMY9h7qfQN2fxepXv9a8mdFCoVHUlV9ddIGuQBWe0dvdBWchXlE6bXUidfQ/FUaCpN8BaKG3GfpfTsD/jU1ZHeaZG94Xe/Ssu/jyz0jhpaBduC+j2of1O/AETLcRy+MadRAAAAAElFTkSuQmCC>