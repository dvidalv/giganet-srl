"use server";
import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { normalizeUsername } from "@/utils/username";

const CREDENTIALS_MSG =
  "Usuario, email o contraseña incorrectos. Verifica tus datos e intenta de nuevo.";

export async function loginUsuario(prevState, formData) {
  const login = String(
    formData.get("login") || formData.get("email") || "",
  ).trim();
  const password = formData.get("password");
  const callbackUrl = formData.get("callbackUrl") || "/dashboard";

  if (!login || !password) {
    return {
      error: CREDENTIALS_MSG,
      success: null,
      redirect: null,
    };
  }

  try {
    const User = (await import("@/app/models/user")).default;
    const looksLikeEmail = login.includes("@");
    const user = looksLikeEmail
      ? await User.findOne({ email: login.toLowerCase() })
      : await User.findOne({ username: normalizeUsername(login) });

    // Usuario no existe → mismo mensaje que contraseña incorrecta (seguridad)
    if (!user) {
      return {
        error: CREDENTIALS_MSG,
        success: null,
        redirect: null,
      };
    }

    // Solo usuarios con email verificado pueden entrar
    if (user.isVerified !== true) {
      return {
        error:
          "Por favor verifica tu email antes de iniciar sesión. Revisa tu bandeja de entrada.",
        success: null,
        redirect: null,
      };
    }

    if (user.isActive === false) {
      return {
        error: "Tu cuenta está desactivada. Contacta al administrador.",
        success: null,
        redirect: null,
      };
    }

    const result = await signIn("credentials", {
      login,
      email: looksLikeEmail ? login.toLowerCase() : user.email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return { error: CREDENTIALS_MSG, success: null, redirect: null };
    }

    redirect(callbackUrl);
  } catch (error) {
    if (error?.message === "NEXT_REDIRECT") {
      throw error;
    }

    const isCredentialsError =
      error?.type === "CredentialsSignin" ||
      error?.code === "credentials" ||
      error?.name === "CredentialsSignin";

    if (isCredentialsError) {
      return { error: CREDENTIALS_MSG, success: null, redirect: null };
    }

    console.error("Error en loginUsuario:", error);
    return {
      error: "Error al iniciar sesión. Intenta de nuevo en unos momentos.",
      success: null,
      redirect: null,
    };
  }
}
