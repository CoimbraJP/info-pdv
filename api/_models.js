/**
 * Models Mongoose para o INFO CENTRO.
 *
 * Cada documento guarda o registro completo do app em `data` (Mixed), além de
 * `id` (id gerado no cliente, usado como chave de sincronização), `updatedAt`
 * (epoch ms, para last-write-wins) e `deleted` (tombstone). Essa abordagem
 * mantém o servidor robusto a mudanças na forma dos dados do front.
 */
import mongoose from 'mongoose';

const makeSchema = () =>
  new mongoose.Schema(
    {
      id: { type: String, required: true, unique: true, index: true },
      updatedAt: { type: Number, default: 0, index: true },
      deleted: { type: Boolean, default: false },
      data: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { minimize: false, versionKey: false }
  );

const model = (name, collection) =>
  mongoose.models[name] || mongoose.model(name, makeSchema(), collection);

export const Product = model('Product', 'products');
export const Sale = model('Sale', 'sales');
export const ServiceOrder = model('ServiceOrder', 'serviceorders');
export const Settings = model('Settings', 'settings');

/** Mapa coleção lógica -> model, usado pelo endpoint de sync. */
export const MODELS = {
  products: Product,
  sales: Sale,
  serviceOrders: ServiceOrder,
  settings: Settings,
};
