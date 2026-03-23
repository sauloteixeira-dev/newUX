FROM ghcr.io/puppeteer/puppeteer:latest

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /usr/src/app

# Copia os arquivos de dependência com permissão correta
COPY --chown=pptruser:pptruser package*.json ./

# Instala as dependências
RUN npm ci

# Copia o restante do código
COPY --chown=pptruser:pptruser . .

# Expõe a porta que o serviço usará
EXPOSE 3001

# Comando de inicialização
CMD ["node", "server.js"]
