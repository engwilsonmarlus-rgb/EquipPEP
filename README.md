# EquipPEP

**Previsão de despesas e prestação de contas das equipes de campo da Engemaximo.**

O líder da equipe usa o EquipPEP pelo celular, e o app gera as mesmas planilhas que o RH já recebe hoje:

- **Previsão de despesas (PDEM)**: semanal, de sábado a sexta.
- **Prestação de contas (PCEM)**: mensal.

As planilhas saem dos modelos originais da empresa. O app só preenche os campos, sem mexer no layout, nas fórmulas ou no logo.

---

## O que o app faz

| Tela | O que tem |
|---|---|
| **Início** | **Saldo − Diárias** (azul), **Diárias** lançadas desde o último depósito (laranja, zera a cada depósito confirmado) e o saldo do mês sem diárias; semana em andamento e últimos lançamentos |
| **Nova previsão** | Período (sábado a sexta, editável), local, equipe (1 a 4 pessoas, só nome), combustível (200 L × R$ 7,00 por padrão). Calcula total e depósito de cada um, descontando o saldo da prestação. Em "Mais opções": hospedagem, despesas diversas, km, projeto e cliente |
| **Lançar gasto** | Abre em Diária (padrão) / Meia diária, Combustível (Mobilização, Deslocamento, Desmobilização), Hospedagem (1 a 4 pessoas) e Diversas, com foto da nota |
| **Recebi dinheiro** | Depósito Caju, PIX ou Dinheiro |
| **Prestação** | Mês a mês: recebimentos, dias com diária e gastos. Baixa a planilha PCEM e um PDF com as fotos das notas |
| **Ajustes** | Nome do líder, saldo inicial, backup e restauração (inclui as fotos), Sair e **Zerar tudo** (com aviso de confirmação) |

Regras de cálculo (iguais às planilhas):

- Diária R$ 60,00, meia diária R$ 30,00 e hospedagem R$ 120,00 por pessoa.
- Depósito do líder = total da previsão − diárias dos outros colaboradores − saldo da prestação.
- Os outros colaboradores recebem só as próprias diárias.
- As diárias são lançadas pelo líder em **Lançar gasto → Diária** (não entram sozinhas pela previsão).
- A assinatura sai sempre como **TERESINA-PI, data do dia**.

---

## Estrutura

```
EquipPEP/
├── index.html                  ← app pronto (gerado pelo build, não editar à mão)
├── src/
│   ├── index.template.html     ← estrutura da página e estilos (CSS)
│   ├── core.js                 ← cálculos e preenchimento das planilhas
│   └── app.js                  ← telas, ações, fotos, backup e sincronização
├── modelos/
│   ├── previsao_de_despesas.xlsx   ← modelo PDEM (sem dados pessoais)
│   └── prestacao_de_contas.xlsx    ← modelo PCEM (sem dados pessoais)
└── tools/
    └── build.py                ← junta tudo no index.html
```

### Gerar o `index.html`

Precisa só do Python 3, sem instalar nada:

```bash
python3 tools/build.py
```

Rode sempre que mudar algo em `src/` ou em `modelos/`, e faça o commit do `index.html` junto.

### Trocar um modelo de planilha

Se o RH mudar a planilha:

1. Substitua o arquivo em `modelos/`, mantendo o nome.
2. Confira em `src/core.js` (funções `gerarPrevisao` e `gerarPrestacao`) se as células ainda são as mesmas. Exemplos: C8/G8 = período, H33 = saldo, linhas 21–51 = despesas.
3. Rode `python3 tools/build.py`.

Não deixe dados pessoais (CPF, conta, PIX) no modelo: o app só usa nomes.

---

## Onde ficam os dados

- **No aparelho:** lançamentos no armazenamento do navegador e fotos no IndexedDB.
- **Na versão publicada no claude.ai:** também sincroniza com a conta do usuário. Funciona em mais de uma aba ou aparelho sem perder lançamentos.
- **Hospedado fora do claude.ai** (ex.: GitHub Pages): fica só no aparelho. Use **Ajustes → Baixar backup** com frequência.

## Publicar no GitHub Pages

1. Em **Settings → Pages**, escolha a branch `main` e a pasta `/ (root)`.
2. O app fica em `https://<usuario>.github.io/EquipPEP/`.

Atenção: no plano gratuito, o Pages só funciona com repositório **público**. Veja o aviso sobre o login abaixo antes de deixar público.

---

## ⚠️ Fase de teste

- O login `admin0000` / `admin0000` é **provisório** e fica escrito no código (`src/app.js`). Ele só serve para separar a tela de entrada e **não protege os dados**.
- Mantenha o repositório **privado** enquanto esse login existir.

## Próximos passos

- [ ] Login com o e-mail institucional do Google (OAuth "Interno" do Google Workspace).
- [ ] Salvar as planilhas e o histórico no Google Drive de cada líder (escopo `drive.file`), com pasta compartilhada com o RH.
- [ ] Instalar como app na tela inicial (manifest + service worker) e funcionar sem internet.
