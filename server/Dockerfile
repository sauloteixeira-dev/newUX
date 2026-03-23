FROM ghcr.io/puppeteer/puppeteer:latest

# Define as variáveis de ambiente necessárias para o Puppeteer rodar no container
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências (ignorando o download do Chromium pq a imagem base já tem)
RUN npm ci

# Copia o restante do código
COPY . .

# Expõe a porta que o serviço usará
EXPOSE 3001

# Comando de inicialização
CMD ["node", "server.js"]
