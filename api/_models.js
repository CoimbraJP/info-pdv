/**
 * Models Mongoose para o PDV (multi-loja).
 *
 * Cada documento guarda o registro completo do app em `data` (Mixed), além de
 * `id` (id gerado no cliente, chave de sincronização), `updatedAt` (epoch ms,
 * last-write-wins) e `deleted` (tombstone).
 *
 * Multi-loja: cada loja tem um BANCO próprio no mesmo cluster (ex.: infopdv,
 * eaglegames). `modelsFor(dbName)` devolve os models ligados ao banco certo,
 * reaproveitando a mesma conexão (useDb com cache).
 */
import mongoose from 'mongoose';

const makeSchema = () =>
  new mongoose.Schema(
    {
      id: { type: String, required: true, unique: true, index: true },
      updatedAt: { type: Number, default: 0, index: true },
      // Hora do SERVIDOR em que o registro chegou: o pull usa este campo, e não o
      // updatedAt (que vem do relógio de cada computador e pode estar errado).
      syncedAt: { type: Number, index: true },
      deleted: { type: Boolean, default: false },
      data: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { minimize: false, versionKey: false }
  );

const COLLECTIONS = {
  Product: 'products',
  Sale: 'sales',
  ServiceOrder: 'serviceorders',
  Settings: 'settings',
  System: 'system',
  Etiqueta: 'etiquetas',
};

const bind = (conn) => {
  const m = {};
  for (const [name, collection] of Object.entries(COLLECTIONS)) {
    m[name] = conn.models[name] || conn.model(name, makeSchema(), collection);
  }
  m.MODELS = {
    products: m.Product,
    sales: m.Sale,
    serviceOrders: m.ServiceOrder,
    settings: m.Settings,
    etiquetas: m.Etiqueta,
  };
  return m;
};

/** Models ligados a um banco específico (mesma conexão, banco diferente). */
export const modelsFor = (dbName) =>
  bind(mongoose.connection.useDb(dbName, { useCache: true }));

/* Models do banco padrão (Info Centro) — usados pelo /api/crm-sync. */
const base = bind(mongoose);
export const Product = base.Product;
export const Sale = base.Sale;
export const ServiceOrder = base.ServiceOrder;
export const Settings = base.Settings;
export const System = base.System;
export const MODELS = base.MODELS;
