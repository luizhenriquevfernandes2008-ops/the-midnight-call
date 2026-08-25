#!/usr/bin/env bash
# OUROBOROS — lancador para Linux e macOS.
cd "$(dirname "$0")" || exit 1
PORTA=8140

echo
echo "  ========================================="
echo "     O U R O B O R O S"
echo "     roguelike da serpente"
echo "  ========================================="
echo

if command -v python3 >/dev/null; then
  if [ -f servidor.py ]; then
    python3 servidor.py $PORTA
  else
    ( sleep 1; (xdg-open "http://localhost:$PORTA/index.html" 2>/dev/null || open "http://localhost:$PORTA/index.html" 2>/dev/null) ) &
    python3 -m http.server $PORTA
  fi
elif command -v node >/dev/null; then
  ( sleep 1; (xdg-open "http://localhost:$PORTA/index.html" 2>/dev/null || open "http://localhost:$PORTA/index.html" 2>/dev/null) ) &
  npx --yes serve -l $PORTA --no-clipboard .
else
  echo "  Instale Python 3 ou Node.js para rodar o jogo."
  exit 1
fi
