"use server";
import { headers } from "next/headers";

export async function crearUsuario(prevState, formData) {
  const fullName = formData.get("fullName");
  const email = formData.get("email");
  const password = formData.get("password");

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  try {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (res.status !== 201) {
      const msg = data?.error || data?.details?.join?.(", ") || "Error al crear el usuario";
      return { error: msg, success: null };
    }

    return {
      success: "¡Cuenta creada! Por favor verifica tu email para activar tu cuenta.",
      error: null,
    };
  } catch (err) {
    return { error: err?.message || "Error al crear el usuario", success: null };
  }
}