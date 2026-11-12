/**
 * Impressão da O.S. na Elgin i8 (corte automático).
 *
 * Ordem: VIA DA LOJA primeiro, depois VIA DO CLIENTE — o último papel que sai
 * da impressora é o que vai para o cliente.
 *
 * Modos (Configurações > Impressão):
 *  - 'pagina'  : um trabalho só, com quebra de página entre as vias. A i8 corta
 *                entre elas quando o driver está para cortar a cada página.
 *  - 'separado': dois trabalhos de impressão (loja, depois cliente). A i8 corta
 *                no fim de cada trabalho — funciona com qualquer configuração do
 *                driver, mas abre a janela de impressão duas vezes (a não ser que
 *                o Chrome esteja em impressão direta).
 */
export const OS_PRINT_MODES = { PAGINA: 'pagina', SEPARADO: 'separado' };

export function runOSPrint(setOnly, mode, after) {
  if (mode !== OS_PRINT_MODES.SEPARADO) {
    setOnly(null);
    setTimeout(() => { window.print(); after?.(); }, 150);
    return;
  }
  setOnly('loja');
  setTimeout(() => {
    window.print(); // o Chrome segura aqui até a janela de impressão fechar
    setOnly('cliente');
    setTimeout(() => {
      window.print();
      setOnly(null);
      after?.();
    }, 250);
  }, 150);
}
