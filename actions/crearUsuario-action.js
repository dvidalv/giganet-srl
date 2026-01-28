"use server";
import { headers } from "next/headers";

export async function crearUsuario(prevState, formData) {
  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");

  // Objeto con los valores del formulario
  const formValues = {
    name: name || "",
    email: email || "",
    password: password || "",
  };

  // Objeto para errores por campo
  let fieldErrors = {};

  // Validar cada campo individualmente
  if (!name || name.trim() === "") {
    fieldErrors.name = "El nombre es requerido.";
  }

  if (!email || email.trim() === "") {
    fieldErrors.email = "El email es requerido.";
  } else if (!email.includes("@")) {
    fieldErrors.email = "El email no es válido.";
  }

  if (!password || password.trim() === "") {
    fieldErrors.password = "La contraseña es requerida.";
  } else if (password.length < 8) {
    fieldErrors.password = "La contraseña debe tener al menos 8 caracteres.";
  }

  // Si hay errores, retornarlos con los valores ingresados
  if (Object.keys(fieldErrors).length > 0) {
    return { errors: fieldErrors, success: null, values: formValues };
  }
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  try {
    const res = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({}));

    if (res.status !== 201) {
      const msg = data?.error || data?.details?.join?.(", ") || "Error al crear el usuario";
      return { error: msg, success: null, values: formValues };
    }

    return {
      success: "¡Cuenta creada! Por favor verifica tu email para activar tu cuenta.",
      error: null,
      values: { name: "", email: "", password: "" },
    };
  } catch (err) {
    return { error: err?.message || "Error al crear el usuario", success: null, values: formValues };
  }
}