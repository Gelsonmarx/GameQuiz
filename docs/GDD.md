# Quiz do Milhão — Documento de Design do Jogo (GDD v0.1)

> Documento primário para guiar o desenvolvimento. Tudo aqui é ponto de partida: itens marcados **[DECIDIR]** precisam de uma decisão sua antes de implementar.
> Stack: **HTML + CSS + JavaScript (ES Modules) + Three.js**. Sem framework obrigatório; build opcional com **Vite**.

---

## 1. Visão geral

Jogo de perguntas e respostas inspirado no *Show do Milhão* (SBT). O jogador sobe uma escada de prêmios respondendo perguntas de múltipla escolha (4 alternativas, **somente uma correta**). A cada acerto o prêmio sobe; a cada pergunta ele decide: **responder**, **usar uma ajuda** ou **parar** e levar o dinheiro. Errar = perde tudo. Parar = garante o valor acumulado, que entra no **leaderboard**.

**Pitch:** "Um palco de TV em 3D, tensão de programa de auditório e resposta instantânea a cada toque."

### Pilares de design
1. **Responsividade extrema** — nenhuma ação do jogador fica sem reação visual/sonora em < 100 ms.
2. **Tensão e recompensa** — o jogo é sobre a decisão "arrisco ou paro?". Tudo (luz, música, câmera) reforça esse dilema.
3. **Clareza** — pergunta e alternativas sempre legíveis; o 3D é cenário e energia, não obstáculo.
4. **Rejogável** — banco de perguntas grande, sorteio por dificuldade, leaderboard.

---

## 2. Regras do jogo

### 2.1 Escada de prêmios (16 perguntas)
Baseada na versão clássica (1999–2003 / 2021) do programa, que o próprio jogo cita: 1 mil, 5 mil, 10 mil, 20 mil... até 1 milhão.

| # | Prêmio (R$) | Faixa de dificuldade |
|---|---|---|
| 1 | 1.000 | Fácil |
| 2 | 2.000 | Fácil |
| 3 | 3.000 | Fácil |
| 4 | 4.000 | Fácil |
| 5 | 5.000 | Fácil |
| 6 | 10.000 | Médio |
| 7 | 20.000 | Médio |
| 8 | 30.000 | Médio |
| 9 | 40.000 | Médio |
| 10 | 50.000 | Médio |
| 11 | 100.000 | Difícil |
| 12 | 200.000 | Difícil |
| 13 | 300.000 | Difícil |
| 14 | 400.000 | Difícil |
| 15 | 500.000 | Difícil |
| 16 | **1.000.000** | Milhão (final) |

A escada fica em um arquivo de configuração (`config/ladder.js`) para trocar facilmente (ex.: versão de 2024 com 17 perguntas).

### 2.2 Regras de acerto, erro e parada
- **Acertou:** sobe um degrau; o valor "acumulado" passa a ser o prêmio daquela pergunta.
- **Parar:** disponível antes de responder. Jogador leva o **valor já ganho** (o da última pergunta acertada). Na pergunta 1, parar = R$ 0.
- **Errou:** **perde tudo** (R$ 0) — regra definida por você.
  - No programa original, errar não zerava tudo (o valor é reduzido). Por isso a regra fica numa opção de config: `onWrong: "zero" | "half" | "checkpoint"` (padrão `"zero"`). **[DECIDIR]** se quer checkpoints (ex.: 5 mil / 50 mil / 500 mil como "pisos seguros").
- **Pergunta do milhão (16):** estilo programa — tela de 20 s para ler, **sem ajudas**; pode responder ou parar com 500 mil. Opcional. **[DECIDIR]**
- **Tempo por pergunta:** o programa original não tinha cronômetro, mas ele melhora o ritmo e o "feeling" de jogo. Proposta: tempo opcional (ex.: 30 s fácil / 45 s médio / 60 s difícil) com modo "sem tempo". **[DECIDIR]**

### 2.3 Ajudas
| Ajuda | Qtd. | Efeito |
|---|---|---|
| **Pulo** | **3** (compartilhados na partida) | Troca a pergunta atual por outra da mesma dificuldade. O prêmio daquele degrau não muda. |
| **Universitários** | 1 uso | 3 universitários opinam, um de cada vez, com graus de certeza diferentes. |
| **Plateia (Placas)** | 1 uso | Distribuição % de votos da plateia nas 4 alternativas (placas A/B/C/D). |
| **Cartas** (opcional) | 1 uso | 4 cartas viradas (Rei, Ás, 2, 3). Cada carta elimina esse número de alternativas erradas; Rei não elimina nada. **[DECIDIR]** se entra no MVP. |

Regras: ajudas só antes de responder; não existem na pergunta final; o estado (usadas/restantes) aparece sempre na HUD.

#### Algoritmos sugeridos (para parecerem críveis)
- Cada pergunta tem `difficulty` de 1 a 16 (ou faixa fácil/médio/difícil).
- **Probabilidade de acerto individual do universitário:** `p = lerp(0.92, 0.45, (nível-1)/15)`; cada um dos 3 recebe um desvio aleatório de ±10 pts e uma "confiança" textual (*"Tenho certeza"*, *"Acho que é..."*, *"Chutaria..."*). Se erra, escolhe uma alternativa errada ao acaso.
- **Plateia:** `acerto = lerp(0.85, 0.35, t)`; o restante distribuído entre as erradas com ruído, normalizado a 100 %. A plateia **pode** errar nos níveis altos (dá tensão).
- **Cartas:** sorteia-se a ordem das cartas (Rei=0, Ás=1, 2=2, 3=3 eliminações) no início da partida; ao escolher, remove N alternativas erradas ao acaso.
- **Pulo:** sorteia do banco uma pergunta ainda não vista na mesma faixa.

---

## 3. Fluxo de jogo (máquina de estados)

```
BOOT → MENU → (NOME DO JOGADOR) → INTRO_PALCO
   → PERGUNTA_REVEAL → ESCOLHA (responder / ajuda / parar)
       ├─ AJUDA_PULO → PERGUNTA_REVEAL
       ├─ AJUDA_UNIVERSITARIOS → ESCOLHA
       ├─ AJUDA_PLATEIA → ESCOLHA
       ├─ PARAR → CONFIRMA_PARAR → FIM_PARADA
       └─ RESPOSTA_TRAVADA ("Você tem certeza?") → SUSPENSE → RESULTADO
              ├─ CERTO → SOBE_DEGRAU → (última? → VITORIA : PERGUNTA_REVEAL)
              └─ ERRADO → FIM_DERROTA
FIM_* → TELA_FINAL → SALVA_LEADERBOARD → LEADERBOARD → MENU
```

Implementar como uma máquina de estados explícita (`GameState`), um módulo por estado, para a lógica nunca depender da animação.

**"Travar resposta":** primeiro toque seleciona (destaca a alternativa), segundo toque/botão **Confirmar** trava — igual ao "Certeza?" do programa e evita erro por toque acidental.

---

## 4. Leaderboard

### Pontuação
- Pontuação principal = **prêmio final em R$**.
- Desempate: menos ajudas usadas > menor tempo total.
- Registro: `{ nome, premio, perguntasAcertadas, ajudasUsadas, tempoTotalMs, resultado: "parou"|"errou"|"milhao", data }`.

### Fases de implementação
1. **MVP (local):** `localStorage`, top 10, nome do jogador pedido ao fim.
2. **Online (opcional):** backend leve (Firebase/Supabase/Cloudflare Workers + D1). Endpoints: `POST /scores`, `GET /scores?limit=50`.
   - Atenção a **trapaça**: jogo no cliente é facilmente manipulável. Mitigação: validação básica no servidor (prêmio ≤ escada, tempo mínimo plausível), rate-limit; validação forte só se virar competitivo. **[DECIDIR]**
3. Filtros: "Hoje", "Semana", "Geral".

---

## 5. "Feeling" e responsividade (o coração do projeto)

### 5.1 Princípios técnicos
- **Input**: usar `pointerdown` (não `click`) para disparo imediato; hit-area mínima de 48 px; suporte a teclado (A/B/C/D, Enter, Esc) e toque.
- **Feedback em < 100 ms** em toda ação: hover/pressed, som, partículas, vibração (`navigator.vibrate`) no mobile.
- **Desacoplar lógica e animação**: o estado do jogo atualiza instantaneamente; animações são "camadas" que podem ser puladas (tecla/toque para acelerar).
- **60 fps** no desktop e mobile médio; orçamento de ~100 draw calls, pixel ratio limitado a 2.
- **Layout responsivo**: portrait (celular) e landscape (desktop); a câmera 3D reenquadra no `resize`.

### 5.2 "Juice" por momento
| Momento | Feedback |
|---|---|
| Passar mouse / tocar alternativa | Brilho, leve escala, "tick" sonoro |
| Selecionar | Alternativa "acende" amarelo, luz de palco foca, pulso sutil |
| Travar resposta | Música de suspense entra, câmera faz dolly-in lento, luzes escurecem |
| Acerto | Alternativa fica verde, confete 3D/partículas, flash de luz, câmera shake leve, sting de acerto, número do prêmio sobe com contador animado |
| Erro | Alternativa vermelha, correta pisca em verde, luzes apagam, tela "treme", sting grave |
| Subir degrau | Escada de prêmios na lateral anima o marcador subindo |
| Ajuda | Cada ajuda tem mini-cena (universitários aparecem em bancada; placas da plateia levantam em onda) |
| Parar | Câmera abre, dinheiro "chove", contador finaliza |
| Pergunta do milhão | Cena dramática: palco escuro, spot único, heartbeat sonoro |

### 5.3 Animação
- Tween leve (GSAP ou Tween.js) com *easing* de overshoot para efeito "elástico".
- Números com contador animado e *tabular nums*.
- `prefers-reduced-motion` respeitado (desliga shake/confete pesado).

### 5.4 Áudio
- Web Audio API (ou Howler.js): música base em loop com camadas por tensão, stingers (acerto/erro/ajuda), SFX de UI.
- Desbloquear áudio no primeiro toque (política dos navegadores). Mixer com volumes separados (música/SFX) e mute persistente.
- **Origem dos sons**: usar áudio próprio/licenciado; não usar trilhas oficiais do programa.

---

## 6. Direção de arte e UI

- **Conceito visual:** palco de TV estilizado (low-poly/estilizado, leve de rodar): piso reflexivo, telão, holofotes, plateia em silhuetas, bancada dos universitários.
- **Paleta:** azul-noite profundo + dourado + branco; verde/vermelho reservados para acerto/erro.
- **Não copiar** logotipos, nome, mascotes, cenário exato ou trilha do Show do Milhão. Nome do jogo próprio (provisório: *Quiz do Milhão*). Referência de mecânica não é problema; marca e ativos oficiais sim. **[DECIDIR]** nome final.
- **Híbrido 3D + HTML (recomendado):**
  - **Three.js** cuida do palco, luzes, partículas, câmera, plateia, efeitos.
  - **HTML/CSS (overlay)** cuida de pergunta, alternativas, HUD, escada, modais — texto nítido, acessível, fácil de iterar e responsivo.
  - Vantagem: texto perfeito, i18n fácil, acessibilidade (foco/teclado), sem custo de renderizar fonte em WebGL.
- Fontes: uma de títulos (display, impactante) e uma legível para pergunta (sans humanista). Contraste AA.

### Telas
1. **Menu**: Jogar, Leaderboard, Opções (som, tempo, idioma), Como jogar.
2. **Jogo (HUD)**: pergunta ao centro, 4 alternativas, escada de prêmios (lateral/topo no mobile), ajudas (ícones), botão Parar, valor "Errar / Parar / Acertar" (como no programa: quanto perde, quanto leva, quanto ganha).
3. **Final**: resultado, prêmio, posição no ranking, campo de nome, jogar de novo.
4. **Leaderboard.**

---

## 7. Arquitetura técnica

### 7.1 Estrutura de pastas
```
GameQuiz/
├─ index.html
├─ package.json              (Vite + three)
├─ docs/GDD.md
├─ public/
│  ├─ audio/ …  fonts/ …  textures/ …
├─ src/
│  ├─ main.js                bootstrap
│  ├─ config/
│  │   ├─ ladder.js          escada de prêmios
│  │   └─ rules.js           pulos, tempo, onWrong, etc.
│  ├─ core/
│  │   ├─ GameStateMachine.js
│  │   ├─ GameSession.js     estado da partida (nível, ajudas, prêmio)
│  │   ├─ QuestionBank.js    carga, sorteio, sem repetição
│  │   ├─ Lifelines.js       pulo / universitários / plateia / cartas
│  │   └─ Leaderboard.js     local + adaptador remoto
│  ├─ three/
│  │   ├─ Stage.js           renderer, cena, câmera, resize
│  │   ├─ Lights.js  Audience.js  Particles.js  CameraRig.js
│  ├─ ui/
│  │   ├─ Hud.js  QuestionPanel.js  PrizeLadder.js  Modals.js
│  ├─ audio/AudioManager.js
│  └─ styles/*.css
└─ data/questions.json
```

### 7.2 Princípios
- **Lógica pura (`core/`) separada de render (`three/`, `ui/`)**: permite testes unitários e trocar o visual sem tocar nas regras.
- **Event bus** simples (`emit('answer:locked', …)`) para UI/3D/áudio reagirem sem acoplamento.
- Three.js via npm (`three`), importado como ES Module. Servir com Vite (`npm run dev`) — abrir o `index.html` direto por `file://` não funciona com módulos.
- Carregamento: tela de loading com barra; texturas comprimidas; áudio em streaming/lazy.
- Dispose correto de geometrias/materiais para evitar vazamento ao reiniciar partida.
- Pós-processamento (bloom) só em dispositivos fortes; detecção por FPS e fallback automático de qualidade.

### 7.3 Cena 3D (MVP enxuto)
- Piso com material levemente reflexivo, telão atrás (plano emissivo), 3–5 spotlights com cone visível, plateia como instâncias (`InstancedMesh`) com leve movimento.
- Câmera com `CameraRig` (poses nomeadas: *intro, pergunta, suspense, acerto, erro, milhão*) e transições por tween.
- Partículas (confete/faíscas) via `Points`/`InstancedMesh` com pool reutilizável.

---

## 8. Banco de perguntas

### 8.1 Formato (`data/questions.json`)
```json
{
  "id": "q-0001",
  "level": "facil",
  "category": "Geografia",
  "text": "Qual é a capital do Brasil?",
  "options": ["Rio de Janeiro", "Brasília", "São Paulo", "Salvador"],
  "answer": 1,
  "explanation": "Brasília é capital desde 1960.",
  "difficulty": 1
}
```
- `answer` = índice da alternativa correta (**sempre apenas uma**).
- Embaralhar alternativas a cada exibição (guardar o índice correto remapeado).
- Validação de schema no carregamento (4 opções, `answer` entre 0–3, sem duplicatas).

### 8.2 Volume e curadoria
- **Mínimo para MVP:** ~15 por faixa (≈ 45) + 5 reservas por faixa para pulos. **Ideal:** 300+.
- Categorias: Geografia, História, Ciências, Esportes, Artes, Cultura pop, Língua Portuguesa, Tecnologia, Atualidades.
- Perguntas devem ser **verificáveis** e atemporais (evitar "quem é o atual…"); incluir fonte quando possível.
- Pode-se gerar rascunhos com IA, mas **todas precisam de revisão humana** (fato e uma única resposta correta).

---

## 9. Acessibilidade, localização, plataformas
- Teclado completo, foco visível, leitores de tela no overlay HTML (`aria-live` para resultado).
- Modo daltônico (ícone + cor em acerto/erro; não depender só de verde/vermelho).
- Idioma inicial: **pt-BR**; textos em arquivo de strings para futura i18n.
- Alvos: desktop (Chrome/Edge/Firefox) e mobile (Chrome Android, Safari iOS). PWA opcional (offline + instalar).

---

## 10. Roadmap sugerido

| Marco | Entrega |
|---|---|
| **M0 — Protótipo jogável (sem 3D)** | Regras, escada, banco de ~45 perguntas, HUD em HTML, parar/errar, pulos. Testar o loop e o ritmo. |
| **M1 — Palco 3D + feeling** | Cena Three.js, luzes, câmera, confete, sons, travar resposta com suspense. |
| **M2 — Ajudas completas** | Universitários, plateia (e cartas), animações próprias. |
| **M3 — Leaderboard** | Local, tela final, ranking, desempate. |
| **M4 — Polimento** | Performance mobile, acessibilidade, opções, mais perguntas, PWA. |
| **M5 — Online (opcional)** | Ranking global + anti-trapaça básico. |

**Recomendação:** começar pelo M0 — se o ciclo "pergunta → decisão → suspense → resultado" não for divertido em HTML puro, o 3D não vai salvar.

---

## 11. Decisões em aberto
1. Errar: **zerar tudo** (padrão) ou usar pisos seguros (5 mil/50 mil/500 mil)?
2. Cronômetro por pergunta: sim/não/opcional?
3. Incluir **Cartas** no MVP?
4. Pergunta final do milhão: tela de 20 s, sem ajudas?
5. Leaderboard: só local ou global desde cedo?
6. Nome e identidade visual próprios (para não infringir a marca do programa).
7. Fonte/volume das perguntas (escrever, gerar com IA + revisão, importar de base aberta?).
8. Usar Vite (recomendado) ou arquivos estáticos sem build?

---

## 12. Referências da pesquisa
- Show do Milhão (Wikipedia): formato, escada de 16 perguntas (R$ 1.000 a R$ 1.000.000), ajudas (cartas, universitários, placas, pulos) e variações de versão — https://en.wikipedia.org/wiki/Show_do_Milh%C3%A3o
- Gazeta SP — retorno do programa no SBT com 16 perguntas e as quatro ajudas (Cartas, Placas, Universitários, Pulos) — https://www.gazetasp.com.br/entretenimento/show-do-milhao-agora-apresentado-por-celso-portiolli-retorna-ao-sbt-ap/
- Observação: as regras de erro/parada do programa original variam por versão e as fontes consultadas não detalham pisos seguros; por isso a regra do **seu** jogo (errar = perde tudo) foi tratada como configuração própria.

---

## 13. Decisões confirmadas (v0.2)
1. **Erro zera tudo.** O leaderboard só registra pontuação se o jogador **parar** ou **chegar ao R$ 1.000.000**; quem errar não entra no ranking (`onWrong: "zero"`, `rankOnlyOnStopOrWin: true`).
2. **Cronômetro de 60 s** por pergunta. Estourar o tempo = tratado como erro (perde tudo). **[DECIDIR]** se o relógio pausa durante as ajudas.
3. **Cartas entram no MVP** (junto de pulos, universitários e plateia).
4. **Leaderboard global desde o início** → backend obrigatório no M3 (Supabase/Firebase/Workers+D1) com validação no servidor; anti-trapaça é requisito, não opcional.
5. **Tema único: Fisiologia do Sistema Urinário Humano.** Banco em `data/questions.json` (esquema: `id, tier, category, text, options[4], answer, ladderLevels, origin, reviewed`).
   - Tiers: `facil` (degraus 1–5), `medio` (6–10), `dificil` (11–15), `milhao` (16).
   - Todas as perguntas começam com `reviewed: false`; só entram em produção após conferência em livro-texto.
