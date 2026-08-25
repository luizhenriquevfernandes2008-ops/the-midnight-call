@echo off
title OUROBOROS
cd /d "%~dp0"

echo.
echo   =========================================
echo      O U R O B O R O S
echo      roguelike da serpente
echo   =========================================
echo.
echo   Subindo o servidor local...
echo   Deixe esta janela ABERTA enquanto joga.
echo   Para fechar o jogo: feche esta janela.
echo.

REM O jogo usa modulos JavaScript. Navegador bloqueia isso quando o arquivo e
REM aberto direto (file://), por isso precisa do servidor local.
REM
REM Quem abre o navegador e o servidor.py, DEPOIS que a porta ja esta
REM escutando. Nao mova isso para ca.

py --version >nul 2>nul
if %errorlevel%==0 (
  if exist "servidor.py" ( py servidor.py 8140 ) else ( goto :simples )
  goto :fim
)

python --version >nul 2>nul
if %errorlevel%==0 (
  if exist "servidor.py" ( python servidor.py 8140 ) else ( goto :simples )
  goto :fim
)

node --version >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8140/index.html
  npx --yes serve -l 8140 --no-clipboard .
  goto :fim
)

echo   Nao encontrei Python nem Node.js instalado.
echo.
echo   Instale o Python em https://python.org/downloads
echo   (marque "Add Python to PATH") e rode este arquivo de novo.
echo.
pause
goto :eof

:simples
echo   AVISO: servidor.py nao foi encontrado. Usando o servidor simples.
echo.
start "" http://localhost:8140/index.html
py -m http.server 8140 2>nul || python -m http.server 8140

:fim
echo.
echo   O servidor encerrou.
echo   Se ele fechou sozinho na hora, a mensagem de erro esta logo acima.
echo.
pause
