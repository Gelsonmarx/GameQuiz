# Quiz do Milhão — Fisiologia do Sistema Urinário

Jogo de perguntas e respostas no estilo *Show do Milhão*, com perguntas sobre a **fisiologia do sistema urinário humano**. Roda direto no navegador (HTML + CSS + JavaScript), sem instalação.

## Como jogar
- 16 perguntas, de R$ 1.000 a R$ 1.000.000, cada uma com uma única resposta correta.
- 60 segundos por pergunta. Estourou o tempo ou errou: perde tudo. Parou: leva o valor conquistado.
- Ajudas: 3 pulos, Universitários, Plateia e Cartas.
- Toque numa alternativa para marcar e toque de novo (ou Enter) para travar. Atalhos: A, B, C, D.

## Rodar localmente
Abra o `index.html` no navegador (não precisa de servidor nem de build).

## Estrutura
```
index.html        página do jogo
css/style.css     estilos
js/game.js        regras, ajudas, cronômetro, ranking
data/questions.js banco de perguntas usado pelo jogo
data/questions.json mesmo banco em JSON (fonte)
docs/GDD.md       documento de design do jogo
```

## Aviso sobre as perguntas
O banco é de apoio ao estudo e **ainda precisa de revisão** em livro-texto (campo `reviewed: false`). Não use como fonte única.

## Roadmap
Ranking global, cenário 3D com Three.js, mais perguntas e explicações por resposta. Detalhes em `docs/GDD.md`.
