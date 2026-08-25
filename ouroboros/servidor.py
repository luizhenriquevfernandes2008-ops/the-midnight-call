# Servidor local do OUROBOROS.
#
# O jogo usa modulos JavaScript (import/export). Navegador recusa modulo
# aberto direto do disco (file://), entao clicar no index.html deixa a tela
# presa no carregamento. Este script existe para resolver isso — e mais tres
# coisas:
#
# 1. Manda Cache-Control: no-store. Sem isso o navegador guarda o JS antigo e
#    continua rodando a versao de ontem depois de uma correcao. Da a impressao
#    de bug novo quando e so arquivo velho.
#
# 2. Procura porta livre. Se a 8140 estiver ocupada (uma janela do jogo que
#    ficou aberta), sobe na 8141, 8142... em vez de falhar em silencio.
#
# 3. SO ABRE O NAVEGADOR DEPOIS que a porta esta escutando. Abrir antes faz o
#    navegador bater em porta morta e mostrar "nao foi possivel acessar" — e
#    parece que o jogo travou, quando nem chegou a subir.

import os
import socket
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORTA_PADRAO = 8140
TENTATIVAS = 12
RAIZ = os.path.dirname(os.path.abspath(__file__))


class SemCache(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RAIZ, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def guess_type(self, path):
        # Alguns Windows tem o registro do sistema quebrado e devolvem
        # text/plain para .js — o navegador entao recusa o modulo inteiro.
        if path.endswith('.js'):
            return 'text/javascript'
        if path.endswith('.json'):
            return 'application/json'
        return super().guess_type(path)


def ocupada(porta):
    s = socket.socket()
    s.settimeout(0.3)
    try:
        s.connect(('127.0.0.1', porta))
        return True
    except OSError:
        return False
    finally:
        s.close()


def subir(base):
    for p in range(base, base + TENTATIVAS):
        if ocupada(p):
            print('  porta %d ocupada, tentando a proxima...' % p)
            continue
        try:
            return ThreadingHTTPServer(('127.0.0.1', p), SemCache), p
        except OSError as e:
            print('  porta %d recusou (%s), tentando a proxima...' % (p, e))
    return None, None


if __name__ == '__main__':
    base = int(sys.argv[1]) if len(sys.argv) > 1 else PORTA_PADRAO
    servidor, porta = subir(base)

    if servidor is None:
        print()
        print('  NAO CONSEGUI ABRIR NENHUMA PORTA entre %d e %d.' % (base, base + TENTATIVAS - 1))
        print('  Provavelmente ja existe uma janela do jogo aberta.')
        print('  Feche as janelas pretas do jogo e tente de novo.')
        print()
        input('  Aperte ENTER para fechar.')
        sys.exit(1)

    url = 'http://localhost:%d/index.html' % porta

    print()
    print('  =========================================')
    print('     O U R O B O R O S')
    print('     roguelike da serpente')
    print('  =========================================')
    print()
    print('  Rodando em %s' % url)
    print('  Deixe esta janela aberta enquanto joga. Ctrl+C encerra.')
    print()
    print('  Se o navegador nao abrir sozinho, copie o endereco acima.')
    print()

    # A porta ja esta escutando aqui (o construtor faz bind + listen), entao o
    # navegador pode chegar antes mesmo do serve_forever.
    threading.Timer(0.3, lambda: webbrowser.open(url)).start()

    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print('\n  Encerrado. Ate a proxima descida.')
