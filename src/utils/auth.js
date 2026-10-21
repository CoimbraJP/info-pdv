/**
 * Controle de acesso Vendedor × Administrador.
 *
 * O app SEMPRE abre no modo Vendedor; o modo ADM exige a senha do
 * administrador. A senha nunca é guardada em texto: só o hash SHA-256
 * (em settings.adminPinHash), que sincroniza entre os terminais — uma
 * senha só para todas as máquinas da loja.
 *
 * Limite importante: é uma trava de interface (impede o vendedor de ver
 * custo, margem e telas administrativas no uso normal). Não é segurança
 * de servidor: quem tiver acesso técnico ao navegador ainda consegue ler
 * os dados locais. Login por usuário no backend está no roadmap.
 */

export const ROLE = { VENDEDOR: 'vendedor', ADMIN: 'admin' };

/**
 * Telas que só o administrador vê. Vendedor fica com PDV, Histórico de
 * Vendas (sem faturamento — serve para reimprimir recibo), OS e Estoque.
 */
export const ADMIN_ONLY_MODULES = ['dashboard', 'etiquetas', 'config'];

export const canAccessModule = (moduleId, isAdmin) =>
  isAdmin || !ADMIN_ONLY_MODULES.includes(moduleId);

export const MIN_PASSWORD_LENGTH = 4;

/** Hash SHA-256 (hex) da senha, com prefixo fixo da aplicação. */
export async function hashPassword(password) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Navegador sem suporte a criptografia (use HTTPS).');
  }
  const data = new TextEncoder().encode(`infocentro-pdv:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
