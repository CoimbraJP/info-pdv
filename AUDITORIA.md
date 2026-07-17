# Auditoria Técnica — INFO-PDV

**Data:** 02/07/2026 · **Escopo:** 100% do código (src/, api/, configs, CSS, git)
**Stack:** React 19 + Vite (PWA) · localforage/IndexedDB · 1 função serverless (Vercel) · MongoDB Atlas via Mongoose
**Volume:** ~3.5k linhas JSX/JS + ~2.1k linhas CSS · 2 commits no git

---

## Veredito executivo (sem rodeios)

Este sistema é um **protótipo bem-acabado**, não um software pronto para operação comercial. O front do PDV tem boas decisões de UX (autofocus, atalhos, autocomplete, offline-first), e o código é legível. Porém:

1. **A API é pública e sem autenticação** — qualquer pessoa com a URL lê e apaga todos os seus dados, incluindo CPF e **senhas de equipamentos de clientes**.
2. **O módulo de OS tem dados falsos (mock) hardcoded no fluxo de edição** — editar qualquer OS hoje **corrompe o registro real** com serviços, CPF e telefone inventados.
3. Não existe: caixa (abertura/fechamento), clientes, orçamento, troca/devolução, financeiro, fiscal (NFC-e/SAT), usuários/permissões.

Nada disso é irrecuperável — o tamanho pequeno do código é uma vantagem: dá para corrigir o crítico em dias, não meses.

---

## 1. Arquitetura

### Estrutura atual

```
api/            _db.js, _models.js, sync.js   ← todo o "backend" (1 endpoint)
src/
  components/   Sidebar
  context/      GlobalState.jsx               ← TODO o estado + persistência + sync + regras de negócio
  modules/      PDV, OS, Vendas, Estoque, Dashboard, Config
  utils/        db.js, sync.js, formatters.js
```

**O que está bom:** separação módulos/utils/context é clara para o tamanho atual; comentários de intenção nos arquivos de infra (db.js, sync.js, api/) são exemplares; a estratégia offline-first (IndexedDB fonte local + push/pull LWW) é uma decisão correta para PDV que não pode parar sem internet.

**Problemas estruturais:**

- **Ausência de camada de domínio.** Regras de negócio vivem dentro de componentes: baixa de estoque em `GlobalState.addSale`, total de serviços dentro de `OS.jsx`, filtros de status espalhados. Não há `src/domain/` ou `src/services/`. Consequência: impossível testar regra sem montar UI, e cada módulo reinventa a mesma lógica.
- **Estado monolítico em um único Context.** `GlobalStateContext.Provider` recebe um objeto literal novo a cada render com **todas** as coleções. Qualquer escrita (uma venda) re-renderiza todos os módulos consumidores. Com centenas de produtos/vendas em memória isso vira o gargalo nº 1 de UI.
- **Dois caminhos de escrita para a mesma coleção.** O contexto expõe `addOS/updateOS/deleteOS`, mas `OS.jsx` ignora e usa `setOsList([...osList, newOs])` direto (OS.jsx:52). Código morto + inconsistência: se amanhã `addOS` ganhar validação, o módulo OS não passa por ela.
- **Acoplamento por CSS.** `Estoque.jsx`, `Vendas.jsx` e `Config.jsx` importam `'./OS.css'` para reaproveitar `.os-container`/`.os-table`. CSS aqui é global (não são CSS Modules), então isso funciona por acidente e quebra em cascata: mexer no visual da OS altera 4 telas.
- **Lixo no repositório:** `tela-os.html` (protótipo standalone morto na raiz), `BACKUPSH/` (backups de outro projeto dentro do repo), `dev-dist/` e `dist/` presentes localmente. Repositório não é lugar de backup.
- **Código duplicado:** layout de impressão térmica reimplementado 4× (PDV.jsx:450, OS.jsx:707, Vendas.jsx:254, Config.jsx:374); lista de status de OS hardcoded em 3 lugares (select, filtros, `getStatusColor`); dados da loja hardcoded no cupom do PDV.

### Refatoração sugerida (mantendo React+Vite)

```
src/
  domain/        sale.js, serviceOrder.js, stock.js   ← regras puras, testáveis
  constants/     osStatus.js, payments.js             ← 1 fonte de verdade
  components/    print/Receipt.jsx, print/OSTicket.jsx ← imprime 1x, usa 4x
  hooks/         useProducts.js, useSales.js ...      ← contextos fatiados
```

---

## 2. Código

**Qualidade geral:** legível, nomes bons, componentes coesos. Mas o ESLint acusa **19 erros** (rodei `npx eslint src api`), e há bugs reais em produção:

### 🔴 BUG 1 — Editar OS corrompe dados reais com mock (OS.jsx:66–85)

```jsx
const handleEdit = (os) => {
  setEditingOS({
    ...os,
    clientPhone: os.clientPhone || '12999999999',        // telefone INVENTADO
    clientCPF: os.clientCPF || '000.000.000-00',         // CPF INVENTADO
    deviceFull: os.deviceFull || 'Notebook Dell Inspiron 15 3000 - S/N: ABC123XYZ',
    ...
  });
  setServiceItems([                                       // serviços MOCKADOS
    { id: 1, description: 'Limpeza Interna', price: 80.00 },
    { id: 2, description: 'Pasta Térmica MX-4', price: 45.00 },
  ]);
};
```

Ao abrir qualquer OS: (a) os serviços reais **não são carregados** — aparecem sempre "Limpeza Interna + Pasta Térmica = R$ 125,00"; (b) `saveEdit` grava `serviceValue: totalServices` → **toda OS gravada passa a valer R$ 125,00**; (c) os fallbacks inventados são persistidos no registro. E o pior: **os itens de serviço nunca são salvos na OS** — `saveEdit` só persiste o total, `serviceItems` é estado local descartado. O histórico do que foi feito no equipamento se perde.

**Correção:** `setServiceItems(os.services || [])`, remover todos os fallbacks fake, e em `saveEdit` gravar `{ ...editingOS, services: serviceItems, serviceValue: totalServices }`.

### 🔴 BUG 2 — ID de OS colide a cada 10 segundos (OS.jsx:37)

```js
id: Date.now().toString().slice(-4), // últimos 4 dígitos de ms → ciclo de 10s
```

Os últimos 4 dígitos de um timestamp em ms se repetem a cada 10.000 ms. Duas OS abertas em dias diferentes podem ter o mesmo ID — e como o sync mescla **por id** (`mergeRemote`), uma OS **sobrescreve a outra silenciosamente** no merge. Perda de dados garantida com o tempo. Use um contador sequencial persistido (OS nº 1001, 1002…) — clientes também precisam de um número citável.

### 🔴 BUG 3 — Datas em formato misto quebram o Dashboard (OS.jsx:41 vs Dashboard.jsx:127)

`handleSave` grava `date: new Date().toLocaleDateString('pt-BR')` → `"02/07/2026"`. O Dashboard faz `new Date(o.date)` → o JS interpreta como **7 de fevereiro** (formato US) ou `Invalid Date`. Resultado: OS somem dos períodos ou caem no mês errado; `entryDate` na edição (`new Date(entryDate + 'T12:00:00')`) vira `Invalid Date`. **Padronize: persistir sempre ISO-8601 e formatar só na exibição** (o `formatters.js` já existe para isso).

### 🔴 BUG 4 — Crash no autocomplete do PDV (PDV.jsx:43)

```js
p.barcode.includes(value)   // TypeError se barcode for undefined
```

Produto importado de backup ou criado sem barcode derruba a tela de venda. Use `(p.barcode || '').includes(value)`.

### 🟡 Código morto / botões que mentem

- Botão **"Aplicar Desconto [F3]"** (PDV.jsx:299): sem `onClick`, `discount = 0` hardcoded, F3 não existe no handler de teclado. O operador clica e nada acontece.
- Botão **"Re-imprimir Nota"** na edição de OS (OS.jsx:384): sem `onClick`.
- **Busca de OS** (OS.jsx:240): input sem `value`/`onChange` — não busca nada. Numa loja com dezenas de OS ativas, é a função mais usada da tela.
- `editTab`, `expandedId`, `handleTopServiceValueChange`, `Filter`, `Banknote`, `QrCode`, `addOS/updateOS/deleteOS` — declarados e nunca usados.
- Os 3 **templates de impressão** em Config são placebo: não existe CSS para `template-thermal-2`/`thermal-3` em PrintOS.css — trocar o modelo não muda nada.
- O cupom do PDV **ignora as configurações da loja**: PDV.jsx:452–454 imprime `INFO CENTRO / SJC — São Paulo / (12) 99999-9999` fixos, enquanto `Vendas.jsx` usa `settings`. Alterar o telefone em Config só afeta a reimpressão.

### 🟡 Dinheiro em float

`0.1 + 0.2 !== 0.3`. Todos os valores usam float e `parseFloat`. Em somas longas (fechamento de caixa, relatório anual) surgem centavos fantasma. **Padrão de mercado: armazenar em centavos inteiros** (`priceCents: 15000`) e formatar na borda.

### 🟡 Vendas some itens à meia-noite

`Vendas.jsx` filtra só `hoje` sem opção de período. Venda de ontem é inacessível pela UI (o dado existe, a tela não mostra). Cliente volta com troca no dia seguinte → operador não acha a venda.

---

## 3. Banco de Dados

A modelagem atual é um **espelho de blobs**, não um banco:

```js
// api/_models.js — todas as 4 coleções têm o MESMO schema
{ id: String (unique), updatedAt: Number, deleted: Boolean, data: Mixed }
```

- **`data: Mixed` = schema nenhum.** O servidor aceita qualquer formato; um cliente com bug grava lixo e ele se propaga para todos os terminais no pull. Sem validação de tipos, obrigatoriedade ou domínio de status.
- **Sem relacionamentos.** Cliente não é entidade (é string dentro da OS); item de venda copia o produto inteiro (snapshot é bom para preço histórico, mas sem `productId` consistente não há relatório por produto confiável — o Dashboard agrupa por `name`, que muda quando você renomeia o produto).
- **Índices:** só `id` e `updatedAt`. Suficiente para o sync atual; inútil para qualquer consulta de negócio (vendas por dia, OS por status) — que hoje nem existem no servidor.
- **Consultas N+1 no sync** (api/sync.js `upsertAll`): 1 `findOne` + 1 `updateOne` **por registro**, em série. 200 registros alterados = 400 round-trips ao Atlas dentro de uma função serverless. Use `bulkWrite` com `updateOne + upsert + filtro de updatedAt` — 1 round-trip.
- **Pull sem paginação:** um terminal novo (lastSyncAt=0) recebe **o banco inteiro em uma resposta**. Com histórico de vendas crescendo para sempre, isso estoura o limite de ~4,5 MB de resposta da Vercel e o sync morre para sempre. Precisa de paginação por cursor (`updatedAt > X limit 500`).
- **Campos faltantes no domínio:** produto sem `minStock` (crítico é `<= 2` fixo), sem categoria/NCM/unidade/custo médio; venda sem operador, sem cliente, sem desconto, sem status (cancelada?); OS sem histórico de status, sem laudo, sem garantia; nenhuma coleção de movimentação de estoque (kardex) — ajuste de estoque hoje é sobrescrita sem rastro.
- **Campos coletados e jogados fora:** o formulário de Nova OS pede **data de nascimento e endereço completo (CEP com ViaCEP!)** e o `handleSave` não persiste nenhum deles. Trabalho do operador desperdiçado.

---

## 4. Performance

Hoje, com 9 produtos, tudo voa. Os problemas aparecem com volume:

| Ponto | Problema | Efeito com escala |
|---|---|---|
| Context único | valor novo a cada render, sem memo; toda escrita re-renderiza PDV+OS+Dashboard+Estoque | UI trava durante venda com listas grandes |
| `diffStamp` (db.js:106) | `JSON.stringify` de **cada registro** da coleção inteira a cada escrita | cada venda serializa todos os produtos; O(n) por operação |
| Persistência monolítica | coleção inteira regravada no IndexedDB a cada mudança (`dbSet(key, stamped)`) | gravar 1 venda reescreve o array com 50k vendas |
| Sync pull | sem paginação; cliente novo baixa tudo | estoura serverless com histórico real |
| Sync push N+1 | findOne+updateOne por registro | timeout de função com lotes grandes |
| Listas sem virtualização/paginação | Estoque e Vendas renderizam tudo | DOM com milhares de linhas |
| Autocomplete PDV | `filter` linear a cada tecla | ok até ~10k produtos; depois, indexar (Map por barcode) |
| `todaySales` (Vendas.jsx:63) | `toLocaleDateString` para **cada venda** a cada render, sem `useMemo` | custo cresce com histórico total, não com o dia |

**Correções de maior alavancagem:** (1) fatiar o contexto (products/sales/os/settings separados, valores memoizados); (2) persistir por registro no IndexedDB (localforage suporta chave por item) em vez de array único; (3) `bulkWrite` + paginação no sync; (4) `useMemo` nas derivações de lista.

O que está **bem**: Dashboard já usa `useMemo` corretamente; gráfico SVG sem dependência é leve; debounce de 2,5 s no sync evita spam de rede.

---

## 5. Segurança — a parte mais grave

### 🔥 5.1 API pública sem autenticação (api/sync.js)

```js
res.setHeader('Access-Control-Allow-Origin', '*');
// ...nenhuma verificação de identidade em lugar nenhum
```

Qualquer pessoa que descubra a URL (`seu-app.vercel.app/api/sync`) pode, com um único POST:

- **Ler tudo**: `{ "lastSyncAt": 0 }` devolve todos os produtos com custo, todas as vendas, todas as OS com **nome, telefone, CPF e senha do equipamento dos seus clientes**;
- **Apagar tudo**: enviar tombstones com `deletedAt` alto marca todos os registros como deletados e a exclusão se propaga para os seus terminais no próximo pull;
- **Corromper tudo**: gravar qualquer `data` com `updatedAt` futuro (o LWW aceita, inclusive timestamps à frente do relógio — registros ficam "imexíveis").

Isso é violação direta da **LGPD** (dados pessoais + CPF expostos) e risco existencial do negócio. **Não existe mitigação parcial: sem auth, o sistema não pode estar na internet.**

Correção mínima imediata (1 dia): token compartilhado forte em header + CORS restrito ao domínio:

```js
// api/sync.js
const auth = req.headers.authorization;
if (auth !== `Bearer ${process.env.SYNC_TOKEN}`) {
  return res.status(401).json({ error: 'unauthorized' });
}
res.setHeader('Access-Control-Allow-Origin', 'https://seu-dominio.vercel.app');
```

Correção correta (curto prazo): login por usuário (Auth.js/Clerk/JWT próprio), com o token identificando **quem** fez cada operação.

### 🔥 5.2 Senhas de equipamentos de clientes em texto puro

`devicePassword` é digitada, exibida na tela, impressa e sincronizada sem qualquer proteção. Combinada com a API aberta, é vazamento de credenciais de terceiros. Mínimo: criptografar no cliente (AES-GCM via WebCrypto) antes de sincronizar; ideal: repensar se precisa guardar (muitas assistências usam campo "padrão de desbloqueio" efêmero impresso só na via da bancada).

### 🔥 5.3 Sem autorização/perfis

Não há usuários. Qualquer operador vê custo dos produtos, lucro no Dashboard, apaga vendas do histórico via import de backup e altera configurações. O rodapé "Administrador" (Sidebar.jsx:79) é decorativo. Para funcionário no caixa, o mínimo é: perfil operador (vende, abre OS) vs. gerente (custo, relatórios, exclusões, backup).

### Demais pontos

- **SQL/NoSQL injection:** superfície baixa — ids são convertidos com `String()` e o lookup de coleção usa mapa fixo (`MODELS[t.store]`), bom. Mas `data: Mixed` aceita objetos com chaves `$` — sanitize com `mongo-sanitize` por precaução.
- **XSS:** React escapa por padrão e não há `dangerouslySetInnerHTML` — ok. O link do WhatsApp (OS.jsx:414) monta `href` com telefone limpo por regex — ok.
- **Rate limit:** inexistente. Combine com auth (Vercel + Upstash rate limit é trivial).
- **Logs/auditoria:** inexistentes. Em PDV, trilha de auditoria (quem cancelou, quem deu desconto, quem apagou produto) é requisito de controle interno contra fraude de balcão.
- **Backup import** (Config.jsx) substitui tudo com um `window.confirm` — sem perfil gerente, qualquer um "restaura" um arquivo e apaga a operação do dia (o LWW propaga).
- **.env:** corretamente fora do git (verifiquei `git ls-files`). O comentário no arquivo já diz "troque a senha depois" — **troque agora** e crie um usuário Atlas com escopo mínimo (readWrite só no db `infopdv`).

---

## 6. UX (operador 8 h/dia)

**Acertos que merecem elogio:** foco automático permanente no campo de código de barras (clique em qualquer lugar devolve o foco — exatamente o que um PDV precisa); Enter adiciona o 1º resultado; item avulso integrado ao fluxo de busca; F2/F4/Esc; cálculo de troco em tempo real com destaque; filtros de OS numerados como chips; ViaCEP com pulo automático para o campo número.

**Problemas, em ordem de dor diária:**

1. **Busca de OS não funciona** (item mais usado da tela — ver Bug seção 2).
2. **Histórico de vendas só mostra hoje** — troca/consulta de ontem exige exportar backup e ler JSON.
3. **Botões mortos** (Desconto, Re-imprimir OS) ensinam o operador a desconfiar da UI.
4. **Sem desfazer / sem confirmação inteligente:** F4 limpa o carrinho inteiro sem confirmar (um F4 acidental perde uma venda de 15 itens digitada); excluir produto usa `window.confirm` genérico.
5. **Quantidade no carrinho:** não dá para digitar `3x` no leitor nem editar qtd inline — editar quantidade de item de estoque abre o modal de "item avulso" (e o item **perde o vínculo/`isAvulso` implícito?** — não, mantém id, mas o modal chama-se "Editar Item" com cara de avulso; confuso).
6. **Impressão sem escolha:** finalizar venda **sempre** dispara `window.print()` — cliente que não quer cupom obriga o operador a cancelar o diálogo do navegador toda venda. Botão "Finalizar sem imprimir" economiza horas/mês.
7. **Fluxo Nova OS coleta 14 campos** incluindo endereço completo e nascimento **que são descartados** (seção 3). Ou persiste, ou corta os campos — hoje é o pior dos dois mundos: cansa e não serve.
8. **Modais sem focus-trap** e sem `aria-modal`; Esc fecha (bom), mas Tab vaza para trás do overlay.
9. **Sem indicador de estoque no autocomplete** — operador só descobre que não tem o item depois de vender (e o sistema deixa: estoque vai a 0 silenciosamente via `Math.max(0, ...)`, sem aviso de venda sem estoque).
10. Status de OS com nomes informais acoplados à lógica: `'Pronto Avisar Cliente.'` (com ponto final) e `'Marcondes'` (nome de pessoa como status!) são comparados por string exata em 4 arquivos. Renomear o status no select quebra filtros, dashboard e contas a receber. Use constantes/enum já.

---

## 7. Funcionalidades de PDV — o que falta vs. mercado

| Área | Estado atual | O que um PDV comercial precisa |
|---|---|---|
| Abertura/fechamento de caixa | ❌ inexistente | fundo de troco, sangria, suprimento, conferência cega, relatório Z por operador |
| Venda | ✅ básica | desconto (item e total), múltiplas formas por venda, cliente vinculado, vendedor, cancelamento com motivo |
| Orçamento | ❌ | orçamento → converte em venda/OS, validade, impressão |
| Troca/Devolução | ❌ | devolução referenciando venda origem, estorno de estoque, vale-troca |
| OS | ⚠️ parcial (com bugs) | nº sequencial, laudo, aprovação do cliente, peças do estoque na OS, garantia, histórico de status, prazo |
| Clientes | ❌ (string na OS) | cadastro próprio, histórico de compras/OS, crédito, aniversário (o campo já é pedido!) |
| Estoque | ⚠️ CRUD simples | kardex (movimentações), entrada por compra, custo médio, estoque mínimo por produto, inventário |
| Etiquetas | ❌ | geração de etiqueta de prateleira/código de barras a partir do cadastro |
| Garantia | ❌ | prazo por item vendido/serviço, alerta na devolução |
| Comissão | ❌ | % por vendedor/técnico, relatório mensal |
| Financeiro | ❌ | contas a pagar/receber, fluxo de caixa, DRE simples (o Dashboard chama OS prontas de "contas a receber", mas não é um módulo) |
| Fiscal 🇧🇷 | ❌ ("cupom não fiscal") | emissão NFC-e/SAT — **obrigação legal para varejo na maioria dos estados**; APIs como Focus NFe/eNotas/PlugNotas resolvem sem SEFAZ direto |
| Pagamento | ❌ (só registra) | integração TEF/maquininha ou ao menos PIX dinâmico (QR com valor via API do PSP) — elimina erro de digitação |
| Multiusuário | ❌ | login, perfis, trilha de auditoria |
| Relatórios | ⚠️ só Dashboard | vendas por período/produto/vendedor, margem, curva ABC, exportar CSV |

---

## 8. Automação — maiores retornos primeiro

1. **WhatsApp "OS pronta"**: hoje o status chama-se literalmente "Pronto **Avisar** Cliente" — o sistema sabe que precisa avisar e não avisa. Um clique (ou automático na mudança de status) → template WhatsApp via Twilio/Z-API/Evolution com nome, equipamento e valor. É a automação com melhor custo/benefício do sistema inteiro.
2. **Backup automático agendado** (hoje é botão manual + sync): export diário para Google Drive/S3 com retenção. O sync NÃO é backup — um delete propagado apaga na nuvem também.
3. **Etiquetas automáticas** na entrada de produto (JsBarcode gera Code128 no navegador; imprime na própria térmica).
4. **Emissão fiscal automática** no fechamento da venda (API Focus NFe/PlugNotas).
5. **Alerta de estoque mínimo** → gera lista de compras/pedido de reposição por fornecedor.
6. **Lembrete de retirada**: OS pronta há X dias sem retirada → mensagem automática (e política de abandono).
7. **Pesquisa de satisfação** pós-OS via WhatsApp.

---

## 9. Inteligência Artificial — onde faz sentido aqui

Ordenado por viabilidade real (evite IA antes de ter dados limpos e auth):

1. **Geração de descrição/cadastro de produto**: foto ou nome curto → descrição, categoria e NCM sugeridos (LLM barato via API).
2. **OCR de nota de fornecedor** → entrada de estoque automática (foto da NF-e/DANFE → itens, quantidades, custos). Elimina a digitação mais chata da loja.
3. **Diagnóstico assistido em OS**: defeito relatado → sugestões de causas prováveis e checklist com base no histórico das suas próprias OS.
4. **Previsão de demanda/reposição**: com 6+ meses de vendas, prever ruptura por item (não precisa de LLM; média móvel/sazonalidade simples já ganha do "olhômetro").
5. **Chatbot de status de OS** no WhatsApp: cliente pergunta "e meu notebook?" → bot consulta a OS e responde.
6. **Detecção de anomalia em caixa**: descontos atípicos, cancelamentos frequentes por operador (requer trilha de auditoria antes).

---

## 10. Escalabilidade (múltiplas lojas, milhões de vendas)

**Resposta direta: a arquitetura atual não suporta esse crescimento**, e o motivo é estrutural, não de otimização:

- **Todo o dataset vive na memória do navegador** e é regravado por inteiro a cada mudança. "Milhões de vendas" no modelo atual = gigabytes no IndexedDB e arrays em RAM. O modelo precisa migrar de "espelho total" para "servidor é a fonte, cliente mantém janela de trabalho" (produtos + vendas do dia + OS abertas).
- **Sem tenancy**: nenhum registro tem `storeId`. Multi-loja exige isso em cada documento, em cada query e no sync — retrofit caro; se multi-loja está no horizonte, adicione `storeId` no schema **agora**, mesmo com valor fixo.
- **LWW por registro inteiro perde dinheiro com 2+ terminais**: dois caixas vendem o mesmo produto no mesmo intervalo de sync → as duas baixas de estoque viram duas versões do registro inteiro e **uma baixa é descartada** no merge. Estoque incrementalmente errado sem ninguém perceber. Solução: estoque por **eventos** (movimentações apenas-adição, estoque = soma) em vez de campo mutável — de quebra ganha o kardex da seção 7.
- **Vendas são naturalmente append-only** — essa parte escala bem conceitualmente; o problema é só o transporte (paginação) e o armazenamento local monolítico.
- Vercel serverless + Atlas aguentam o tráfego de dezenas de lojas tranquilamente **se** o sync for paginado e bulk. A limitação não é a infra, é o protocolo.

Caminho recomendado: manter offline-first no PDV (é o diferencial certo), evoluindo o servidor de "espelho burro" para API com endpoints de domínio (`POST /sales`, `POST /stock-movements`) com validação — o sync genérico fica só para o modo offline.

---

## 11. Notas (0–10)

| Dimensão | Nota | Justificativa |
|---|---|---|
| Arquitetura | **4** | Organização de pastas boa e offline-first correto; mas sem camada de domínio, estado monolítico, backend de 1 endpoint genérico sem modelo de negócio |
| Código | **5** | Legível, comentários bons, formatters centralizados; porém mocks corrompendo dados reais, 19 erros de lint, botões mortos, datas inconsistentes, dinheiro em float |
| Banco | **3** | `Mixed` sem schema/validação, sem relacionamentos, sem cliente como entidade, N+1 no sync, sem paginação; índices só do sync |
| Segurança | **1** | API pública sem auth com CPF e senhas de clientes; sem usuários; sem auditoria; sem rate limit. O 1 (e não 0) é porque React previne XSS e ids são sanitizados |
| UX | **6** | PDV com ótimos fundamentos de balcão (foco, atalhos, troco); derrubado por busca de OS morta, histórico só-hoje e botões placebo |
| Performance | **5** | Rápido no volume atual; padrões (context único, regravação total, stringify por escrita, pull integral) degradam de forma previsível com dados reais |
| Organização | **6** | src/ limpo e consistente; repo com lixo (tela-os.html, BACKUPSH), 2 commits, README de template, zero testes |
| Escalabilidade | **2** | Sem tenancy, dataset inteiro no cliente, LWW perde escrita concorrente de estoque, sync sem paginação |
| Manutenibilidade | **5** | Código pequeno e claro joga a favor; duplicação (impressão 4×, status 3×), acoplamento por CSS e ausência total de testes jogam contra |

---

## 12. Melhorias priorizadas

### 🔥 Críticas — antes de qualquer uso real na internet
1. **Autenticação na API + CORS restrito** (seção 5.1) — sem isso, tire o deploy do ar.
2. **Remover mocks do `handleEdit` da OS** e persistir `services` na OS (Bug 1) — hoje editar OS corrompe dados.
3. **Trocar geração de ID da OS** por sequência persistida (Bug 2) e do ID de venda por UUID (`crypto.randomUUID()`).
4. **Padronizar datas em ISO** (Bug 3) — Dashboard está calculando errado hoje.
5. **Trocar a senha do Atlas** (o próprio .env pede) e criar usuário de escopo mínimo.
6. **Backup externo automático** — sync não protege contra deleção propagada.
7. Corrigir crash `p.barcode.includes` (Bug 4).

### ⚠️ Importantes — próximas semanas
8. Login com perfis (operador/gerente) + esconder custo/lucro do operador.
9. Implementar busca de OS, filtro de período em Vendas, e remover/implementar botões mortos (Desconto de verdade: precisa de justificativa+perfil).
10. Cadastro de clientes como entidade (a OS já coleta os dados — hoje descarta).
11. Movimentações de estoque (kardex) no lugar de campo `stock` mutável — resolve concorrência e auditoria de uma vez.
12. Constantes para status de OS; extrair componente único de impressão; cupom do PDV usar `settings`.
13. Validação de schema no servidor (zod compartilhado front/back) + `bulkWrite` + paginação do sync.
14. Dinheiro em centavos inteiros.
15. Abertura/fechamento de caixa com conferência — controle básico de balcão.
16. Testes nos módulos de domínio extraídos (vitest): diffStamp/mergeRemote já são puros e testáveis hoje.

### 💡 Melhorias futuras
17. Emissão fiscal NFC-e/SAT via API (verificar obrigatoriedade no seu estado — provavelmente já é exigível).
18. Orçamentos, trocas/devoluções com vínculo à venda origem, garantia por item.
19. Etiquetas com código de barras; leitor USB já funciona, falta gerar as etiquetas.
20. Contas a pagar/receber + fluxo de caixa real.
21. Virtualização/paginação de listas; contexto fatiado; persistência por registro.
22. TypeScript gradual (começando por domain/ e api/).

### 🚀 Ideias inovadoras
23. WhatsApp automático "OS pronta" + chatbot de status (seção 8/9).
24. OCR de nota de fornecedor para entrada de estoque em segundos.
25. Portal do cliente: página pública `infocentro.com.br/os/{token}` para acompanhar a OS (o rodapé impresso já promete isso!).
26. PIX dinâmico no checkout com QR na tela do cliente.
27. Previsão de reposição com base no histórico + curva ABC automática.

---

## 13. Roadmap

**Curto prazo (2–6 semanas) — "parar de sangrar":**
Itens 1–7 (críticos) + login básico + busca de OS + período em Vendas + constantes de status. Meta: sistema seguro e sem corrupção de dados, confiável para uso diário por 2+ pessoas.

**Médio prazo (2–4 meses) — "virar um PDV de verdade":**
Clientes, caixa (abertura/fechamento/sangria), kardex de estoque, descontos com permissão, orçamentos, trocas, cupom configurável de fato, validação de schema no servidor, sync paginado com bulkWrite, testes de domínio, backup automatizado externo, WhatsApp de OS pronta. Meta: cobrir o ciclo completo de uma loja de informática com auditoria.

**Longo prazo (6–12 meses) — "escalar":**
`storeId` + multi-loja, API de domínio com eventos de estoque, emissão fiscal integrada, financeiro completo (pagar/receber/fluxo), comissões, portal do cliente, relatórios exportáveis, TypeScript, e as automações de IA (OCR de NF, previsão de demanda). Meta: múltiplas lojas e terminais concorrentes sem perda de escrita.

---

## Apêndice — inventário de arquivos auditados

`api/_db.js`, `api/_models.js`, `api/sync.js`, `src/App.jsx`, `src/main.jsx`, `src/context/GlobalState.jsx`, `src/components/Sidebar.jsx`, `src/modules/{PDV,OS,Vendas,Estoque,Dashboard,Config}.jsx`, `src/utils/{db,sync,formatters}.js`, todos os CSS, `vite.config.js`, `eslint.config.js`, `package.json`, `.env`(mascarado), `.gitignore`, `.npmrc`, histórico git, `tela-os.html`, estrutura de `BACKUPSH/`.
