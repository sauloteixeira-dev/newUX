@echo off
color 0B
echo =======================================================
echo          SISTEMA AVA UNIFENAS - MODO LOCAL
echo =======================================================
echo Iniciando Servidor e Interface...

:: Instala as dependências se a pasta node_modules não existir no server
if not exist "server\node_modules\" (
    echo Instalando servidor (1/2)...
    cd server
    call npm install
    cd ..
)

:: Instala dependencias do frontend se não existir
if not exist "node_modules\" (
    echo Instalando interface (2/2)...
    call npm install
)

:: Derrubar eventuais servidores rodando nas mesmas portas para evitar conflito
echo Limpando portas antigas...
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr :3001') DO TaskKill.exe /F /PID %%a >nul 2>&1
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr :5173') DO TaskKill.exe /F /PID %%a >nul 2>&1

:: Inicia o backend em uma nova janela oculta/minimizada (opcional) ou visível
echo Subindo Servidor Inteligente (Porta 3001)...
start "Servidor Moodle (Nao feche)" cmd /k "cd server && npm start"

:: Abre o frontend
echo Subindo Interface Grafica...
start "Interface do Aluno" cmd /k "npm run dev"

:: Aguarda uns segundos para o Vite subir e abre o navegador
timeout /t 3 /nobreak >nul
echo Servicos online! Abrindo navegador...
start http://localhost:5173

echo =======================================================
echo.
echo ⚠️ ATENCAO: NAO FECHE AS DUAS JANELAS PRETAS QUE ABRIRAM!
echo Elas mantem o sistema funcionando.
echo.
pause
