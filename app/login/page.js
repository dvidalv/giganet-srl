"use client";
import styles from "./page.module.css";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loginUsuario } from "@/actions/loginUsuario-action";

export default function Login() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"; 
  const verified = searchParams.get("verified");
  const errorParam = searchParams.get("error");
  
  const [state, action, isPending] = useActionState(
    loginUsuario,
    {
      error: null,
      success: null,
      redirect: null,
    }
  );

  const [resendEmail, setResendEmail] = useState("");
  const [resendMessage, setResendMessage] = useState(null);
  const [isResending, setIsResending] = useState(false);

  // Mensajes de verificación
  let verificationMessage = null;
  if (verified === "true") {
    verificationMessage = { type: "success", text: "¡Email verificado correctamente! Ya puedes iniciar sesión." };
  } else if (errorParam === "token-missing") {
    verificationMessage = { type: "error", text: "Token de verificación no proporcionado." };
  } else if (errorParam === "token-invalid") {
    verificationMessage = { type: "error", text: "Token de verificación inválido o expirado." };
  } else if (errorParam === "verification-failed") {
    verificationMessage = { type: "error", text: "Error al verificar el email. Por favor intenta de nuevo." };
  }

  // Función para reenviar email de verificación
  const handleResendVerification = async (e) => {
    e.preventDefault();
    if (!resendEmail) return;

    setIsResending(true);
    setResendMessage(null);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: resendEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setResendMessage({ type: "success", text: data.message });
        setResendEmail("");
      } else {
        setResendMessage({ type: "error", text: data.error || "Error al enviar el email" });
      }
    } catch (error) {
      setResendMessage({ type: "error", text: "Error al enviar el email de verificación" });
    } finally {
      setIsResending(false);
    }
  };

  // Detectar si el error es por email no verificado
  const isEmailNotVerified = state.error?.includes("verifica tu email");

  return (
    <div className={styles.login}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>Iniciar Sesión</h1>
        <p className={styles.subtitle}>Ingresa a tu cuenta</p>
        <form className={styles.form} action={action}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <input
            type="email"
            name="email"
            placeholder="Tu email"
            className={styles.input}
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Tu contraseña"
            className={styles.input}
            required
          />
          <div className={styles.forgotPasswordLink}>
            <Link href="/forgot-password">¿Olvidaste tu contraseña?</Link>
          </div>
          <button type="submit" className={styles.submitButton}>
            Iniciar Sesión
          </button>
        </form>
        <div className={styles.messages}>
          {verificationMessage && (
            <p className={verificationMessage.type === "success" ? styles.success : styles.error}>
              {verificationMessage.text}
            </p>
          )}
          {state.error && <p className={styles.error}>{state.error}</p>}
          {state.success && <p className={styles.success}>{state.success}</p>}
          {isPending && <p className={styles.pending}>Iniciando sesión...</p>}
        </div>

        {/* Sección para reenviar email de verificación */}
        {isEmailNotVerified && (
          <div className={styles.resendSection}>
            <p className={styles.resendTitle}>¿No recibiste el email?</p>
            <form onSubmit={handleResendVerification} className={styles.resendForm}>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="Tu email"
                className={styles.input}
                required
              />
              <button 
                type="submit" 
                className={styles.resendButton}
                disabled={isResending}
              >
                {isResending ? "Enviando..." : "Reenviar Email"}
              </button>
            </form>
            {resendMessage && (
              <p className={resendMessage.type === "success" ? styles.success : styles.error}>
                {resendMessage.text}
              </p>
            )}
          </div>
        )}

        <div className={styles.registerLink}>
          ¿No tienes una cuenta? <Link href="/register">Regístrate</Link>
        </div>
      </div>
    </div>
  );
}
