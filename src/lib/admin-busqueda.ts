import { sql, type SQL } from "drizzle-orm";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { db } from "@/lib/db";
import { digitosDeTelefono, normalizarBusqueda } from "@/lib/busqueda-texto";

/**
 * El buscador global del panel, resuelto en el servidor.
 *
 * Busca en tres sitios y devuelve como mucho seis resultados de cada uno:
 * negocios (nombre, ciudad, provincia, barrio, teléfono, dueño), usuarios
 * (nombre, correo, teléfono) y secciones (el título de la sección o el nombre
 * del grupo).
 *
 * La comparación quita tildes y mayúsculas en los dos lados. Los teléfonos se
 * comparan solo por dígitos, así que «+53 555 1234» y «5551234» encuentran la
 * misma ficha; si la persona escribe el país, también se prueba sin él.
 *
 * Nada de esto se hace en el cliente: la tabla de usuarios no viaja al
 * navegador para filtrarla allí. El límite y el recorte son del servidor.
 */

export type TipoResultadoAdmin = "negocio" | "usuario" | "seccion";

export type ResultadoBusquedaAdmin = {
  clave: string;
  tipo: TipoResultadoAdmin;
  titulo: string;
  detalle: string;
  href: string;
};

export type ResultadosBusquedaAdmin = {
  negocios: ResultadoBusquedaAdmin[];
  usuarios: ResultadoBusquedaAdmin[];
  secciones: ResultadoBusquedaAdmin[];
};

const LIMITE_POR_GRUPO = 6;
const LIMITE_SECCIONES = 5;

type FilaNegocio = {
  id: string;
  name: string;
  city: string;
  province: string;
  phone: string | null;
  dueno: string | null;
};

type FilaUsuario = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  negocio_id: string | null;
  negocio_nombre: string | null;
};

const ROL: Record<string, string> = {
  admin: "Administrador",
  owner: "Negocio",
  user: "Usuario",
};

/**
 * `translate` es 1:1, así que las dos cadenas tienen que tener la misma
 * longitud. Se baja a minúsculas antes para no repetir las mayúsculas
 * acentuadas: `lower('Á')` ya devuelve `á`.
 */
function normalizado(columna: string): SQL {
  return sql.raw(
    `translate(lower(coalesce(${columna}, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc')`,
  );
}

function soloDigitos(columna: string): SQL {
  return sql.raw(`regexp_replace(coalesce(${columna}, ''), '\\D', '', 'g')`);
}

function coincide(columna: string, texto: string): SQL {
  if (!texto) return sql`false`;
  return sql`strpos(${normalizado(columna)}, ${texto}) > 0`;
}

function coincideTelefono(columna: string, digitos: string): SQL {
  /* Con uno o dos dígitos todo coincide y el resultado deja de ser una
     búsqueda: se exige un teléfono mínimo para entrar por esta vía. */
  if (digitos.length < 3) return sql`false`;

  const condiciones: SQL[] = [
    sql`strpos(${soloDigitos(columna)}, ${digitos}) > 0`,
  ];

  /* Quien escribe «+53 555 1234» espera encontrar el número guardado como
     «5551234». Se prueba también sin el país, solo cuando lo llevaba. */
  if (digitos.startsWith("53") && digitos.length > 8) {
    condiciones.push(
      sql`strpos(${soloDigitos(columna)}, ${digitos.slice(2)}) > 0`,
    );
  }

  return sql`(${sql.join(condiciones, sql` OR `)})`;
}

function seccionesQueCoinciden(texto: string): ResultadoBusquedaAdmin[] {
  if (!texto) return [];

  const encontradas: ResultadoBusquedaAdmin[] = [];
  for (const grupo of ADMIN_NAV) {
    const grupoCoincide = normalizarBusqueda(grupo.titulo).includes(texto);
    for (const item of grupo.items) {
      if (!grupoCoincide && !normalizarBusqueda(item.label).includes(texto)) {
        continue;
      }
      encontradas.push({
        clave: `seccion:${item.href}`,
        tipo: "seccion",
        titulo: item.label,
        detalle: grupo.titulo,
        href: item.href,
      });
      if (encontradas.length >= LIMITE_SECCIONES) return encontradas;
    }
  }
  return encontradas;
}

/**
 * Busca en negocios y usuarios a la vez y suma las secciones que casan.
 *
 * Los enlaces de negocio usan `?negocio=`, la dirección que la ficha 360
 * abrirá en la fase siguiente. Los de una persona sin negocio llevan a la
 * lista de usuarios ya filtrada por su correo.
 */
export async function buscarAdmin(
  consulta: string,
): Promise<ResultadosBusquedaAdmin> {
  const texto = normalizarBusqueda(consulta);
  const digitos = digitosDeTelefono(consulta);

  if (!texto && !digitos) {
    return { negocios: [], usuarios: [], secciones: [] };
  }

  const condicionesNegocio = [
    coincide("p.name", texto),
    coincide("p.city", texto),
    coincide("p.province", texto),
    coincide("p.neighborhood", texto),
    coincide("p.phone", texto),
    coincide("p.whatsapp", texto),
    coincideTelefono("p.phone", digitos),
    coincideTelefono("p.whatsapp", digitos),
    sql`EXISTS (
      SELECT 1
      FROM business_owners bo
      JOIN users u ON u.id = bo.user_id
      WHERE bo.place_id = p.id
        AND (
          ${coincide("u.name", texto)}
          OR ${coincide("u.email", texto)}
          OR ${coincideTelefono("u.phone", digitos)}
        )
    )`,
  ];

  const condicionesUsuario = [
    coincide("u.name", texto),
    coincide("u.email", texto),
    coincide("u.phone", texto),
    coincideTelefono("u.phone", digitos),
  ];

  const [negociosDb, usuariosDb] = await Promise.all([
    db.execute<FilaNegocio>(sql`
      SELECT
        p.id,
        p.name,
        p.city,
        p.province,
        p.phone,
        (
          SELECT string_agg(
            DISTINCT COALESCE(NULLIF(u.name, ''), u.email),
            ', '
          )
          FROM business_owners bo
          JOIN users u ON u.id = bo.user_id
          WHERE bo.place_id = p.id
        ) AS dueno
      FROM places p
      WHERE ${sql.join(condicionesNegocio, sql` OR `)}
      ORDER BY
        CASE WHEN strpos(${normalizado("p.name")}, ${texto}) = 1 THEN 0 ELSE 1 END,
        p.name
      LIMIT ${LIMITE_POR_GRUPO}
    `),
    db.execute<FilaUsuario>(sql`
      SELECT
        u.id,
        u.name,
        u.email,
        u.phone,
        u.role,
        (
          SELECT p.id
          FROM business_owners bo
          JOIN places p ON p.id = bo.place_id
          WHERE bo.user_id = u.id
          ORDER BY CASE WHEN bo.role = 'owner' THEN 0 ELSE 1 END, p.name
          LIMIT 1
        ) AS negocio_id,
        (
          SELECT p.name
          FROM business_owners bo
          JOIN places p ON p.id = bo.place_id
          WHERE bo.user_id = u.id
          ORDER BY CASE WHEN bo.role = 'owner' THEN 0 ELSE 1 END, p.name
          LIMIT 1
        ) AS negocio_nombre
      FROM users u
      WHERE ${sql.join(condicionesUsuario, sql` OR `)}
      ORDER BY
        CASE WHEN strpos(${normalizado("u.name")}, ${texto}) = 1 THEN 0 ELSE 1 END,
        u.name NULLS LAST,
        u.email
      LIMIT ${LIMITE_POR_GRUPO}
    `),
  ]);

  const negocios: ResultadoBusquedaAdmin[] = (negociosDb.rows ?? []).map(
    (fila) => {
      const partes = [
        [fila.city, fila.province].filter(Boolean).join(", "),
        fila.dueno ? `Dueño: ${fila.dueno}` : "Sin dueño vinculado",
      ];
      if (fila.phone) partes.push(fila.phone);

      return {
        clave: `negocio:${fila.id}`,
        tipo: "negocio",
        titulo: fila.name,
        detalle: partes.filter(Boolean).join(" · "),
        href: `/admin/negocios?negocio=${encodeURIComponent(fila.id)}`,
      };
    },
  );

  const usuarios: ResultadoBusquedaAdmin[] = (usuariosDb.rows ?? []).map(
    (fila) => {
      const detalle = [
        fila.email,
        ROL[fila.role] ?? fila.role,
        fila.negocio_nombre,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        clave: `usuario:${fila.id}`,
        tipo: "usuario",
        titulo: fila.name?.trim() || fila.email,
        detalle,
        href: fila.negocio_id
          ? `/admin/negocios?negocio=${encodeURIComponent(fila.negocio_id)}`
          : `/admin/usuarios?q=${encodeURIComponent(fila.email)}`,
      };
    },
  );

  return {
    negocios,
    usuarios,
    secciones: seccionesQueCoinciden(texto),
  };
}
