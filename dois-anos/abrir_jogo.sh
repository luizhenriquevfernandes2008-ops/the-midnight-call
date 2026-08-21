#!/bin/sh
# Abre o jogo. Prefere o arquivo empacotado; se nao existir, sobe um
# servidor local (os modulos ES nao carregam por file://).
cd "$(dirname "$0")" || exit 1

abrir() {
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$1"
  elif command -v open >/dev/null 2>&1; then open "$1"
  else echo "  abra manualmente: $1"
  fi
}

if [ -f JOGO_OFFLINE.html ]; then
  echo "  abrindo JOGO_OFFLINE.html"
  abrir "JOGO_OFFLINE.html"
  exit 0
fi

PORTA=8123
echo "  servindo em http://localhost:$PORTA"
abrir "http://localhost:$PORTA/index.html" &
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORTA"
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORTA"
else
  echo "  sem python: gere o JOGO_OFFLINE.html em outra maquina"
  exit 1
fi
