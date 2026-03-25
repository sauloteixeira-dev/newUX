@echo off
color 0B
title Instalador e Atualizador - Portal ADS Express

echo ==============================================================
echo        Instalador / Atualizador - Portal ADS Express
echo ==============================================================
echo.

:: 1. Verifica se o Node.js esta instalado
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Node.js nao encontrado! 
    echo Para o sistema funcionar, voce precisa instalar o Node.js.
    echo Baixe e instale a partir de: https://nodejs.org/
    echo Apos instalar, abra este programa novamente.
    pause
    exit
)

:: 2. Define os caminhos de instalacao silenciosa
set "INSTALL_DIR=%LOCALAPPDATA%\PortalAds"
set "ZIP_PATH=%TEMP%\portal_ads.zip"
set "GITHUB_URL=https://github.com/sauloteixeira-dev/newUX/archive/refs/heads/main.zip"

echo [1/4] Baixando a versao mais recente do sistema...
curl -L -o "%ZIP_PATH%" "%GITHUB_URL%" --silent

echo [2/4] Extraindo arquivos e atualizando o sistema...
:: Limpa a instalacao anterior superficialmente para nao apagar o node_modules pesado
if exist "%INSTALL_DIR%\newUX-main\package.json" (
    echo Atualizando versao existente...
) else (
    mkdir "%INSTALL_DIR%" >nul 2>&1
)

:: Extrai via PowerShell silencioso (Overwrite)
powershell -Command "Expand-Archive -Path '%ZIP_PATH%' -DestinationPath '%INSTALL_DIR%' -Force"

echo [3/4] Criando Atalho na Area de Trabalho...
set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Portal ADS.lnk"
set "TARGET_BAT=%INSTALL_DIR%\newUX-main\iniciar.bat"

:: Cria o atalho com PowerShell
powershell -Command "$wshell = New-Object -ComObject WScript.Shell; $shortcut = $wshell.CreateShortcut('%SHORTCUT_PATH%'); $shortcut.TargetPath = '%TARGET_BAT%'; $shortcut.WorkingDirectory = '%INSTALL_DIR%\newUX-main'; $shortcut.Description = 'Entrar no Portal AVA'; $shortcut.Save()"

echo [4/4] Tudo pronto! Inicializando o sistema...
del "%ZIP_PATH%"

:: Executa o sistema a partir do atalho para o usuario ja entrar
start "" "%SHORTCUT_PATH%"

echo.
echo ==============================================================
echo Instalacao Concluida! Um atalho foi criado na sua Area de Trabalho.
echo Pode fechar esta tela.
echo ==============================================================
timeout /t 5 >nul
exit
