# Construclima — Precificador e Orçamento

Aplicação web estática (HTML + JS, sem build, sem login, sem banco). Tudo é calculado no navegador.

- **Início:** dois botões — *Precificador* e *Orçamento*.
- **Precificador** (pós-reforma tributária 2027), duas abas:
  - Serviços de Instalações — Lucro Presumido
  - Serviços em Obras — Lucro Presumido (com a pergunta "Haverá adicional de materiais?"; se *Sim*, pede o valor)
  - ISS não é fixo: informa-se o município da prestação e a alíquota manualmente.
- **Orçamento:** em desenvolvimento (regras e cláusulas a definir).

## Arquivos
- `js/calc.js` — fórmulas (separadas da tela)
- `js/app.js` — tela e navegação
- `css/style.css` — visual; a cor institucional fica em `--marca`
- `assets/logo.png` — **logotipo da Construclima (colocar aqui)**. Sem o arquivo, aparece o nome em texto.
- `tests/calc.test.mjs` — testes (`npm test`)

## Rodar localmente
```
python3 -m http.server 8080
```
e abrir http://localhost:8080

## Publicação
`.github/workflows/pages.yml` roda os testes e publica no GitHub Pages a cada push no `main`
(ativar em Settings → Pages → Source: GitHub Actions).

## Municípios
`assets/municipios.json`: os 5.571 municípios do IBGE (tabela 2026), extraídos do pacote npm `@br-geo-kit/ibge` (licença MIT).
