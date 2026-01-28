"use client";
import styles from "./page.module.css";
import Link from "next/link";
import { useState } from "react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: data.message });
        setEmail("");
      } else {
        setMessage({ type: "error", text: data.error || "Error al procesar la solicitud" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "Error al enviar la solicitud" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.forgotPassword}>
      <div className={styles.formContainer}>
        <h1 className={styles.title}>¿Olvidaste tu contraseña?</h1>
        <p className={styles.subtitle}>
          Ingresa tu email y te enviaremos instrucciones para resetear tu contraseña
        </p>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Tu email"
            className={styles.input}
            required
          />
          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? "Enviando..." : "Enviar instrucciones"}
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
