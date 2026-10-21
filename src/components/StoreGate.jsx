import { useEffect, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { storeForCode } from '../utils/system';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

/**
 * Tela inicial: código da loja (ex.: 000 = Info Centro, 111 = Eagle Games).
 * O código escolhe a loja e libera o modo Vendedor; custos e telas de ADM
 * continuam protegidos pela senha ADM de cada loja.
 */
const StoreGate = ({ system, onEnter }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const fail = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setCode('');
    inputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy || !code.trim()) return;
    if (Date.now() < lockedUntil) {
      setError(`Muitas tentativas. Aguarde ${Math.ceil((lockedUntil - Date.now()) / 1000)}s.`);
      return;
    }
    setBusy(true);
    try {
      const store = await storeForCode(code, system);
      if (store) { onEnter(store); return; }
      const n = attempts + 1;
      if (n >= MAX_ATTEMPTS) {
        setAttempts(0);
        setLockedUntil(Date.now() + LOCKOUT_MS);
        fail('Muitas tentativas. Aguarde 30s.');
      } else {
        setAttempts(n);
        fail('Código inválido.');
      }
    } catch (err) {
      fail(err.message || 'Erro ao validar o código.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="store-gate">
      <form className={`store-gate-card ${shake ? 'is-shaking' : ''}`} onSubmit={handleSubmit}>
        <div className="store-gate-icon"><KeyRound size={28} /></div>
        <h1 className="store-gate-title">Código da loja</h1>
        <p className="store-gate-sub">Digite o código para abrir o sistema</p>
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          className="input store-gate-input"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(''); }}
          placeholder="•••"
          aria-label="Código da loja"
        />
        <p className="admin-modal-error" role="alert">{error}</p>
        <button type="submit" className="btn btn-primary store-gate-btn" disabled={busy || !code.trim()}>
          Entrar <kbd className="kbd kbd-on-primary">Enter</kbd>
        </button>
      </form>
    </div>
  );
};

export default StoreGate;
