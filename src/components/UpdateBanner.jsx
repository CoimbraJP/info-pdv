import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const CHECK_EVERY_MS = 15 * 60 * 1000; // procura versão nova a cada 15 min

/**
 * Atualização do app (PWA).
 *
 * O service worker guarda o sistema no computador (abre rápido e offline),
 * mas o caixa continuava rodando a versão antiga depois de um deploy: a tela
 * já aberta não muda sozinha. Agora:
 *  - procura versão nova ao abrir, a cada 15 min e ao voltar para a janela;
 *  - quando a nova assume, mostra "Nova versão disponível — Atualizar";
 *  - não recarrega sozinho (o carrinho do PDV fica só em memória).
 */
let registration = null;
let notify = null;
let updateReady = false;

if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Primeira instalação não é "atualização"; troca de SW com app aberto é.
    if (hadController) { updateReady = true; notify?.(); }
    hadController = true;
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      registration = reg;
      setInterval(() => reg.update().catch(() => {}), CHECK_EVERY_MS);
    }).catch((err) => console.warn('[pwa] registro falhou:', err));
  });
}

const UpdateBanner = () => {
  const [show, setShow] = useState(updateReady);

  useEffect(() => {
    notify = () => setShow(true);
    const onFocus = () => registration?.update().catch(() => {});
    window.addEventListener('focus', onFocus);
    return () => { notify = null; window.removeEventListener('focus', onFocus); };
  }, []);

  if (!show) return null;
  return (
    <div className="update-banner" role="status">
      <RefreshCw size={16} />
      <span>Nova versão do sistema disponível.</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
        Atualizar agora
      </button>
    </div>
  );
};

export default UpdateBanner;
