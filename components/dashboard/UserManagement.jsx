"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./UserManagement.module.css";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "active", label: "Activo" },
  { value: "inactive", label: "Inactivo" },
  { value: "pending", label: "Pendiente verificación" },
];

const PAGE_SIZE = 10;

function Tag({ children, variant = "default" }) {
  return (
    <span className={`${styles.tag} ${styles[`tag_${variant}`]}`}>
      {children}
    </span>
  );
}

function UserModal({ user, onClose, onSave, mode = "view" }) {
  const isEdit = mode === "edit";
  const isCreate = mode === "create";
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    password: "",
    role: user?.role ?? "user",
    isActive: user?.isActive ?? true,
    isVerified: user?.isVerified ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? "",
        email: user.email ?? "",
        password: "",
        role: user.role ?? "user",
        isActive: user.isActive ?? true,
        isVerified: user.isVerified ?? false,
      });
    } else if (isCreate) {
      setForm({
        name: "",
        email: "",
        password: "",
        role: "user",
        isActive: true,
        isVerified: false,
      });
    }
  }, [user, isCreate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const url = isCreate ? "/api/users" : `/api/users/${user.id}`;
      const body = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        isActive: form.isActive,
        isVerified: form.isVerified,
      };
      if (isCreate) {
        if (!form.password || form.password.length < 8) {
          setError("La contraseña debe tener al menos 8 caracteres");
          setSaving(false);
          return;
        }
        body.password = form.password;
      } else if (form.password) {
        body.password = form.password;
      }

      const method = isCreate ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al guardar");
        setSaving(false);
        return;
      }
      onSave?.(data.user);
      onClose();
    } catch (err) {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>
            {isCreate
              ? "Agregar usuario"
              : isEdit
                ? "Editar usuario"
                : "Detalles del usuario"}
          </h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Cerrar">
            ×
          </button>
        </div>

        {mode === "view" ? (
          <div className={styles.viewContent}>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Nombre</span>
              <span>{user?.name ?? "—"}</span>
            </div>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Email</span>
              <span>{user?.email ?? "—"}</span>
            </div>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Rol</span>
              <Tag variant={user?.role === "admin" ? "admin" : "user"}>
                {user?.role === "admin" ? "Admin" : "Usuario"}
              </Tag>
            </div>
            <div className={styles.viewRow}>
              <span className={styles.viewLabel}>Estado</span>
              <span>
                {!user?.isVerified && (
                  <Tag variant="pending">Pendiente verificación</Tag>
                )}
                {user?.isVerified && (
                  <Tag variant={user?.isActive ? "active" : "inactive"}>
                    {user?.isActive ? "Activo" : "Inactivo"}
                  </Tag>
                )}
              </span>
            </div>
            {user?.createdAt && (
              <div className={styles.viewRow}>
                <span className={styles.viewLabel}>Fecha de registro</span>
                <span>
                  {new Date(user.createdAt).toLocaleDateString("es-ES")}
                </span>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.formError}>{error}</div>}
            <div className={styles.formGroup}>
              <label htmlFor="um-name">Nombre</label>
              <input
                id="um-name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                minLength={3}
                maxLength={50}
                placeholder="Nombre completo"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="um-email">Email</label>
              <input
                id="um-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                required
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="um-password">
                Contraseña {isEdit && "(dejar en blanco para no cambiar)"}
              </label>
              <input
                id="um-password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((f) => ({ ...f, password: e.target.value }))
                }
                required={isCreate}
                minLength={isCreate ? 8 : 0}
                placeholder={isCreate ? "Mínimo 8 caracteres" : "••••••••"}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="um-role">Rol</label>
              <select
                id="um-role"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value }))
                }>
                <option value="user">Usuario</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className={styles.formRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                Usuario activo
              </label>
            </div>
            {!isCreate && (
              <div className={styles.formRow}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.isVerified}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isVerified: e.target.checked }))
                    }
                  />
                  Email verificado
                </label>
              </div>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={saving}>
                {saving
                  ? "Guardando…"
                  : isCreate
                    ? "Crear usuario"
                    : "Guardar cambios"}
              </button>
            </div>
          </form>
        )}

        {mode === "view" && (
          <div className={styles.modalActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}>
              Cerrar
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => onSave?.("edit", user)}>
              Editar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteConfirmModal({ user, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    setError("");
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Error al eliminar");
        setDeleting(false);
        return;
      }
      onConfirm?.();
      onClose();
    } catch {
      setError("Error de conexión");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Eliminar usuario</h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Cerrar">
            ×
          </button>
        </div>
        <p className={styles.deleteText}>
          ¿Estás seguro de que quieres eliminar a <strong>{user?.name}</strong>{" "}
          ({user?.email})? Esta acción no se puede deshacer.
        </p>
        {error && <div className={styles.formError}>{error}</div>}
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={styles.btnDanger}
            onClick={handleDelete}
            disabled={deleting}>
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [modal, setModal] = useState(null); // { type: 'view'|'edit'|'create'|'delete', user?: {} }

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status !== "all") params.set("status", status);
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/users?${params}`);
      if (!res.ok) throw new Error("Error al cargar usuarios");
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setUsers([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleStatusChange = (e) => {
    setStatus(e.target.value);
    setPage(1);
  };

  const handleModalSave = (payload) => {
    if (payload === "edit" && modal?.user) {
      setModal({ type: "edit", user: modal.user });
      return;
    }
    setModal(null);
    fetchUsers();
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Usuarios</h1>
          <p className={styles.subtitle}>Gestiona los usuarios registrados</p>
        </div>
        <button
          type="button"
          className={styles.addButton}
          onClick={() => setModal({ type: "create", user: null })}>
          <span className={styles.addIcon}>+</span>
          Agregar usuario
        </button>
      </header>

      <div className={styles.toolbar}>
        <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <span className={styles.searchIcon} aria-hidden>
            🔍
          </span>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Buscar usuarios..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </form>
        <select
          className={styles.filterSelect}
          value={status}
          onChange={handleStatusChange}
          aria-label="Filtrar por estado">
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <div className={styles.loading}>Cargando usuarios…</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>USUARIO</th>
                <th>EMAIL</th>
                <th>ROL</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.emptyCell}>
                    No hay usuarios que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id || u._id} className={styles.tableRow}>
                    <td data-label="Usuario">
                      <div className={styles.userCell}>
                        <span className={styles.userIcon}>👤</span>
                        <div>
                          <span className={styles.userName}>{u.name}</span>
                          <span className={styles.userEmailSmall}>
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Email">{u.email}</td>
                    <td data-label="Rol">
                      <Tag variant={u.role === "admin" ? "admin" : "user"}>
                        {u.role === "admin" ? "Admin" : "Usuario"}
                      </Tag>
                    </td>
                    <td data-label="Estado">
                      {!u.isVerified && <Tag variant="pending">Pendiente</Tag>}
                      {u.isVerified && (
                        <Tag variant={u.isActive ? "active" : "inactive"}>
                          {u.isActive ? "Activo" : "Inactivo"}
                        </Tag>
                      )}
                    </td>
                    <td data-label="Acciones">
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          title="Ver detalles"
                          onClick={() => setModal({ type: "view", user: u })}>
                          👁️
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          title="Editar"
                          onClick={() => setModal({ type: "edit", user: u })}>
                          ✏️
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          title="Eliminar"
                          onClick={() => setModal({ type: "delete", user: u })}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && total > 0 && (
        <div className={styles.pagination}>
          <span className={styles.paginationInfo}>
            Mostrando {users.length} de {total} usuarios
          </span>
          <div className={styles.paginationControls}>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Página anterior">
              ←
            </button>
            <span className={styles.pageNum}>
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Página siguiente">
              →
            </button>
          </div>
        </div>
      )}

      {modal?.type === "delete" && modal.user && (
        <DeleteConfirmModal
          user={modal.user}
          onClose={() => setModal(null)}
          onConfirm={fetchUsers}
        />
      )}

      {modal?.type === "view" && modal.user && (
        <UserModal
          user={modal.user}
          mode="view"
          onClose={() => setModal(null)}
          onSave={(action, u) =>
            action === "edit" &&
            setModal({ type: "edit", user: u || modal.user })
          }
        />
      )}

      {modal?.type === "edit" && modal.user && (
        <UserModal
          user={modal.user}
          mode="edit"
          onClose={() => setModal(null)}
          onSave={handleModalSave}
        />
      )}

      {modal?.type === "create" && (
        <UserModal
          user={null}
          mode="create"
          onClose={() => setModal(null)}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
}
