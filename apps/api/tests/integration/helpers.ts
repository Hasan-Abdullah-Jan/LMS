import request from 'supertest';
import { createApp } from '../../src/app.js';

export const app = createApp();
export const api = () => request(app);

export const PASSWORD = 'Gutech@2026';
export const USERS = {
  admin: 'admin@gutech.demo',
  aisha: 'aisha.balushi@gutech.demo', // teaches CS101, MATH150
  omar: 'omar.rawahi@gutech.demo', // teaches CS201, MATH150
  fatima: 'fatima.hinai@gutech.demo', // CS101, CS201, MATH150
  yousuf: 'yousuf.lawati@gutech.demo', // CS101, CS201
  maryam: 'maryam.kindi@gutech.demo', // CS101, CS201, MATH150
  salim: 'salim.farsi@gutech.demo', // CS101, MATH150
  noor: 'noor.saadi@gutech.demo', // CS101, MATH150 - must change password
} as const;

export const COURSES = {
  cs101: '44444444-4444-4444-8444-444444444441',
  cs201: '44444444-4444-4444-8444-444444444442',
  math150: '44444444-4444-4444-8444-444444444443',
};

export const IDS = {
  fatima: '33333333-3333-4333-8333-333333333331',
  yousuf: '33333333-3333-4333-8333-333333333332',
  salim: '33333333-3333-4333-8333-333333333334',
  lab1: '55555555-5555-4555-8555-555555555551',
  lab2: '55555555-5555-4555-8555-555555555552',
  linkedList: '55555555-5555-4555-8555-555555555553',
  quiz1: '66666666-6666-4666-8666-666666666661',
  quiz2: '66666666-6666-4666-8666-666666666662',
  complaintFatima: '88888888-8888-4888-8888-888888888881',
};

const tokens = new Map<string, string>();

export async function login(email: string, password = PASSWORD): Promise<string> {
  const cached = tokens.get(`${email}:${password}`);
  if (cached) return cached;
  const res = await api().post('/api/auth/login').send({ email, password });
  if (res.status !== 200)
    throw new Error(`Login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  tokens.set(`${email}:${password}`, res.body.data.accessToken);
  return res.body.data.accessToken as string;
}

export function forget(email: string) {
  for (const key of tokens.keys()) if (key.startsWith(`${email}:`)) tokens.delete(key);
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Minimal valid PDF bytes (magic number %PDF-). */
export function pdfBuffer(sizeBytes = 2048): Buffer {
  const head = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n');
  return Buffer.concat([head, Buffer.alloc(Math.max(0, sizeBytes - head.length), 0x20)]);
}
