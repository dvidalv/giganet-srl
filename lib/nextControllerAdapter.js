/**
 * Adaptador para ejecutar controladores estilo Express (req, res) desde rutas API de Next.js.
 * Los controladores en app/controllers/comprobantes.js fueron traídos de un proyecto Express;
 * este módulo construye un req/res compatible para poder reutilizarlos en Next.js.
 *
 * Uso en app/api/.../route.js:
 *
 *   import { runWithNext } from '@/lib/nextControllerAdapter';
 *   import { createComprobante } from '@/app/controllers/comprobantes';
 *
 *   export async function POST(request) {
 *     return runWithNext(createComprobante, request, { requireAuth: true });
 *   }
 *
 *   export async function GET(request, { params }) {
 *     const { id } = await params;
 *     return runWithNext(getComprobanteById, request, { params: { id }, requireAuth: true });
 *   }
 *
 * Los controladores deben hacer siempre "return res.status(...).json(...)" para que
 * el adaptador pueda devolver la NextResponse.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Construye un objeto req compatible con Express a partir de un Request de Next.js.
 * @param {Request} request - Request de Next.js (Web API)
 * @param {Object} options - { params: { id, ... }, body?: object }
 * @returns {Promise<{ body, params, query, headers, user }>}
 */
export async function buildReqFromNextRequest(request, options = {}) {
  const { params = {}, body: bodyOverride } = options;

  let body = bodyOverride;
  if (body === undefined) {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  }

  const url = request.url ? new URL(request.url) : null;
  const query = url
    ? Object.fromEntries(url.searchParams)
    : {};

  const headers = {
    get: (name) => request.headers.get(name),
    authorization: request.headers.get("authorization"),
    "x-api-key": request.headers.get("x-api-key"),
  };

  const session = await auth();
  const user = session?.user
    ? {
        _id: session.user.id,
        ...session.user,
        theFactoryAmbiente:
          session.user.theFactoryAmbiente === "demo" ? "demo" : "production",
      }
    : null;

  return {
    body,
    params,
    query,
    headers,
    user,
  };
}

/**
 * Construye un objeto res compatible con Express que, al llamar res.status(code).json(data),
 * devuelve una NextResponse para que el controlador pueda retornarla.
 * @returns {{ status: (code: number) => { json: (data: any) => NextResponse } }}
 */
export function buildResForNext() {
  return {
    status(code) {
      return {
        json(data) {
          return NextResponse.json(data, { status: code });
        },
      };
    },
  };
}

/**
 * Ejecuta un controlador Express (req, res) con el Request de Next.js y devuelve una NextResponse.
 * @param {(req: any, res: any) => Promise<NextResponse | void>} controllerFn - Función del controller (req, res)
 * @param {Request} request - Request de Next.js
 * @param {Object} options - { params?: object, requireAuth?: boolean }
 * @returns {Promise<NextResponse>}
 */
export async function runWithNext(controllerFn, request, options = {}) {
  const { params = {}, requireAuth = false } = options;

  const req = await buildReqFromNextRequest(request, { params });
  const res = buildResForNext();

  if (requireAuth && !req.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await controllerFn(req, res);

  if (result instanceof NextResponse) {
    return result;
  }

  return NextResponse.json(
    { error: "El controlador no devolvió respuesta" },
    { status: 500 }
  );
}
