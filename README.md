# 🎓 Ambiente Virtual UNIFENAS - Portal ADS Express

Uma interface alternativa, moderna e extremamente rápida para visualizar as disciplinas e atividades do portal EAD da UNIFENAS. Desenvolvido para resolver o problema de navegação lenta e dispersa do Moodle padrão.

## ✨ Funcionalidades Principais

- **🚀 Carregamento Instantâneo (Offline-first):** O sistema utiliza cache no `localStorage` do navegador. Se você já fez login, o sistema entra instantaneamente sem precisar raspar o Moodle novamente.
- **🔄 Background Sync Silencioso:** Quando a página é recarregada (F5), o robô atualiza silenciosamente os dados em segundo plano (respeitando um limite de 1 sync a cada 30 minutos para não sobrecarregar o Chrome e os servidores da faculdade).
- **📡 Streaming de Logs em Tempo Real:** Acompanhamento do robô de raspagem na tela de login através de um protocolo Server-Sent NDJSON que recebe chunks das etapas sem fechar a requisição.
- **🎨 UI/UX Moderna e Flat:** Design responsivo com dark mode/light mode suportado de forma nativa e escalas tipográficas responsivas.
- **🕵️ Bypass Avançado de SSO Moodle:** O backend (Node.js) usa `puppeteer` para efetuar login no Portal do Aluno, capturar os cookies de sessão segura e navegar diretamente para o Moodle via Single Sign-On, rompendo e contornando URLs dinâmicas e embeds escondidos (iframes).
- **🧑‍🏫 Extração Inteligente:** Lógica heurística avançada para varrer links e títulos identificando com precisão o nome dos professores das disciplinas e ignorando distrações em tela.

---

## 🛠 Tecnologias Utilizadas

### Frontend
- **React 18** + **Vite**
- CSS puro (escalas de variáveis nativas CSS para tipografia e paleta de cores Dark/Light)
- **NDJSON Stream Reader** no cliente nativo via Fetch.

### Backend
- **Node.js** + **Express**
- **Puppeteer** (Web Scraping agressivo em modo Turbo com bloqueio de imagens, fontes e styles para economizar banda RAM e acelerar tempo de login).
- CORS configurado

---

## 📦 Como rodar localmente o projeto

### Pré-requisitos
- Node.js versão `>= 18`
- NPM ou Yarn
- Git

### 1. Iniciar o Backend (Robô Extrator / API)
O robô precisa estar rodando localmente na porta 3001 para fazer as requisições pro Moodle.

```bash
cd portal-ads-express/server
npm install
node server.js
```
O servidor começará a rodar e exibir as mensagens de listen.

### 2. Iniciar o Frontend (Interface React)
Abra uma **nova** janela de terminal:

```bash
cd portal-ads-express
npm install
npm run dev
```
Após isso o projeto estará rodando no endereço: `http://localhost:5173`

---

## 🔒 Segurança e Dados
Apesar deste repositório utilizar sua matrícula e senha, esta operação **ocorre apenas localmente (no seu próprio computador)**. As credenciais são enviadas do React para o Node.js no localhost e encriptadas no cache para a ressincronização, mas **NUNCA são enviadas a nenhum banco de dados externo ou de terceiro.**

---

**Desenvolvido com 🩵 por Saulo Teixeira.**
