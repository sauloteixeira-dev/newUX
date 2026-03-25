# Portal ADS Express 🚀🎓

Este projeto foi desenvolvido para organizar as aulas do Moodle da UNIFENAS em uma interface limpa, rápida e moderna. Devido às restrições de segurança do portal original contra servidores hospedados em nuvem, este sistema foi modernizado e projetado para rodar **exclusivamente de forma nativa no seu computador**.

---

## 🚀 Como Instalar (Muito fácil)

Agora o sistema possui um instalador automático! Você não precisa de conhecimentos técnicos para usar.

1. Acesse a aba **[Releases (Lançamentos)](https://github.com/sauloteixeira-dev/newUX/releases/latest)** aqui no GitHub.
2. Faça o download do arquivo executável (`.exe`) disponível lá.
3. Dê **duplo-clique** no arquivo que você baixou.
4. A mágica acontece! O instalador vai, automaticamente:
   - Baixar a versão mais recente do código-fonte;
   - Criar uma pasta silenciosa no seu Windows;
   - Criar um Atalho chamado **"Portal ADS"** na sua **Área de Trabalho (Desktop)**!
5. **Pronto!** Sempre que quiser entrar nas suas aulas, basta usar o atalho que surgiu na sua tela inicial! 

*(Atenção: O sistema é movido a Javascript nativo, por isso exige que o programa gratuito [Node.js](https://nodejs.org/) esteja instalado no seu PC previamente).*

---

## ⚠️ Segurança dos Arquivos (Aviso Importante)

Para que o Moodle valide o seu acesso aos **PDFs** e **Vídeos** protegidos pelas licenças da universidade:
- Sempre abra uma **nova aba** no Google Chrome e faça o login normal no portal oficial: `aluno.unifenas.br`.
- Mantenha ele aberto em qualquer canto.
- Abra o seu atalho do **Portal ADS Express**. Os links das suas tarefas agora vão abrir direto, como mágica, porque seu Chrome vai reaproveitar a sessão autenticada que abrimos!

---

## ⚙️ Informações Técnicas e Arquitetura

- **Frontend UI:** Construído em React 18 + Vite (Porta 5180). Escalas tipográficas adaptáveis e suporte dinâmico para Dark/Light Mode.
- **Backend API:** Desenvolvido em Node.js e Express.js (Porta 3001).
- **Scraping Inteligente:** Bypass instantâneo das intermediações e modais chatos do Moodle (como os de Ferramenta Externa LTI e pastas de Arquivos), enviando o aluno direto pro link de "Launch".
- **Híbrido Puppeteer/Axios:** O uso massivo de Puppeteer foi substituído por uma arquitetura multithread paralela de `Axios` e `Cheerio`, lendo lotes de até 10 matérias ao mesmo tempo direto da rede HTTP e poupando muita memória RAM do computador.
- **Auto-Update Transparente:** O Instalador (criado a partir do `Instalador.bat`) consome a branch `main` deste repositório sem precisar do Git estar instalado na máquina do usuário final. Suas atualizações comitam sempre a versão mais afiada para todo mundo instantaneamente!
