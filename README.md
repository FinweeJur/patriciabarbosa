# experimenta fotografia

Site do portfólio **experimenta fotografia** — fotógrafa profissional e comunicadora popular (Belo Horizonte/MG).

Site estático, sem build. Abra `index.html` ou publique a pasta inteira.

## Estrutura

```
index.html                 página única (feed, background, galeria, sobre, contato)
assets/css/styles.css      tema escuro, tipografia Panchang + Nippo
assets/js/infinite-drift.js  Infinite Drift 2 (WebGL) portado da Lightswind UI
assets/js/app.js           rastro do cursor, lente, grid motion, accordion, bento, busca
assets/js/photos.js        manifesto das 62 fotos (gerado)
assets/photos/             variações WebP 800 / 1400 / 1800 px
assets/photos/thumb/       miniaturas 480 px (feed WebGL e rastro)
scripts/build-photos.py    reprocessa o acervo original
```

## Recursos

- **Feed contínuo** no hero com o componente Infinite Drift 2 (domo WebGL), todas as 62 fotos, velocidade fixa `0.3×` e apenas pausar/retomar.
- **Rastro de fotos no cursor** ativo no site inteiro; desliga sobre qualquer foto, onde entra a **lente de zoom**.
- **Grid Motion**, **Accordion Gallery** e **Cool Bento** nas seções seguintes, com âncoras no menu superior.
- Acessibilidade: tamanho de texto, alto contraste, redução de movimento, foco visível e `prefers-reduced-motion`.
- Fotos em `srcset` (800/1400/1800) para qualidade sem pesar a página; miniaturas para o feed.

## Gerar as fotos de novo

```powershell
python scripts/build-photos.py "C:\caminho\para\pasta-ou-zip"
```

## Publicação

- GitHub: `FinweeJur/patriciabarbosa`
- Cloudflare Pages: projeto `patriciabarbosa` → https://patriciabarbosa.pages.dev

```powershell
npx wrangler pages deploy . --project-name patriciabarbosa --branch main
```
