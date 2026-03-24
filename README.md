# AVA Unifenas - Versão Local (Desktop)

Este projeto foi desenvolvido para organizar as aulas do Moodle da UNIFENAS em uma interface limpa, rápida e moderna. Devido às altas restrições de segurança do AVA da Unifenas contra servidores em nuvem, este sistema foi projetado para rodar **exclusivamente no seu computador local**.

## 🚀 Como Usar (Muito fácil)

1. **Baixe ou Clone** esta pasta para o seu computador.
2. Certifique-se de que você tem o [Node.js](https://nodejs.org/) instalado.
3. Dê **duplo-clique** no arquivo `iniciar.bat`.
4. Ele vai abrir duas janelas pretas (não as feche!) e, em alguns segundos, vai abrir o painel de login no seu navegador (`http://localhost:5180`).

## ⚠️ Segurança dos Arquivos (Aviso Importante)

Para que você consiga abrir os PDFs e vídeos que estão protegidos pela faculdade:
- Sempre abra uma **nova aba** no seu Google Chrome, entre no portal `aluno.unifenas.br` e faça o login normal da faculdade lá.
- Deixe o Moodle aberto lá.
- Volte aqui para o `localhost:5180` e acesse suas aulas pela nossa interface limpa. Todos os links vão abrir direto sem pedir senha, porque o navegador já estará com o seu "crachá" da Unifenas.

## ⚙️ Informações Técnicas

- **Frontend:** React + Vite (Porta 5180)
- **Backend:** Node.js + Express + Puppeteer + Axios (Porta 3001)
- **Scraper:** Um bypass ultrarrápido capta até 10 aulas simultaneamente usando Axios/Cheerio para reduzir o tempo que você espera.
