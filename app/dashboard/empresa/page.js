"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./page.module.css";
import { formatPhoneNumber, formatPhoneNumberRealtime } from "@/utils/phoneUtils";

const EMPRESA_DEFAULTS = {
  nombre: "",
  logo: "",
  rnc: "",
  razonSocial: "",
  direccion: "",
  ciudad: "",
  telefono: "",
  email: "",
};

const IconBuilding = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2 21V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v14M2 21h20M7 10v11M17 10v11" />
  </svg>
);
const IconDocument = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconBadge = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
  </svg>
);
const IconPhone = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);
const IconMail = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
const IconMapPin = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconLocation = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
const IconLink = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);
const IconCheck = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconBuildingHeader = () => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const ALLOWED_LOGO_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5 MB

export default function MiEmpresa() {
  const [empresa, setEmpresa] = useState(EMPRESA_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [errors, setErrors] = useState({});
  const [telefonoDisplay, setTelefonoDisplay] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchEmpresa();
  }, []);

  useEffect(() => {
    const raw = empresa.telefono || "";
    setTelefonoDisplay(raw ? formatPhoneNumber(raw) : "");
  }, [empresa.telefono]);

  useEffect(() => {
    setLogoPreview(empresa.logo || "");
  }, [empresa.logo]);

  const fetchEmpresa = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users/me/empresa");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error || "Error al cargar datos" });
        return;
      }
      const data = await res.json();
      setEmpresa({ ...EMPRESA_DEFAULTS, ...data.empresa });
    } catch (err) {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setEmpresa((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumberRealtime(e.target.value);
    setTelefonoDisplay(formatted);
    const digits = formatted.replace(/\D/g, "");
    handleChange("telefono", digits.length <= 10 ? formatted : empresa.telefono);
  };

  const handleLogoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setMessage({ type: "error", text: "Formato no permitido. Use JPEG, PNG, GIF o WebP." });
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setMessage({ type: "error", text: "La imagen no puede superar 5 MB." });
      return;
    }
    setMessage(null);
    const objectUrl = URL.createObjectURL(file);
    setLogoPreview(objectUrl);
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      URL.revokeObjectURL(objectUrl);
      if (!res.ok) {
        setLogoPreview(empresa.logo || "");
        setMessage({ type: "error", text: data.error || "Error al subir la imagen" });
        return;
      }
      handleChange("logo", data.url);
      setLogoPreview(data.url);
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      setLogoPreview(empresa.logo || "");
      setMessage({ type: "error", text: "Error de conexión al subir" });
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const handleRemoveLogo = () => {
    handleChange("logo", "");
    setLogoPreview("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setErrors({});

    const newErrors = {};
    if (empresa.email && !/^\S+@\S+\.\S+$/.test(empresa.email)) {
      newErrors.email = "Email inválido";
    }
    if (empresa.rnc && empresa.rnc.length > 10) {
      newErrors.rnc = "El RNC no puede exceder 10 caracteres";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: empresa.nombre || "",
        logo: empresa.logo || "",
        rnc: (empresa.rnc || "").replace(/\D/g, "").slice(0, 10),
        razonSocial: empresa.razonSocial || "",
        direccion: empresa.direccion || "",
        ciudad: empresa.ciudad || "",
        telefono: (empresa.telefono || "").replace(/\D/g, "").slice(0, 10),
        email: empresa.email || "",
      };
      const res = await fetch("/api/users/me/empresa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Error al actualizar" });
        if (data.details) setErrors((prev) => ({ ...prev, _form: data.details }));
        return;
      }
      setEmpresa({ ...EMPRESA_DEFAULTS, ...data.empresa });
      setMessage({ type: "success", text: "Datos actualizados correctamente" });
    } catch (err) {
      setMessage({ type: "error", text: "Error de conexión" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.loading}>Cargando datos de empresa...</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <header className={styles.header}>
          <div className={styles.headerIcon}>
            <IconBuildingHeader />
          </div>
          <div className={styles.headerText}>
            <h1>Mi Empresa</h1>
            <p>Completa o actualiza la información de tu empresa.</p>
          </div>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formBody}>
            <div className={styles.grid}>
              <div className={styles.fieldWrapper}>
                <label className={styles.label}>Nombre de la empresa</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><IconBuilding /></span>
                  <input
                    type="text"
                    value={empresa.nombre}
                    onChange={(e) => handleChange("nombre", e.target.value)}
                    placeholder="Ej: Mi Negocio SRL"
                    className={styles.input}
                    maxLength={100}
                  />
                </div>
              </div>

              <div className={styles.fieldWrapper}>
                <label className={styles.label}>Razón social</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><IconDocument /></span>
                  <input
                    type="text"
                    value={empresa.razonSocial}
                    onChange={(e) => handleChange("razonSocial", e.target.value)}
                    placeholder="Razón social"
                    className={styles.input}
                    maxLength={100}
                  />
                </div>
              </div>
            </div>

            <div className={styles.fieldWrapper}>
              <label className={styles.label}>Dirección</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}><IconMapPin /></span>
                <input
                  type="text"
                  value={empresa.direccion}
                  onChange={(e) => handleChange("direccion", e.target.value)}
                  placeholder="Calle, ciudad, provincia, código postal"
                  className={styles.input}
                />
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.fieldWrapper}>
                <label className={styles.label}>Teléfono</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><IconPhone /></span>
                  <input
                    type="tel"
                    value={telefonoDisplay}
                    onChange={handlePhoneChange}
                    placeholder="(809) 555-1234"
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.fieldWrapper}>
                <label className={styles.label}>Email de la empresa</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><IconMail /></span>
                  <input
                    type="email"
                    value={empresa.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="contacto@empresa.com"
                    className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
                  />
                </div>
                {errors.email && (
                  <p className={styles.fieldError}>{errors.email}</p>
                )}
              </div>
            </div>

            <div className={styles.grid}>
              <div className={styles.fieldWrapper}>
                <label className={styles.label}>Ciudad</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><IconLocation /></span>
                  <input
                    type="text"
                    value={empresa.ciudad}
                    onChange={(e) => handleChange("ciudad", e.target.value)}
                    placeholder="Ciudad"
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.fieldWrapper}>
                <label className={styles.label}>RNC</label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><IconBadge /></span>
                  <input
                    type="text"
                    value={empresa.rnc}
                    onChange={(e) => handleChange("rnc", e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="Ej: 12345678901"
                    className={`${styles.input} ${errors.rnc ? styles.inputError : ""}`}
                    maxLength={10}
                  />
                </div>
                {errors.rnc && (
                  <p className={styles.fieldError}>{errors.rnc}</p>
                )}
              </div>
            </div>

            <div className={styles.fieldWrapper}>
              <label className={styles.label}>Logo de la empresa</label>
              <div className={styles.logoSection}>
                <div className={styles.logoPreviewWrap}>
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- preview con URL dinámica (blob o Cloudinary)
                    <img
                      src={logoPreview}
                      alt="Vista previa del logo"
                      className={styles.logoPreview}
                    />
                  ) : (
                    <div className={styles.logoPlaceholder}>
                      <IconLink />
                      <span>Sin logo</span>
                    </div>
                  )}
                </div>
                <div className={styles.logoActions}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_LOGO_TYPES.join(",")}
                    onChange={handleLogoFileChange}
                    className={styles.logoFileInput}
                    disabled={uploadingLogo}
                  />
                  <button
                    type="button"
                    className={styles.logoButton}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? "Subiendo..." : "Cargar imagen"}
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      className={styles.logoButtonRemove}
                      onClick={handleRemoveLogo}
                      disabled={uploadingLogo}
                    >
                      Quitar logo
                    </button>
                  )}
                </div>
                <p className={styles.logoHint}>
                  JPEG, PNG, GIF o WebP. Máx. 5 MB. Se recortará y optimizará para logo.
                </p>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}><IconLink /></span>
                  <input
                    type="url"
                    value={empresa.logo}
                    onChange={(e) => handleChange("logo", e.target.value)}
                    placeholder="O pega aquí la URL del logo"
                    className={styles.input}
                  />
                </div>
              </div>
            </div>
          </div>

          {message && (
            <div className={styles.messageWrap}>
              <p
                className={
                  message.type === "success" ? styles.messageSuccess : styles.messageError
                }
              >
                {message.text}
              </p>
            </div>
          )}

          <div className={styles.formFooter}>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={saving}
            >
              <IconCheck />
              {saving ? "Guardando..." : "Actualizar datos"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
