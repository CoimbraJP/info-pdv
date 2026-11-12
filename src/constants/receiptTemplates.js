/** Modelos de cupom (Elgin i8) — escolhidos em Configurações, por loja. */

export const SALE_TEMPLATES = [
  { id: 'B1', name: 'Simples', desc: 'Item em negrito; qtd × unitário e total embaixo.' },
  { id: 'B2', name: 'Total em faixa preta', desc: 'Igual ao B1, com o TOTAL A PAGAR em faixa preta.' },
  { id: 'B3', name: 'Com separadores', desc: 'Pontilhado entre os itens e contagem de itens.' },
  { id: 'B4', name: 'Logo / moldura', desc: 'Logo da loja no topo (ou nome em moldura, sem logo).' },
  { id: 'B5', name: 'Total ao lado', desc: 'Item e total na mesma linha; qtd × unitário pequeno.' },
];
export const OS_TEMPLATES = [
  { id: '1', name: 'Rótulo: valor', desc: 'Na ordem: dados do cliente e do equipamento.' },
  { id: '2', name: 'Rótulos em cima', desc: 'Rótulo pequeno em cima e valor embaixo.' },
  { id: '3', name: 'Em molduras', desc: 'Cliente e equipamento em quadros.' },
  { id: '4', name: 'Compacto', desc: 'Poucas linhas, gasta menos papel.' },
  { id: '5', name: 'Títulos em faixa preta', desc: 'Faixa preta nos títulos das seções.' },
];
export const DEFAULT_SALE_TEMPLATE = 'B4';
export const DEFAULT_OS_TEMPLATE = '4';

/** Dados de exemplo das miniaturas e do "Testar impressão". */
export const SAMPLE_SALE = {
  id: 'EXEMPLO-A3F9C1',
  items: [
    { name: 'MEMÓRIA RAM DDR4 8GB KINGSTON', price: 150, quantity: 1 },
    { name: 'CABO HDMI 2.0 2 METROS', price: 35, quantity: 2 },
  ],
  subtotal: 220, discount: 20, total: 200,
  paymentMethod: 'cartao', cardType: 'credito', installments: 3,
};
export const SAMPLE_OS = {
  id: '1004', client: 'CARLOS MENDES', clientCPF: '123.456.789-09', clientPhone: '(12) 98765-4321',
  clientAddress: { street: 'Rua das Flores', number: '45', neighborhood: 'Jd. Satélite', city: 'São José dos Campos', state: 'SP' },
  deviceFull: 'NOTEBOOK DELL VOSTRO 3300', devicePassword: '1234', agreedPrice: 250,
  accessories: 'Carregador original', defect: 'Não liga. A luz de energia pisca 3 vezes.',
};
