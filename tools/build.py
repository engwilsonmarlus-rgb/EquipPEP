#!/usr/bin/env python3
"""Gera o index.html do EquipPEP.

Junta num único arquivo:
  - src/index.template.html (tela e estilos)
  - src/core.js (cálculos e preenchimento das planilhas)
  - src/app.js (telas e ações)
  - os modelos em modelos/*.xlsx (embutidos, sem alterar o layout)

Uso:  python3 tools/build.py
Só usa a biblioteca padrão do Python 3.
"""
import base64, io, json, os, sys, zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELOS = {
    'pc': 'modelos/prestacao_de_contas.xlsx',
    'pd': 'modelos/previsao_de_despesas.xlsx',
}

def partes(caminho):
    out = {}
    with zipfile.ZipFile(os.path.join(RAIZ, caminho)) as z:
        for nome in z.namelist():
            if nome.endswith('/'):
                continue
            b = z.read(nome)
            if nome.endswith(('.xml', '.rels')):
                out[nome] = {'t': 'x', 'd': b.decode('utf-8')}
            else:
                out[nome] = {'t': 'b', 'd': base64.b64encode(b).decode()}
    return out

def ler(p):
    with open(os.path.join(RAIZ, p), encoding='utf-8') as f:
        return f.read()

def main():
    modelos = {k: partes(v) for k, v in MODELOS.items()}
    tj = json.dumps(modelos, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    core, app = ler('src/core.js'), ler('src/app.js')
    for nome, s in (('core.js', core), ('app.js', app)):
        if '</script' in s.lower():
            sys.exit('erro: %s contém "</script"' % nome)
    html = (ler('src/index.template.html')
            .replace('__TEMPLATES__', tj)
            .replace('__CORE__', core)
            .replace('__APP__', app))
    with open(os.path.join(RAIZ, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(html)
    print('index.html gerado (%.1f MB)' % (len(html.encode()) / 1e6))

if __name__ == '__main__':
    main()
