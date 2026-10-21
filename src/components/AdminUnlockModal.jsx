import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, X, Lock } from 'lucide-react';
import { useGlobalState } from '../context/GlobalState';
import { MIN_PASSWORD_LENGTH } from '../utils/auth';

/** Após N tentativas erradas, bloqueia novas tentativas por alguns segundos. */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

/**
 * Modal para entrar no modo ADM.
 * - Se ainda não existe senha: cria (senha + confirmação) e já entra.
 * - Se existe: pede a senha.
 */
const AdminUnlockModal = ({ onClose, onUnlocked }) => {
  const { hasAdminPassword, unlockAdmin, createAdminPassword } = useGlobalState();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const inputRef = useRef(null);

  const creating = !hasAdminPassword;

  // onClose chega como arrow nova a cada render; guardar em ref evita que o
  // efeito rode de novo e roube o foco do campo "Confirmar senha".
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fail = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setPassword('');
    setConfirm('');
    inputRef.current?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;

    if (Date.now() < lockedUntil) {
      const s = Math.ceil((lockedUntil - Date.now()) / 1000);
      setError(`Muitas tentativas. Aguarde ${s}s.`);
      return;
    }

    setBusy(true);
    try {
      if (creating) {
        if (password !== confirm) return fail('As senhas não conferem.');
        const res = await createAdminPassword(password);
        if (!res.ok) return fail(res.error);
        onUnlocked();
        return;
      }

      const ok = await unlockAdmin(password);
      if (ok) {
        onUnlocked();
        return;
      }
      const n = attempts + 1;
      setAttempts(n);
      if (n >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setAttempts(0);
        fail('Muitas tentativas. Aguarde 30s.');
      } else {
        fail('Senha incorreta.');
      }
    } catch (err) {
      fail(err.message || 'Erro ao validar a senha.');
    } finally {
      setBusy(false);
    }
  };

  // Portal no <body>: o overlay não fica preso ao layout da sidebar.
  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-content card admin-modal ${shake ? 'is-shaking' : ''}`} role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
        <div className="flex justify-between items-center mb-4">
          <h3 id="admin-modal-title" className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary" />
            {creating ? 'Criar senha do ADM' : 'Modo Administrador'}
          </h3>
          <button type="button" className="btn-icon" onClick={onClose} title="Fechar">
            <X size={20} className="text-muted" />
          </button>
        </div>

        <p className="text-sm text-muted mb-4">
          {creating
            ? 'Primeiro acesso: defina a senha que libera o modo Administrador em todos os terminais.'
            : 'Digite a senha para liberar custos, margens, relatórios e configurações.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group mb-3">
            <label htmlFor="admin-pass">{creating ? 'Nova senha' : 'Senha'}</label>
            <input
              id="admin-pass"
              ref={inputRef}
              type="password"
              className="input"
              autoComplete={creating ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder={creating ? `Mínimo ${MIN_PASSWORD_LENGTH} caracteres` : '••••'}
            />
          </div>

          {creating && (
            <div className="form-group mb-3">
              <label htmlFor="admin-pass-confirm">Confirmar senha</label>
              <input
                id="admin-pass-confirm"
                type="password"
                className="input"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(''); }}
              />
            </div>
          )}

          <p className="admin-modal-error" role="alert">{error}</p>

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={busy || !password}>
              <Lock size={16} /> {creating ? 'Criar e entrar' : 'Entrar como ADM'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default AdminUnlockModal;
