@echo off
title Dois Anos
cd /d "%~dp0"

echo.
echo   ================================
echo     D O I S   A N O S
echo   ================================
echo.

rem O arquivo empacotado abre sozinho, sem servidor, sem Python, sem nada.
rem E o caminho certo em 99%% dos casos.
if exist "JOGO_OFFLINE.html" (
  echo   Abrindo o jogo...
  start "" "JOGO_OFFLINE.html"
  echo.
  echo   Se o navegador nao abriu, clique duas vezes em JOGO_OFFLINE.html
  timeout /t 4 >nul
  exit /b
)

rem Sem o arquivo empacotado, cai para o servidor de desenvolvimento.
echo   JOGO_OFFLINE.html nao encontrado. Tentando o servidor local...
echo.

set PY=
for %%C in (python py python3) do (
  if not defined PY (
    %%C --version >nul 2>&1 && set PY=%%C
  )
)

if defined PY (
  echo   Servindo em http://localhost:8123
  start "" "http://localhost:8123/index.html"
  %PY% -m http.server 8123
  exit /b
)

echo   Nao achei Python nesta maquina.
echo   Rode "python ferramentas\gerar_offline.py" numa maquina que tenha,
echo   e leve o JOGO_OFFLINE.html gerado.
pause
