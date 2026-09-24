"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, Pencil, Search, Shield, Trash2, UserRound } from "lucide-react";
import type { Role } from "@/lib/session";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  locationCity: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  authUserId: string | null;
}

const ROLE_LABELS: Record<Role, string> = {
  user: "Usuario",
  owner: "Negocio",
  admin: "Administrador",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [draftPassword, setDraftPassword] = useState("");
  const [draftPasswordConfirmation, setDraftPasswordConfirmation] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/users");
      const data = (await response.json()) as { users?: AdminUser[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudieron cargar los usuarios.");
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((user) =>
      [user.name, user.email, user.locationCity, ROLE_LABELS[user.role]]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [query, users]);

  async function changeRole(user: AdminUser, role: Role) {
    if (role === user.role) return;
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, role }),
    });
    const data = (await response.json()) as { user?: AdminUser; error?: string };
    if (!response.ok || !data.user) {
      setError(data.error ?? "No se pudo actualizar el rol.");
      return;
    }
    setUsers((current) => current.map((item) => (item.id === user.id ? data.user! : item)));
  }

  function startEditing(user: AdminUser) {
    setEditingId(user.id);
    setDraftName(user.name ?? "");
    setDraftCity(user.locationCity ?? "");
    setError(null);
  }

  async function saveProfile(user: AdminUser) {
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, name: draftName, locationCity: draftCity }),
    });
    const data = (await response.json()) as { user?: AdminUser; error?: string };
    if (!response.ok || !data.user) {
      setError(data.error ?? "No se pudo guardar el perfil.");
      return;
    }
    setUsers((current) => current.map((item) => (item.id === user.id ? data.user! : item)));
    setEditingId(null);
  }

  async function resetPassword(user: AdminUser) {
    if (draftPassword !== draftPasswordConfirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, newPassword: draftPassword }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "No se pudo cambiar la contraseña.");
      return;
    }
    setError(`Contraseña actualizada para ${user.email}.`);
    setDraftPassword("");
    setDraftPasswordConfirmation("");
    setResettingId(null);
  }

  async function removeUser(user: AdminUser) {
    const confirmed = window.confirm(
      `Eliminar el perfil de ${user.email}? Se borraran tambien sus guardados, resenas e historial en La Verde.`,
    );
    if (!confirmed) return;

    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "No se pudo eliminar el perfil.");
      return;
    }
    setUsers((current) => current.filter((item) => item.id !== user.id));
  }

  return (
    <div className="flex flex-col gap-gap-md">
      <header className="flex flex-wrap items-end justify-between gap-gap-sm">
        <div>
          <p className="font-lv-display text-[10px] font-semibold uppercase tracking-[0.22em] text-verde-600">
            Administracion
          </p>
          <h1 className="font-lv-display text-h2 font-bold text-ink">Usuarios</h1>
          <p className="mt-1 text-small text-ink-soft/75">
            Cuentas de Neon y sus perfiles en la aplicacion.
          </p>
        </div>
        <span className="rounded-full border border-verde-200 bg-verde-50 px-3 py-1 font-lv-display text-meta font-semibold text-verde-700">
          {users.length} usuarios
        </span>
      </header>

      <div className="flex items-center gap-gap-sm rounded-2xl border border-ink/10 bg-white px-gap-sm py-2 shadow-soft">
        <Search size={17} className="shrink-0 text-ink-soft/75" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, correo o rol"
          className="min-w-0 flex-1 bg-transparent text-small text-ink outline-none placeholder:text-ink-soft/60"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-gap-sm py-gap-xs text-meta text-destructive">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-soft">
        {loading ? (
          <p className="p-gap-lg text-small text-ink-soft/75">Cargando usuarios...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="p-gap-lg text-small text-ink-soft/75">No hay usuarios que coincidan.</p>
        ) : (
          <div className="divide-y divide-ink/5">
            {filteredUsers.map((user) => (
              <article key={user.id} className="flex flex-wrap items-center gap-gap-sm p-gap-md">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-verde-50 text-verde-700">
                  <UserRound size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-[180px] flex-1">
                  {editingId === user.id ? (
                    <div className="flex flex-wrap gap-2">
                      <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Nombre" className="h-9 rounded-lg border border-ink/10 px-2 text-small" />
                      <input value={draftCity} onChange={(event) => setDraftCity(event.target.value)} placeholder="Ciudad" className="h-9 rounded-lg border border-ink/10 px-2 text-small" />
                      <button type="button" onClick={() => void saveProfile(user)} className="h-9 rounded-lg bg-verde-600 px-3 text-meta font-semibold text-white">Guardar</button>
                      <button type="button" onClick={() => setEditingId(null)} className="h-9 rounded-lg border border-ink/10 px-3 text-meta">Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <div className="font-lv-display text-small font-semibold text-ink">{user.name || "Sin nombre"}</div>
                      <div className="text-meta text-ink-soft/75">{user.email}</div>
                      <div className="mt-1 text-meta text-ink-soft/60">{user.locationCity || "Sin ubicación"} · {user.onboardingCompleted ? "Onboarding completo" : "Onboarding pendiente"}</div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-gap-xs">
                  <Shield size={15} className="text-verde-600" />
                  <select
                    value={user.role}
                    onChange={(event) => void changeRole(user, event.target.value as Role)}
                    className="h-9 rounded-full border border-ink/10 bg-sand px-3 text-meta font-semibold text-ink outline-none"
                    aria-label={`Rol de ${user.email}`}
                  >
                    {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
                      <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => startEditing(user)} className="grid size-9 place-items-center rounded-full border border-ink/10 text-ink-soft transition-colors hover:bg-sand" aria-label={`Editar perfil de ${user.email}`} title="Editar perfil">
                  <Pencil size={16} strokeWidth={1.8} />
                </button>
                <button type="button" onClick={() => { setResettingId(user.id); setDraftPassword(""); setDraftPasswordConfirmation(""); setError(null); }} className="grid size-9 place-items-center rounded-full border border-ink/10 text-ink-soft transition-colors hover:bg-sand" aria-label={`Cambiar contraseña de ${user.email}`} title="Cambiar contraseña">
                  <KeyRound size={16} strokeWidth={1.8} />
                </button>
                <button
                  type="button"
                  onClick={() => void removeUser(user)}
                  className="grid size-9 place-items-center rounded-full border border-destructive/20 text-destructive transition-colors hover:bg-destructive/5"
                  aria-label={`Eliminar perfil de ${user.email}`}
                  title="Eliminar perfil"
                >
                  <Trash2 size={16} strokeWidth={1.8} />
                </button>
                {resettingId === user.id && (
                  <div className="basis-full flex flex-wrap items-end gap-2 border-t border-ink/5 pt-3">
                    <label className="flex flex-col gap-1 text-meta text-ink-soft">
                      Nueva contraseña
                      <input type="password" value={draftPassword} onChange={(event) => setDraftPassword(event.target.value)} minLength={8} autoComplete="new-password" className="h-9 rounded-lg border border-ink/10 px-2 text-small text-ink" />
                    </label>
                    <label className="flex flex-col gap-1 text-meta text-ink-soft">
                      Repetir contraseña
                      <input type="password" value={draftPasswordConfirmation} onChange={(event) => setDraftPasswordConfirmation(event.target.value)} minLength={8} autoComplete="new-password" className="h-9 rounded-lg border border-ink/10 px-2 text-small text-ink" />
                    </label>
                    <button type="button" onClick={() => void resetPassword(user)} className="h-9 rounded-lg bg-verde-600 px-3 text-meta font-semibold text-white">Aplicar</button>
                    <button type="button" onClick={() => setResettingId(null)} className="h-9 rounded-lg border border-ink/10 px-3 text-meta">Cancelar</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="text-meta text-ink-soft/60">
        Eliminar aquí borra el perfil y sus datos de La Verde. Para eliminar también la cuenta de acceso y su contraseña, usa Neon Auth.
      </p>
    </div>
  );
}
