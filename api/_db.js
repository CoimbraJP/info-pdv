/**
 * Conexão Mongoose reutilizável para ambiente serverless (Vercel).
 *
 * Em serverless cada invocação pode reaproveitar o processo. Guardamos a
 * conexão (e a promise em andamento) num cache global para não abrir uma nova
 * conexão a cada request, o que esgotaria o pool do MongoDB Atlas.
 */
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI não definida nas variáveis de ambiente (.env).');
  }
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        dbName: process.env.MONGODB_DB || 'infopdv',
        bufferCommands: false,
        serverSelectionTimeoutMS: 10000,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
