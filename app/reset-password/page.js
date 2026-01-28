"use client";
import styles from "./page.module.css";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetPassword() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  useEffect(() => {
    if (confirmPassword) {
      setPasswordsMatch(password === confirmPassword);
    }
  }, [password, confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!token) {
      setMessage({ type: "error", text: "Token no proporcionado" });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }

    if (password.length < 8) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 8 caracteres" });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: data.message });
        setPassword("");
        setConfirmPassword("");
        
        // Redirigir al login después de 3 segundos
        setTimeout(() => {
          window.location.href = "/login";
        }, 3000);
      } else {
        setMessage({ type: "error", text: data.error || "Error al resetear la contraseña" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error al procesar la solicitud" });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className={styles.resetPassword}>
        <div className={styles.formContainer}>
          <h1 className={styles.title}>Error</h1>
          <p className={styles.subtitle}>Token no proporcionado</p>
          <div className={styles.backLink}>
            <Link href="/login">Volver al inicio de sesión</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.resetPassword}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>Resetear Contraseña</h1>
        <p className={styles.subtitle}>
          Ingresa tu nueva contraseña
        </p>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nueva contraseña"
              className={styles.input}
              required
              minLength={8}
            />
            <p className={styles.hint}>Mínimo 8 caracteres</p>
          </div>
          
          <div>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar contraseña"
              className={`${styles.input} ${confirmPassword && !passwordsMatch ? styles.inputError : ""}`}
              required
            />
            {confirmPassword && !passwordsMatch && (
              <p className={styles.errorHint}>Las contraseñas no coinciden</p>
            )}
          </div>
          
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading || !passwordsMatch}
          >
            {isLoading ? "Reseteando..." : "Resetear contraseña"}
          </button>
        </form>

        {message && (
          <div className={styles.messages}>
            <p className={message.type === "success" ? styles.success : styles.error}>
              {message.text}
            </p>
          </div>
        )}

        <div className={styles.backLink}>
          <Link href="/login">Volver al inicio de sesión</Link>
        </div>
      </div>
    </div>
  );
}
