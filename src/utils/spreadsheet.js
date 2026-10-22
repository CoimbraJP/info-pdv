/**
 * Planilhas sem biblioteca externa.
 *
 * Exportação: "Planilha XML 2003" (SpreadsheetML) com extensão .xls — o Excel
 * abre direto em colunas, com acentos, e o código de barras fica como TEXTO
 * (em .csv/.txt o Excel transforma 7891234567890 em 7,89E+12).
 *
 * Importação aceita: essa mesma planilha XML (salva pelo Excel), texto
 * separado por tabulação, ponto e vírgula ou vírgula. .xlsx (zip) não.
 */

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param {string[]} headers
 * @param {Array<Array<string|number>>} rows  números viram célula Number; o resto, String
 * @param {string[]} [textCols] índices que devem ser texto mesmo parecendo número (ex.: código)
 * @param {number[]} [moneyCols] índices exibidos com 2 casas (ex.: 2.399,90)
 */
export function buildXmlSpreadsheet(headers, rows, { sheetName = 'Planilha', textCols = [], moneyCols = [] } = {}) {
  const cell = (v, i) => {
    const isNum = typeof v === 'number' && Number.isFinite(v) && !textCols.includes(i);
    const style = !isNum ? ' ss:StyleID="t"' : (moneyCols.includes(i) ? ' ss:StyleID="m"' : '');
    return `<Cell${style}><Data ss:Type="${isNum ? 'Number' : 'String'}">${esc(v)}</Data></Cell>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style><Style ss:ID="t"><NumberFormat ss:Format="@"/></Style><Style ss:ID="m"><NumberFormat ss:Format="#,##0.00"/></Style></Styles>
<Worksheet ss:Name="${esc(sheetName)}"><Table>
<Row>${headers.map((h) => `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}</Row>
${rows.map((r) => `<Row>${r.map(cell).join('')}</Row>`).join('\n')}
</Table></Worksheet></Workbook>`;
}

export function downloadSpreadsheet(xml, filename) {
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

/** Planilha XML 2003 → linhas (respeita ss:Index, que o Excel usa ao pular células vazias). */
function parseXmlSpreadsheet(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Planilha XML inválida');
  const table = doc.getElementsByTagNameNS('*', 'Table')[0];
  if (!table) return [];
  return Array.from(table.getElementsByTagNameNS('*', 'Row')).map((row) => {
    const out = [];
    for (const c of Array.from(row.getElementsByTagNameNS('*', 'Cell'))) {
      const idx = c.getAttribute('ss:Index') || c.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet', 'Index');
      if (idx) while (out.length < Number(idx) - 1) out.push('');
      out.push((c.getElementsByTagNameNS('*', 'Data')[0]?.textContent || '').trim());
    }
    return out;
  });
}

/** Separa uma linha de CSV respeitando aspas. */
function splitDelimited(line, sep) {
  if (sep === '\t') return line.split('\t');
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (ch === sep && !quoted) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Texto do arquivo → linhas de células (strings). */
export function parseSpreadsheet(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  if (clean.startsWith('PK')) {
    throw new Error('Arquivo .xlsx não é suportado. No Excel, use "Salvar como" → "Planilha XML 2003" ou "Texto (separado por tabulação)".');
  }
  if (/<Workbook[\s>]/.test(clean)) return parseXmlSpreadsheet(clean);

  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0];
  const sep = head.includes('\t') ? '\t' : (head.split(';').length > head.split(',').length ? ';' : ',');
  return lines.map((l) => splitDelimited(l, sep).map((v) => v.trim()));
}
