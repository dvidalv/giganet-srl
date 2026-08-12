"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

const IconUser = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

const IconMail = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const IconLock = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
    />
  </svg>
);

export default function MiPerfilPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    image: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [original, setOriginal] = useState({ name: "", email: "", image: "" });
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const res = await fetch("/api/users/me");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage({
            type: "error",
            text: data.error || "Error al cargar el perfil",
          });
          return;
        }
        const user = data.user || {};
        const next = {
          name: user.name || "",
          email: user.email || "",
          image: user.image || "",
        };
        setOriginal(next);
        setForm({
          ...next,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setPreview(next.image || "");
      } catch {
        setMessage({ type: "error", text: "Error de conexión" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage({
        type: "error",
        text: "Formato no permitido. Use JPEG, PNG, GIF o WebP.",
      });
      return;
    }
    if (file.size > MAX_SIZE) {
      setMessage({ type: "error", text: "La imagen no puede superar 5 MB." });
      return;
    }

    setMessage(null);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      URL.revokeObjectURL(objectUrl);
      if (!res.ok) {
        setPreview(form.image || "");
        setMessage({
          type: "error",
          text: data.error || "Error al subir la imagen",
        });
        return;
      }
      handleChange("image", data.url);
      setPreview(data.url);
    } catch {
      URL.revokeObjectURL(objectUrl);
      setPreview(form.image || "");
      setMessage({ type: "error", text: "Error de conexión al subir" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleRemoveAvatar = () => {
    handleChange("image", "");
    setPreview("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setErrors({});

    const nextErrors = {};
    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();

    if (name.length < 3 || name.length > 50) {
      nextErrors.name = "El nombre debe tener entre 3 y 50 caracteres";
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      nextErrors.email = "Email inválido";
    }

    const emailChanging = email !== original.email.toLowerCase();
    const wantsPassword = Boolean(form.newPassword);

    if (wantsPassword) {
      if (form.newPassword.length < 8) {
        nextErrors.newPassword = "Mínimo 8 caracteres";
      }
      if (form.newPassword !== form.confirmPassword) {
        nextErrors.confirmPassword = "Las contraseñas no coinciden";
      }
    }

    if ((emailChanging || wantsPassword) && !form.currentPassword) {
      nextErrors.currentPassword =
        "Indica tu contraseña actual para cambiar email o clave";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name,
        email,
        image: form.image || "",
      };
      if (emailChanging || wantsPassword) {
        payload.currentPassword = form.currentPassword;
      }
      if (wantsPassword) {
        payload.newPassword = form.newPassword;
      }

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error || "Error al actualizar el perfil",
        });
        return;
      }

      const user = data.user || {};
      const next = {
        name: user.name || name,
        email: user.email || email,
        image: user.image || "",
      };
      setOriginal(next);
      setForm({
        ...next,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPreview(next.image || "");
      setMessage({ type: "success", text: "Perfil actualizado correctamente" });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}>Cargando perfil...</div>
      </div>
    );
  }

  const initial = form.name?.charAt(0).toUpperCase() || "U";

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.headerIcon}>
            <IconUser />
          </div>
          <div className={styles.headerText}>
            <h1>Mi perfil</h1>
            <p>Actualiza tu nombre, email, contraseña y foto de perfil.</p>
          </div>
        </header>

        <form className={styles.form} onSubmit={handleSubmit} autoComplete="off">
          <div className={styles.formBody}>
            {message ? (
              <div
                className={
                  message.type === "success" ? styles.successMsg : styles.errorMsg
                }
              >
                {message.text}
              </div>
            ) : null}

            <div className={styles.avatarSection}>
              <div className={styles.avatarPreviewWrap}>
                {preview ? (
                  <Image
                    src={preview}
                    alt="Foto de perfil"
                    width={140}
                    height={140}
                    className={styles.avatarPreview}
                    unoptimized={preview.startsWith("blob:")}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>{initial}</div>
                )}
              </div>
              <div className={styles.avatarActions}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className={styles.fileInput}
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  disabled={uploading || saving}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "Subiendo…" : "Cambiar foto"}
                </button>
                {preview ? (
                  <button
                    type="button"
                    className={styles.ghostBtn}
                    disabled={uploading || saving}
                    onClick={handleRemoveAvatar}
                  >
                    Quitar foto
                  </button>
                ) : null}
                <p className={styles.hint}>JPEG, PNG, GIF o WebP. Máx. 5 MB.</p>
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.fieldWrapper}>
                <label className={styles.label} htmlFor="perfil-name">
                  Nombre
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <IconUser />
                  </span>
                  <input
                    id="perfil-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                    required
                    minLength={3}
                    maxLength={50}
                    autoComplete="off"
                  />
                </div>
                {errors.name ? (
                  <p className={styles.fieldError}>{errors.name}</p>
                ) : null}
              </div>

              <div className={styles.fieldWrapper}>
                <label className={styles.label} htmlFor="perfil-email">
                  Email
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <IconMail />
                  </span>
                  <input
                    id="perfil-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
                    required
                    autoComplete="off"
                  />
                </div>
                {errors.email ? (
                  <p className={styles.fieldError}>{errors.email}</p>
                ) : null}
              </div>
            </div>

            <div className={styles.sectionDivider}>
              <h2 className={styles.subsectionTitle}>Cambiar contraseña</h2>
              <p className={styles.subsectionDesc}>
                Deja la nueva contraseña en blanco si no quieres cambiarla. Si
                cambias email o clave, debes indicar tu contraseña actual.
              </p>

              <div className={styles.grid}>
                <div className={styles.fieldWrapper}>
                  <label className={styles.label} htmlFor="perfil-current">
                    Contraseña actual
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>
                      <IconLock />
                    </span>
                    <input
                      id="perfil-current"
                      type="password"
                      value={form.currentPassword}
                      onChange={(e) =>
                        handleChange("currentPassword", e.target.value)
                      }
                      className={`${styles.input} ${
                        errors.currentPassword ? styles.inputError : ""
                      }`}
                      autoComplete="current-password"
                      placeholder="••••••••"
                    />
                  </div>
                  {errors.currentPassword ? (
                    <p className={styles.fieldError}>{errors.currentPassword}</p>
                  ) : null}
                </div>

                <div className={styles.fieldWrapper}>
                  <label className={styles.label} htmlFor="perfil-new">
                    Nueva contraseña
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>
                      <IconLock />
                    </span>
                    <input
                      id="perfil-new"
                      type="password"
                      value={form.newPassword}
                      onChange={(e) => handleChange("newPassword", e.target.value)}
                      className={`${styles.input} ${
                        errors.newPassword ? styles.inputError : ""
                      }`}
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                      minLength={8}
                    />
                  </div>
                  {errors.newPassword ? (
                    <p className={styles.fieldError}>{errors.newPassword}</p>
                  ) : null}
                </div>

                <div className={styles.fieldWrapper}>
                  <label className={styles.label} htmlFor="perfil-confirm">
                    Confirmar nueva contraseña
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>
                      <IconLock />
                    </span>
                    <input
                      id="perfil-confirm"
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) =>
                        handleChange("confirmPassword", e.target.value)
                      }
                      className={`${styles.input} ${
                        errors.confirmPassword ? styles.inputError : ""
                      }`}
                      autoComplete="new-password"
                      placeholder="Repite la nueva contraseña"
                    />
                  </div>
                  {errors.confirmPassword ? (
                    <p className={styles.fieldError}>{errors.confirmPassword}</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.formFooter}>
            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={saving || uploading}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
