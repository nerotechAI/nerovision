# Nero Vision Studio

Sistema local de produção automatizada de documentários (pt-BR, estética cyberpunk, 1080p30).

## Estado atual

| Parte | Onde | Estado |
|---|---|---|
| Schemas (fonte única de verdade) | `packages/schemas` | pronto |
| Núcleo (config, paths, ffprobe, projetos) | `packages/core` | pronto |
| Timeline (timing, storyboard, legendas) | `packages/timeline` | pronto |
| **Motor de renderização (Remotion)** | `apps/renderer` | **pronto — Fase 2** |
| Narração, áudio, assets, pipeline, dashboard | — | ainda não implementados |

## Requisitos

- Node.js ≥ 22.13 e npm.
- **Não é preciso instalar FFmpeg**: o Remotion traz `ffmpeg` e `ffprobe` próprios em `node_modules`.
  Um FFmpeg do sistema (ou `FFPROBE_PATH` no `.env`) tem prioridade quando existe.
- No primeiro render o Remotion baixa o Chrome Headless Shell para `node_modules/.remotion`.

```
npm install
```

## Renderizar

```
npm run render:demo                      # demo de 15 s, 1920x1080, H.264
npm run render -- <projeto>              # qualquer projeto em projects/<projeto>
npm run render -- <projeto> --preview    # meia resolução, rápido
```

O comando lê `projects/<id>/editorial.json`, monta storyboard e timeline com `@nero/timeline`,
renderiza com Chromium headless e valida o arquivo com ffprobe. Saídas:

- `projects/<id>/render/<id>-final.mp4` (ou `-preview.mp4`)
- `projects/<id>/qa/render-final.json` — relatório de QA (codec, resolução, fps, quadros, duração)
- `projects/<id>/timeline.json`, `projects/<id>/storyboard.json`

O vídeo sai **sem faixa de áudio**: narração, música e efeitos pertencem à etapa de áudio, ainda não construída.
Por isso, cenas com `narration` preenchida são recusadas até existir um manifesto de narração.

## Motor de renderização

A composição `NeroDocumentary` recebe uma `Timeline` e a executa quadro a quadro. Todo quadro é função
pura do número do quadro e da `seed` da cena — nada de `Math.random()` — então o render é paralelo e reprodutível.

| Recurso | Arquivo |
|---|---|
| Câmera virtual e parallax por profundidade | `src/camera.ts`, `components/CameraRig.tsx` |
| Transições (`cut`, `crossfade`, `glitch`, `flash`, `dip-black`, `wipe`) | `src/transitions.ts`, `components/TransitionIn.tsx` |
| Partículas volumétricas com bokeh | `components/ParticleField.tsx` |
| Rede neural 3D com pulsos | `components/NeuralNetwork.tsx` |
| Hologramas (painéis, esfera wireframe, anéis) | `components/Hologram.tsx` |
| Cidade de dados em 4 planos | `components/DataCity.tsx` |
| Luz neon e fundo | `components/Lighting.tsx` |
| Texto animado | `components/Text.tsx` |
| Acabamento (grão, vinheta, scanlines, névoa, HUD…) | `components/Overlays.tsx` |

Tipos de cena implementados: `chapter_card`, `neural_network`, `particle_field`, `futuristic_interface`,
`parallax_25d`, `typography`. Os demais tipos do schema caem no fallback de partículas e geram um aviso no render.

## Testes

```
npm test                  # unitários: timing, câmera, transições, composição da demo
npm run test:integration  # render real (bundle → Chromium → FFmpeg → ffprobe), ~15 s
npm run typecheck
```

## Licença do Remotion

O Remotion é gratuito para indivíduos e empresas de até 3 pessoas; acima disso exige licença comercial
(<https://remotion.dev/license>).
