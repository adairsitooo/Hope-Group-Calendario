/* =========================================================
   HOPE GROUP — script.js
   Calendario, cumpleaños, reuniones, eventos y accesos.
   Requiere:
   - Supabase Auth.
   - leader_profiles
   - estaca_profiles
   - birthdays
   - monthly_plans
   - meetings
   - events
   - access_requests
   La seguridad real debe estar configurada en Supabase RLS.
   ========================================================= */
"use strict";
/* =========================
   1. CONFIGURACIÓN
   ========================= */
const SUPABASE_URL = "https://duakloumuwgjapduolqc.supabase.co";
const SUPABASE_ANON_KEY =
  "sb_publishable_y1iV_TM16wjWbdV5s9mafg_7BymHxru";
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril",
  "Mayo", "Junio", "Julio", "Agosto",
  "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
let db = null;
let sesionActual = null;
let rolActual = null;
let fechaSeleccionada = new Date();
let cargando = false;
let reuniones = [];
let cumpleanos = [];
let eventos = [];
let planesMes = [];
let canalTiempoReal = null;
let ultimaCarga = 0;
/* =========================
   2. INICIO
   ========================= */
document.addEventListener("DOMContentLoaded", iniciarAplicacion);
async function iniciarAplicacion() {
  configurarSelectores();
  configurarEventos();
  if (!window.supabase || !window.supabase.createClient) {
    mostrarAviso(
      "avisoGeneral",
      "No se pudo cargar la biblioteca de Supabase. Comprueba tu conexión.",
      "error"
    );
    return;
  }
  try {
    db = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    sesionActual = data.session;
    await actualizarSesion();
    await cargarDatos(true);
    db.auth.onAuthStateChange((_evento, session) => {
      sesionActual = session;
      // Evita operaciones de Supabase dentro del callback de autenticación.
      setTimeout(async () => {
        await actualizarSesion();
        await cargarDatos(true);
      }, 0);
    });
    configurarTiempoReal();
    cambiarEstadoConexion("Conectado");
  } catch (error) {
    console.error("Error al iniciar:", error);
    cambiarEstadoConexion("Error de conexión");
    mostrarAviso(
      "avisoGeneral",
      "No se pudo iniciar el calendario. Comprueba la configuración de Supabase.",
      "error"
    );
     alert(
  "Error de Supabase:\n" +
  (error?.message || String(error)) +
  "\nCódigo: " + (error?.code || "sin código") +
  "\nDetalle: " + (error?.details || "sin detalle")
);
  }
}
/* =========================
   3. ELEMENTOS Y EVENTOS
   ========================= */
function elemento(id) {
  return document.getElementById(id);
}
function escuchar(id, evento, callback) {
  const nodo = elemento(id);
  if (nodo) nodo.addEventListener(evento, callback);
}
function configurarEventos() {
  escuchar("mesAnterior", "click", () => moverMes(-1));
  escuchar("mesSiguiente", "click", () => moverMes(1));
  escuchar("selectorMes", "change", cambiarPeriodo);
  escuchar("selectorAnio", "change", cambiarPeriodo);
  escuchar("btnImprimir", "click", imprimirCalendario);
  escuchar("formLogin", "submit", iniciarSesionLider);
  escuchar("formLoginEstacas", "submit", iniciarSesionEstacas);
  escuchar("btnLogout", "click", cerrarSesion);
  escuchar("btnLogoutEstacas", "click", cerrarSesion);
  escuchar("btnActualizar", "click", () => cargarDatos(true));
  escuchar("btnActualizarEstacas", "click", () => cargarDatos(true));
  escuchar("btnGestionarCumpleanos", "click", mostrarGestionCumpleanos);
  escuchar("btnRegistrarCumpleEstacas", "click", alternarFormularioCumpleEstacas);
  escuchar("btnGestionarReuniones", "click", mostrarGestionReuniones);
  escuchar("btnGestionarEventos", "click", mostrarGestionEventos);
  escuchar("btnExportar", "click", exportarCumpleanosCSV);
  escuchar("btnGestionarDocumento", "click", mostrarAvisoDocumentos);
  escuchar("formCumpleanosEstacas", "submit", registrarCumpleanos);
  escuchar("formSolicitudEstacas", "submit", enviarSolicitudEstacas);
}
function configurarSelectores() {
  const selectorMes = elemento("selectorMes");
  const selectorAnio = elemento("selectorAnio");
  if (selectorMes) {
    selectorMes.value = String(fechaSeleccionada.getMonth());
  }
  if (selectorAnio) {
    const actual = new Date().getFullYear();
    selectorAnio.replaceChildren();
    for (let anio = actual - 3; anio <= actual + 7; anio++) {
      const opcion = document.createElement("option");
      opcion.value = String(anio);
      opcion.textContent = String(anio);
      selectorAnio.appendChild(opcion);
    }
    selectorAnio.value = String(fechaSeleccionada.getFullYear());
  }
  actualizarTituloMes();
}
function cambiarPeriodo() {
  const mes = Number(elemento("selectorMes")?.value);
  const anio = Number(elemento("selectorAnio")?.value);
  if (
    !Number.isInteger(mes) ||
    mes < 0 ||
    mes > 11 ||
    !Number.isInteger(anio)
  ) {
    return;
  }
  fechaSeleccionada = new Date(anio, mes, 1);
  actualizarTituloMes();
  cargarDatos(true);
}
function moverMes(cantidad) {
  fechaSeleccionada = new Date(
    fechaSeleccionada.getFullYear(),
    fechaSeleccionada.getMonth() + cantidad,
    1
  );
  if (elemento("selectorMes")) {
    elemento("selectorMes").value = String(fechaSeleccionada.getMonth());
  }
  if (elemento("selectorAnio")) {
    const selector = elemento("selectorAnio");
    const anio = fechaSeleccionada.getFullYear();
    if (![...selector.options].some(o => Number(o.value) === anio)) {
      const opcion = document.createElement("option");
      opcion.value = String(anio);
      opcion.textContent = String(anio);
      selector.appendChild(opcion);
    }
    selector.value = String(anio);
  }
  actualizarTituloMes();
  cargarDatos(true);
}
function actualizarTituloMes() {
  const titulo =
    `${MESES[fechaSeleccionada.getMonth()]} ${fechaSeleccionada.getFullYear()}`;
  if (elemento("mesActual")) {
    elemento("mesActual").textContent = titulo;
  }
}
/* =========================
   4. MENSAJES Y UTILIDADES
   ========================= */
function mostrarAviso(id, mensaje, tipo = "info") {
  const nodo = elemento(id);
  if (!nodo) return;
  nodo.textContent = mensaje;
  nodo.className = `aviso aviso-${tipo}`;
  nodo.hidden = false;
}
function ocultarAviso(id) {
  const nodo = elemento(id);
  if (nodo) nodo.hidden = true;
}
function cambiarEstadoConexion(texto) {
  const nodo = elemento("estadoConexion");
  if (nodo) nodo.textContent = texto;
}
function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caracter]);
}
function fechaISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}
function primerDiaMes() {
  return fechaISO(new Date(
    fechaSeleccionada.getFullYear(),
    fechaSeleccionada.getMonth(),
    1
  ));
}
function primerDiaMesSiguiente() {
  return fechaISO(new Date(
    fechaSeleccionada.getFullYear(),
    fechaSeleccionada.getMonth() + 1,
    1
  ));
}
function formatoFecha(fecha) {
  if (!fecha) return "Fecha sin definir";
  const d = new Date(`${fecha}T12:00:00`);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-GT", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}
function obtenerDiaSemana(fecha) {
  // Lunes = 0; domingo = 6.
  return (fecha.getDay() + 6) % 7;
}
function esLider() {
  return rolActual === "lider";
}
function esMiembroAutorizado() {
  return rolActual === "lider" || rolActual === "estacas";
}
function exigirLider() {
  if (!sesionActual || !esLider()) {
    mostrarAviso(
      "avisoGeneral",
      "Esta función está reservada para líderes autorizados.",
      "error"
    );
    return false;
  }
  return true;
}
/* =========================
   5. AUTENTICACIÓN Y ROLES
   ========================= */
async function iniciarSesionLider(evento) {
  evento.preventDefault();
  const email = elemento("correoLider")?.value.trim();
  const password = elemento("claveLider")?.value;
  if (!email || !password) return;
  try {
    const { error } = await db.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    elemento("formLogin")?.reset();
    await actualizarSesion();
    await cargarDatos(true);
  } catch (error) {
    console.error(error);
    mostrarAviso(
      "avisoLogin",
      "No se pudo iniciar sesión. Comprueba tus credenciales y que tu cuenta esté autorizada como líder.",
      "error"
    );
  }
}
async function iniciarSesionEstacas(evento) {
  evento.preventDefault();
  const email = elemento("correoEstacas")?.value.trim();
  const password = elemento("claveEstacas")?.value;
  if (!email || !password) return;
  try {
    const { error } = await db.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    elemento("formLoginEstacas")?.reset();
    await actualizarSesion();
    if (rolActual !== "estacas") {
      await db.auth.signOut();
      sesionActual = null;
      rolActual = null;
      await actualizarSesion();
      mostrarAviso(
        "avisoLoginEstacas",
        "Esta cuenta no tiene autorización activa para el portal de Estacas.",
        "error"
      );
      return;
    }
    await cargarDatos(true);
  } catch (error) {
    console.error(error);
    mostrarAviso(
      "avisoLoginEstacas",
      "No se pudo iniciar sesión. Comprueba tus credenciales y la autorización de tu cuenta.",
      "error"
    );
  }
}
async function actualizarSesion() {
  if (!db) return;
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  sesionActual = data.session;
  rolActual = null;
  if (sesionActual) {
    const userId = sesionActual.user.id;
    // Se comprueba primero si la cuenta pertenece a un líder.
    const { data: lider, error: errorLider } = await db
      .from("leader_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (errorLider) {
      console.error("Error consultando el perfil de líder:", errorLider);
    }
    if (lider) {
      rolActual = "lider";
    } else {
      const { data: estaca, error: errorEstaca } = await db
        .from("estaca_profiles")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (errorEstaca) {
        console.error("Error consultando el perfil de Estacas:", errorEstaca);
      }
      if (estaca) rolActual = "estacas";
    }
  }
  actualizarInterfaz();
}
function actualizarInterfaz() {
  const loginLider = elemento("accesoLideres");
  const loginEstacas = elemento("accesoEstacas");
  const panelLider = elemento("panelLider");
  const panelEstacas = elemento("panelEstacas");
  if (panelLider) panelLider.hidden = rolActual !== "lider";
  if (panelEstacas) panelEstacas.hidden = rolActual !== "estacas";
  if (loginLider && rolActual === "lider") loginLider.hidden = true;
  if (loginEstacas && rolActual === "estacas") loginEstacas.hidden = true;
  if (!sesionActual || !rolActual) {
    if (loginLider) loginLider.hidden = true;
    if (loginEstacas) loginEstacas.hidden = true;
  }
  if (sesionActual && !rolActual) {
    mostrarAviso(
      "avisoGeneral",
      "La cuenta inició sesión, pero todavía no tiene un rol autorizado para este calendario.",
      "error"
    );
  }
  if (elemento("correoActivo")) {
    elemento("correoActivo").textContent =
      sesionActual?.user?.email || "";
  }
  if (elemento("correoActivoEstacas")) {
    elemento("correoActivoEstacas").textContent =
      sesionActual?.user?.email || "";
  }
  const puedeEntrar = esMiembroAutorizado();
  if (elemento("btnExportar")) {
    elemento("btnExportar").hidden = !esLider();
  }
  if (elemento("btnGestionarReuniones")) {
    elemento("btnGestionarReuniones").hidden = !esLider();
  }
  if (elemento("btnGestionarEventos")) {
    elemento("btnGestionarEventos").hidden = !esLider();
  }
  if (elemento("btnGestionarCumpleanos")) {
    elemento("btnGestionarCumpleanos").hidden = !esLider();
  }
  if (elemento("btnGestionarDocumento")) {
    elemento("btnGestionarDocumento").hidden = !esLider();
  }
  if (elemento("btnRegistrarCumpleEstacas")) {
    elemento("btnRegistrarCumpleEstacas").hidden =
      rolActual !== "estacas";
  }
  if (elemento("btnActualizarEstacas")) {
    elemento("btnActualizarEstacas").hidden =
      rolActual !== "estacas";
  }
  if (elemento("btnLogoutEstacas")) {
    elemento("btnLogoutEstacas").hidden =
      rolActual !== "estacas";
  }
  if (elemento("btnLogout")) {
    elemento("btnLogout").hidden = !esLider();
  }
  if (!puedeEntrar) {
    ocultarAviso("avisoLogin");
    ocultarAviso("avisoLoginEstacas");
  }
}
async function cerrarSesion() {
  if (!db) return;
  try {
    const { error } = await db.auth.signOut();
    if (error) throw error;
    sesionActual = null;
    rolActual = null;
    reuniones = [];
    cumpleanos = [];
    eventos = [];
    planesMes = [];
    actualizarInterfaz();
    renderizarCalendario();
    renderizarCumpleanos();
    renderizarDetalleDia(null);
    if (elemento("contenidoAdministracion")) {
      elemento("contenidoAdministracion").replaceChildren();
    }
    mostrarAviso(
      "avisoGeneral",
      "Has cerrado sesión.",
      "info"
    );
  } catch (error) {
    console.error(error);
    mostrarAviso(
      "avisoGeneral",
      "No se pudo cerrar la sesión. Intenta nuevamente.",
      "error"
    );
  }
}
/* =========================
   6. SOLICITUDES DE ESTACAS
   ========================= */
async function enviarSolicitudEstacas(evento) {
  evento.preventDefault();
  const nombre = elemento("nombreSolicitudEstacas")?.value.trim();
  const email = elemento("correoSolicitudEstacas")?.value.trim();
  if (!nombre || !email) return;
  try {
    const { error } = await db
      .from("access_requests")
      .insert({
        full_name: nombre,
        email,
        status: "pending"
      });
    if (error) throw error;
    elemento("formSolicitudEstacas")?.reset();
    mostrarAviso(
      "avisoSolicitudEstacas",
      "Solicitud enviada. Un líder deberá revisarla antes de autorizar el acceso.",
      "exito"
    );
  } catch (error) {
    console.error(error);
    mostrarAviso(
      "avisoSolicitudEstacas",
      "No se pudo enviar la solicitud. Comprueba la configuración de solicitudes en Supabase o contacta a un líder.",
      "error"
    );
  }
}
/* =========================
   7. CARGA DE INFORMACIÓN
   ========================= */
async function cargarDatos(forzar = false) {
  if (!db || cargando) return;
  // Una recarga manual no se pierde por una carga anterior.
  cargando = true;
  cambiarEstadoConexion("Actualizando...");
  const fechaInicio = primerDiaMes();
  const fechaFin = primerDiaMesSiguiente();
  try {
    reuniones = [];
    eventos = [];
    cumpleanos = [];
    planesMes = [];
    if (!esMiembroAutorizado()) {
      renderizarCalendario();
      renderizarCumpleanos();
      renderizarDetalleDia(null);
      return;
    }
    const [
      resultadoPlanes,
      resultadoReuniones,
      resultadoEventos,
      resultadoCumpleanos
    ] = await Promise.all([
      db
        .from("monthly_plans")
        .select("id, year, month, status, theme, bible_verse")
        .eq("year", fechaSeleccionada.getFullYear())
        .eq("month", fechaSeleccionada.getMonth() + 1),
      db
        .from("meetings")
        .select(
          "id, monthly_plan_id, meeting_date, cancelled, preacher, snack_responsible"
        )
        .gte("meeting_date", fechaInicio)
        .lt("meeting_date", fechaFin),
      db
        .from("events")
        .select(
          "id, monthly_plan_id, event_date, title, preacher, snack_responsible"
        )
        .gte("event_date", fechaInicio)
        .lt("event_date", fechaFin),
      db
        .from("birthdays")
        .select("id, full_name, birth_date, phone, created_at")
    ]);
    for (const resultado of [
      resultadoPlanes,
      resultadoReuniones,
      resultadoEventos,
      resultadoCumpleanos
    ]) {
      if (resultado.error) throw resultado.error;
    }
     const resultados = [
  ["monthly_plans", resultadoPlanes],
  ["meetings", resultadoReuniones],
  ["events", resultadoEventos],
  ["birthdays", resultadoCumpleanos]
];

for (const [tabla, resultado] of resultados) {
  if (resultado.error) {
    const error = resultado.error;

    throw new Error(
      `Tabla: ${tabla}\n` +
      `Mensaje: ${error.message}\n` +
      `Código: ${error.code || "sin código"}\n` +
      `Detalle: ${error.details || "sin detalle"}`
    );
  }
}
    planesMes = resultadoPlanes.data || [];
    const idsPlanesPublicados = new Set(
      planesMes
        .filter(plan => plan.status === "published")
        .map(plan => plan.id)
    );
    const todosLosPlanes = new Set(planesMes.map(plan => plan.id));
    // RLS sigue siendo la barrera de seguridad.
    // Este filtro también evita mostrar borradores a Estacas.
    reuniones = (resultadoReuniones.data || []).filter(reunion => {
      if (!todosLosPlanes.has(reunion.monthly_plan_id)) return false;
      return esLider() ||
        idsPlanesPublicados.has(reunion.monthly_plan_id);
    });
    eventos = (resultadoEventos.data || []).filter(evento => {
      if (!todosLosPlanes.has(evento.monthly_plan_id)) return false;
      return esLider() ||
        idsPlanesPublicados.has(evento.monthly_plan_id);
    });
    cumpleanos = (resultadoCumpleanos.data || []).filter(persona => {
      return Boolean(persona.birth_date && persona.full_name);
    });
    renderizarCalendario();
    renderizarCumpleanos();
    const diaSeleccionado = elemento("calendario")
      ?.querySelector(".dia.seleccionado");
    if (diaSeleccionado?.dataset.fecha) {
      renderizarDetalleDia(diaSeleccionado.dataset.fecha);
    } else {
      renderizarDetalleDia(null);
    }
    ultimaCarga = Date.now();
    cambiarEstadoConexion("Información actualizada");
    ocultarAviso("avisoGeneral");
  } catch (error) {
    console.error("Error cargando calendario:", error);
    alert(error.message || String(error)); 
    cambiarEstadoConexion("Error al actualizar");
    mostrarAviso(
      "avisoGeneral",
      "No se pudo actualizar toda la información. Revisa la conexión, las tablas y los permisos de Supabase.",
      "error"
    );
    renderizarCalendario();
    renderizarCumpleanos();
  } finally {
    cargando = false;
  }
}
/* =========================
   8. CALENDARIO MENSUAL
   ========================= */
function renderizarCalendario() {
  const contenedor = elemento("calendario");
  if (!contenedor) return;
  contenedor.replaceChildren();
  const encabezados = document.createElement("div");
  encabezados.className = "dias-semana";
  DIAS.forEach(dia => {
    const celda = document.createElement("div");
    celda.className = "dia-semana";
    celda.textContent = dia;
    encabezados.appendChild(celda);
  });
  contenedor.appendChild(encabezados);
  const cuadrilla = document.createElement("div");
  cuadrilla.className = "dias-mes";
  const anio = fechaSeleccionada.getFullYear();
  const mes = fechaSeleccionada.getMonth();
  const primerDia = obtenerDiaSemana(new Date(anio, mes, 1));
  const cantidadDias = new Date(anio, mes + 1, 0).getDate();
  const seleccionada = fechaISO(fechaSeleccionada);
  for (let i = 0; i < primerDia; i++) {
    const vacio = document.createElement("div");
    vacio.className = "dia dia-vacio";
    vacio.setAttribute("aria-hidden", "true");
    cuadrilla.appendChild(vacio);
  }
  for (let numeroDia = 1; numeroDia <= cantidadDias; numeroDia++) {
    const fecha = fechaISO(new Date(anio, mes, numeroDia));
    const celda = document.createElement("button");
    celda.type = "button";
    celda.className = "dia";
    celda.dataset.fecha = fecha;
    celda.setAttribute("role", "gridcell");
    celda.setAttribute(
      "aria-label",
      `${numeroDia} de ${MESES[mes]} de ${anio}`
    );
    if (fecha === seleccionada) {
      celda.classList.add("seleccionado");
    }
    const numero = document.createElement("span");
    numero.className = "numero-dia";
    numero.textContent = String(numeroDia);
    celda.appendChild(numero);
    const marcas = document.createElement("span");
    marcas.className = "marcas-dia";
    if (reuniones.some(r => r.meeting_date === fecha)) {
      agregarMarca(marcas, "marca-reunion", "Reunión");
    }
    if (cumpleanos.some(p => p.birth_date?.slice(5) === fecha.slice(5))) {
      agregarMarca(marcas, "marca-cumple", "Cumpleaños");
    }
    if (eventos.some(e => e.event_date === fecha)) {
      agregarMarca(marcas, "marca-evento", "Evento");
    }
    celda.appendChild(marcas);
    celda.addEventListener("click", () => {
      contenedor.querySelectorAll(".dia.seleccionado")
        .forEach(nodo => nodo.classList.remove("seleccionado"));
      celda.classList.add("seleccionado");
      renderizarDetalleDia(fecha);
    });
    cuadrilla.appendChild(celda);
  }
  contenedor.appendChild(cuadrilla);
}
function agregarMarca(contenedor, clase, titulo) {
  const marca = document.createElement("span");
  marca.className = clase;
  marca.title = titulo;
  marca.setAttribute("aria-label", titulo);
  contenedor.appendChild(marca);
}
/* =========================
   9. DETALLE DEL DÍA
   ========================= */
function renderizarDetalleDia(fecha) {
  const titulo = elemento("tituloDetalle");
  const detalle = elemento("detalleDia");
  if (!detalle) return;
  detalle.replaceChildren();
  if (!fecha) {
    if (titulo) titulo.textContent = "Selecciona una fecha";
    const mensaje = document.createElement("p");
    mensaje.className = "texto-secundario";
    mensaje.textContent = esMiembroAutorizado()
      ? "Selecciona un día para consultar sus actividades."
      : "Inicia sesión con una cuenta autorizada para consultar el calendario.";
    detalle.appendChild(mensaje);
    return;
  }
  if (titulo) titulo.textContent = formatoFecha(fecha);
  const reunionesDia = reuniones.filter(r => r.meeting_date === fecha);
  const eventosDia = eventos.filter(e => e.event_date === fecha);
  const cumpleanosDia = cumpleanos.filter(
    p => p.birth_date?.slice(5) === fecha.slice(5)
  );
  const secciones = [];
  reunionesDia.forEach(reunion => {
    secciones.push({
      clase: "detalle-reunion",
      titulo: reunion.cancelled ? "No habrá reunión" : "Reunión",
      texto: reunion.cancelled
        ? "La reunión está cancelada."
        : `Predicador: ${reunion.preacher || "Por asignar"} · Refacción: ${reunion.snack_responsible || "Por asignar"}`
    });
  });
  eventosDia.forEach(evento => {
    secciones.push({
      clase: "detalle-evento",
      titulo: evento.title || "Evento",
      texto: [
        evento.preacher ? `Responsable: ${evento.preacher}` : "",
        evento.snack_responsible
          ? `Refacción: ${evento.snack_responsible}`
          : ""
      ].filter(Boolean).join(" · ") || "Actividad programada."
    });
  });
  cumpleanosDia.forEach(persona => {
    secciones.push({
      clase: "detalle-cumple",
      titulo: persona.full_name,
      texto: "Cumpleaños"
    });
  });
  if (secciones.length === 0) {
    const mensaje = document.createElement("p");
    mensaje.className = "texto-secundario";
    mensaje.textContent = "No hay actividades registradas para este día.";
    detalle.appendChild(mensaje);
    return;
  }
  secciones.forEach(seccion => {
    const tarjeta = document.createElement("article");
    tarjeta.className = `detalle-actividad ${seccion.clase}`;
    const h = document.createElement("h4");
    h.textContent = seccion.titulo;
    const p = document.createElement("p");
    p.textContent = seccion.texto;
    tarjeta.append(h, p);
    detalle.appendChild(tarjeta);
  });
}
/* =========================
   10. CUMPLEAÑOS DEL MES
   ========================= */
function renderizarCumpleanos() {
  const contenedor = elemento("cumpleanosMes");
  if (!contenedor) return;
  contenedor.replaceChildren();
  if (!esMiembroAutorizado()) {
    const mensaje = document.createElement("p");
    mensaje.className = "texto-secundario";
    mensaje.textContent = "Inicia sesión para consultar los cumpleaños.";
    contenedor.appendChild(mensaje);
    return;
  }
  const mes = fechaSeleccionada.getMonth();
  const delMes = cumpleanos
    .filter(persona => {
      if (!persona.birth_date) return false;
      const fecha = new Date(`${persona.birth_date}T12:00:00`);
      return fecha.getMonth() === mes;
    })
    .sort((a, b) => {
      const diaA = Number(a.birth_date.slice(8, 10));
      const diaB = Number(b.birth_date.slice(8, 10));
      return diaA - diaB;
    });
  if (delMes.length === 0) {
    const mensaje = document.createElement("p");
    mensaje.className = "texto-secundario";
    mensaje.textContent = "No hay cumpleaños registrados este mes.";
    contenedor.appendChild(mensaje);
    return;
  }
  delMes.forEach(persona => {
    const fila = document.createElement("article");
    fila.className = "cumple";
    const fecha = document.createElement("span");
    fecha.className = "cumple-fecha";
    fecha.textContent = persona.birth_date.slice(8, 10);
    const nombre = document.createElement("span");
    nombre.className = "cumple-nombre";
    nombre.textContent = persona.full_name;
    fila.append(fecha, nombre);
    contenedor.appendChild(fila);
  });
}
/* =========================
   11. REGISTRAR CUMPLEAÑOS
   ========================= */
function alternarFormularioCumpleEstacas() {
  if (rolActual !== "estacas") return;
  const formulario = elemento("formularioCumpleEstacas");
  if (formulario) formulario.hidden = !formulario.hidden;
}
async function registrarCumpleanos(evento) {
  evento.preventDefault();
  if (!sesionActual || !["lider", "estacas"].includes(rolActual)) {
    mostrarAviso(
      "avisoCumpleEstacas",
      "Necesitas iniciar sesión con una cuenta autorizada.",
      "error"
    );
    return;
  }
  const nombre = elemento("nombreCumpleEstacas")?.value.trim();
  const fecha = elemento("fechaCumpleEstacas")?.value;
  const telefono = elemento("telefonoCumpleEstacas")?.value.trim() || null;
  if (!nombre || !fecha) return;
  try {
    const { error } = await db.from("birthdays").insert({
      full_name: nombre,
      birth_date: fecha,
      phone: telefono,
      created_by: sesionActual.user.id
    });
    if (error) throw error;
    elemento("formCumpleanosEstacas")?.reset();
    mostrarAviso(
      "avisoCumpleEstacas",
      "Cumpleaños registrado correctamente.",
      "exito"
    );
    await cargarDatos(true);
  
} catch (error) {
  console.error("Error al registrar cumpleaños:", error);

  const detalle = [
    error?.message || String(error),
    error?.code ? `Código: ${error.code}` : "",
    error?.details ? `Detalle: ${error.details}` : "",
    error?.hint ? `Sugerencia: ${error.hint}` : ""
  ].filter(Boolean).join(" | ");

  mostrarAviso(
    "avisoCumpleEstacas",
    `No se pudo registrar: ${detalle}`,
    "error"
  );
}

}
/* =========================
   12. ADMINISTRAR CUMPLEAÑOS
   ========================= */
async function mostrarGestionCumpleanos() {
  if (!exigirLider()) return;
  const contenedor = elemento("contenidoAdministracion");
  if (!contenedor) return;
  contenedor.replaceChildren();
  const titulo = document.createElement("h3");
  titulo.textContent = "Administrar cumpleaños";
  contenedor.appendChild(titulo);
  const form = document.createElement("form");
  form.className = "formulario";
  form.innerHTML = `
    <div class="campo">
      <label for="nuevoCumpleNombre">Nombre completo</label>
      <input id="nuevoCumpleNombre" maxlength="120" required>
    </div>
    <div class="campo">
      <label for="nuevoCumpleFecha">Fecha de nacimiento</label>
      <input id="nuevoCumpleFecha" type="date" required>
    </div>
    <div class="campo">
      <label for="nuevoCumpleTelefono">Teléfono (opcional)</label>
      <input id="nuevoCumpleTelefono" type="tel" maxlength="25">
    </div>
    <button class="boton boton-principal" type="submit">
      Agregar cumpleaños
    </button>
  `;
  form.addEventListener("submit", async evento => {
    evento.preventDefault();
    try {
      const { error } = await db.from("birthdays").insert({
        full_name: elemento("nuevoCumpleNombre").value.trim(),
        birth_date: elemento("nuevoCumpleFecha").value,
        phone: elemento("nuevoCumpleTelefono").value.trim() || null,
        created_by: sesionActual.user.id
      });
      if (error) throw error;
      await cargarDatos(true);
      await mostrarGestionCumpleanos();
      mostrarAviso(
        "avisoGeneral",
        "Cumpleaños agregado correctamente.",
        "exito"
      );
    
} catch (error) {
  console.error("Error al agregar cumpleaños:", error);

  const detalle = [
    error?.message || String(error),
    error?.code ? `Código: ${error.code}` : "",
    error?.details ? `Detalle: ${error.details}` : "",
    error?.hint ? `Sugerencia: ${error.hint}` : ""
  ].filter(Boolean).join(" | ");

  mostrarAviso(
    "avisoGeneral",
    `No se pudo agregar el cumpleaños: ${detalle}`,
    "error"
  );
}

  });
  contenedor.appendChild(form);
  cumpleanos.forEach(persona => {
    const fila = document.createElement("div");
    fila.className = "fila-administracion";
    const info = document.createElement("div");
    info.innerHTML = `
      <strong>${escaparHTML(persona.full_name)}</strong>
      <p>${escaparHTML(formatoFecha(persona.birth_date))}</p>
    `;
    const acciones = document.createElement("div");
    acciones.className = "acciones-lider";
    const editar = document.createElement("button");
    editar.type = "button";
    editar.className = "boton boton-secundario";
    editar.textContent = "Editar";
    editar.addEventListener("click", () => editarCumpleanos(persona));
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.className = "boton boton-borde";
    borrar.textContent = "Eliminar";
    borrar.addEventListener("click", () => eliminarCumpleanos(persona));
    acciones.append(editar, borrar);
    fila.append(info, acciones);
    contenedor.appendChild(fila);
  });
}
async function editarCumpleanos(persona) {
  if (!exigirLider()) return;
  const nombre = prompt("Nombre completo:", persona.full_name);
  if (nombre === null) return;
  const fecha = prompt(
    "Fecha de nacimiento (AAAA-MM-DD):",
    persona.birth_date
  );
  if (fecha === null) return;
  const telefono = prompt("Teléfono (opcional):", persona.phone || "");
  if (telefono === null) return;
  if (!nombre.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    mostrarAviso("avisoGeneral", "Revisa el nombre y la fecha.", "error");
    return;
  }
  try {
    const { error } = await db
      .from("birthdays")
      .update({
        full_name: nombre.trim(),
        birth_date: fecha,
        phone: telefono.trim() || null,
        updated_by: sesionActual.user.id
      })
      .eq("id", persona.id);
    if (error) throw error;
    await cargarDatos(true);
    await mostrarGestionCumpleanos();
    mostrarAviso("avisoGeneral", "Cumpleaños actualizado.", "exito");
  } catch (error) {
    console.error(error);
    mostrarAviso("avisoGeneral", "No se pudo editar el cumpleaños.", "error");
  }
}
async function eliminarCumpleanos(persona) {
  if (!exigirLider()) return;
  if (!confirm(`¿Eliminar el cumpleaños de ${persona.full_name}?`)) return;
  try {
    const { error } = await db
      .from("birthdays")
      .delete()
      .eq("id", persona.id);
    if (error) throw error;
    await cargarDatos(true);
    await mostrarGestionCumpleanos();
    mostrarAviso("avisoGeneral", "Cumpleaños eliminado.", "exito");
  } catch (error) {
    console.error(error);
    mostrarAviso("avisoGeneral", "No se pudo eliminar el cumpleaños.", "error");
  }
}
/* =========================
   13. PLAN MENSUAL
   ========================= */
async function obtenerPlanMes(crearSiNoExiste = false) {
  if (!exigirLider()) return null;
  const anio = fechaSeleccionada.getFullYear();
  const mes = fechaSeleccionada.getMonth() + 1;
  const { data, error } = await db
    .from("monthly_plans")
    .select("*")
    .eq("year", anio)
    .eq("month", mes)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;
  if (!crearSiNoExiste) return null;
  const { data: nuevo, error: errorNuevo } = await db
    .from("monthly_plans")
    .insert({
      year: anio,
      month: mes,
      status: "draft",
      created_by: sesionActual.user.id
    })
    .select()
    .single();
  if (errorNuevo) throw errorNuevo;
  return nuevo;
}
async function publicarPlanMes() {
  if (!exigirLider()) return;
  try {
    const plan = await obtenerPlanMes(true);
    if (!plan) return;
    const { error } = await db
      .from("monthly_plans")
      .update({
        status: "published",
        updated_at: new Date().toISOString()
      })
      .eq("id", plan.id);
    if (error) throw error;
    await cargarDatos(true);
    mostrarAviso(
      "avisoGeneral",
      "El calendario del mes quedó publicado.",
      "exito"
    );
    await mostrarGestionReuniones();
  } catch (error) {
    console.error(error);
    mostrarAviso(
      "avisoGeneral",
      "No se pudo publicar el calendario. Comprueba los permisos.",
      "error"
    );
  }
}
/* =========================
   14. ADMINISTRAR REUNIONES
   ========================= */
async function mostrarGestionReuniones() {
  if (!exigirLider()) return;
  const contenedor = elemento("contenidoAdministracion");
  if (!contenedor) return;
  contenedor.replaceChildren();
  const titulo = document.createElement("h3");
  titulo.textContent = "Administrar reuniones";
  contenedor.appendChild(titulo);
  const form = document.createElement("form");
  form.className = "formulario";
  form.innerHTML = `
    <div class="campo">
      <label for="nuevaReunionFecha">Fecha de reunión</label>
      <input
        id="nuevaReunionFecha"
        type="date"
        min="${primerDiaMes()}"
        max="${fechaISO(new Date(
          fechaSeleccionada.getFullYear(),
          fechaSeleccionada.getMonth() + 1,
          0
        ))}"
        required
      >
    </div>
    <div class="campo">
      <label for="nuevoPredicador">Predicador (opcional)</label>
      <input id="nuevoPredicador" maxlength="120">
    </div>
    <div class="campo">
      <label for="nuevaRefaccion">Responsable de refacción (opcional)</label>
      <input id="nuevaRefaccion" maxlength="120">
    </div>
    <div class="campo campo-checkbox">
      <label>
        <input id="nuevaReunionCancelada" type="checkbox">
        No habrá reunión
      </label>
    </div>
    <button class="boton boton-principal" type="submit">
      Agregar reunión
    </button>
  `;
  form.addEventListener("submit", guardarNuevaReunion);
  contenedor.appendChild(form);
  const botonPublicar = document.createElement("button");
  botonPublicar.type = "button";
  botonPublicar.className = "boton boton-principal ancho-completo";
  botonPublicar.textContent = "Publicar calendario del mes";
  botonPublicar.addEventListener("click", publicarPlanMes);
  contenedor.appendChild(botonPublicar);
  const lista = document.createElement("div");
  lista.className = "lista-administracion";
  reuniones
    .slice()
    .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
    .forEach(reunion => {
      const fila = document.createElement("div");
      fila.className = "fila-administracion";
      const info = document.createElement("div");
      info.innerHTML = `
        <strong>${escaparHTML(formatoFecha(reunion.meeting_date))}</strong>
        <p>${reunion.cancelled
          ? "No habrá reunión"
          : `Predicador: ${escaparHTML(reunion.preacher || "Por asignar")}`}</p>
        <p>Refacción: ${escaparHTML(reunion.snack_responsible || "Por asignar")}</p>
      `;
      const acciones = document.createElement("div");
      acciones.className = "acciones-lider";
      const editar = document.createElement("button");
      editar.type = "button";
      editar.className = "boton boton-secundario";
      editar.textContent = "Editar";
      editar.addEventListener("click", () => editarReunion(reunion));
      const borrar = document.createElement("button");
      borrar.type = "button";
      borrar.className = "boton boton-borde";
      borrar.textContent = "Eliminar";
      borrar.addEventListener("click", () => eliminarReunion(reunion));
      acciones.append(editar, borrar);
      fila.append(info, acciones);
      lista.appendChild(fila);
    });
  contenedor.appendChild(lista);
}
async function guardarNuevaReunion(evento) {
  evento.preventDefault();
  if (!exigirLider()) return;
  try {
    const plan = await obtenerPlanMes(true);
    if (!plan) return;
    const fecha = elemento("nuevaReunionFecha").value;
    if (!fecha.startsWith(
      `${fechaSeleccionada.getFullYear()}-${String(
        fechaSeleccionada.getMonth() + 1
      ).padStart(2, "0")}`
    )) {
      mostrarAviso(
        "avisoGeneral",
        "La reunión debe pertenecer al mes seleccionado.",
        "error"
      );
      return;
    }
    const { error } = await db.from("meetings").insert({
      monthly_plan_id: plan.id,
      meeting_date: fecha,
      cancelled: elemento("nuevaReunionCancelada").checked,
      preacher: elemento("nuevoPredicador").value.trim() || null,
      snack_responsible: elemento("nuevaRefaccion").value.trim() || null
    });
    if (error) throw error;
    await cargarDatos(true);
    await mostrarGestionReuniones();
    mostrarAviso("avisoGeneral", "Reunión guardada.", "exito");
  } catch (error) {
    console.error(error);
    mostrarAviso(
      "avisoGeneral",
      "No se pudo guardar la reunión. Comprueba que no exista otra reunión en esa fecha.",
      "error"
    );
  }
}
async function editarReunion(reunion) {
  if (!exigirLider()) return;
  const fecha = prompt(
    "Fecha (AAAA-MM-DD):",
    reunion.meeting_date
  );
  if (fecha === null) return;
  const predicador = prompt(
    "Predicador (vacío = Por asignar):",
    reunion.preacher || ""
  );
  if (predicador === null) return;
  const refaccion = prompt(
    "Responsable de refacción (vacío = Por asignar):",
    reunion.snack_responsible || ""
  );
  if (refaccion === null) return;
  const cancelada = confirm(
    "¿Marcar esta reunión como cancelada?\n\nAceptar = No habrá reunión.\nCancelar = Mantener reunión activa."
  );
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    mostrarAviso("avisoGeneral", "La fecha no es válida.", "error");
    return;
  }
  try {
    const { error } = await db
      .from("meetings")
      .update({
        meeting_date: fecha,
        preacher: predicador.trim() || null,
        snack_responsible: refaccion.trim() || null,
        cancelled: cancelada,
        updated_at: new Date().toISOString()
      })
      .eq("id", reunion.id);
    if (error) throw error;
    await cargarDatos(true);
    await mostrarGestionReuniones();
    mostrarAviso("avisoGeneral", "Reunión actualizada.", "exito");
  } catch (error) {
    console.error(error);
    mostrarAviso("avisoGeneral", "No se pudo editar la reunión.", "error");
  }
}
async function eliminarReunion(reunion) {
  if (!exigirLider()) return;
  if (!confirm(`¿Eliminar la reunión del ${formatoFecha(reunion.meeting_date)}?`)) {
    return;
  }
  try {
    const { error } = await db
      .from("meetings")
      .delete()
      .eq("id", reunion.id);
    if (error) throw error;
    await cargarDatos(true);
    await mostrarGestionReuniones();
    mostrarAviso("avisoGeneral", "Reunión eliminada.", "exito");
  } catch (error) {
    console.error(error);
    mostrarAviso("avisoGeneral", "No se pudo eliminar la reunión.", "error");
  }
}
/* =========================
   15. ADMINISTRAR EVENTOS
   ========================= */
async function mostrarGestionEventos() {
  if (!exigirLider()) return;
  const contenedor = elemento("contenidoAdministracion");
  if (!contenedor) return;
  contenedor.replaceChildren();
  const titulo = document.createElement("h3");
  titulo.textContent = "Administrar eventos";
  contenedor.appendChild(titulo);
  const form = document.createElement("form");
  form.className = "formulario";
  form.innerHTML = `
    <div class="campo">
      <label for="nuevoEventoTitulo">Nombre del evento</label>
      <input id="nuevoEventoTitulo" maxlength="160" required>
    </div>
    <div class="campo">
      <label for="nuevoEventoFecha">Fecha</label>
      <input
        id="nuevoEventoFecha"
        type="date"
        min="${primerDiaMes()}"
        max="${fechaISO(new Date(
          fechaSeleccionada.getFullYear(),
          fechaSeleccionada.getMonth() + 1,
          0
        ))}"
        required
      >
    </div>
    <div class="campo">
      <label for="nuevoEventoResponsable">Responsable (opcional)</label>
      <input id="nuevoEventoResponsable" maxlength="120">
    </div>
    <div class="campo">
      <label for="nuevoEventoRefaccion">Responsable de refacción (opcional)</label>
      <input id="nuevoEventoRefaccion" maxlength="120">
    </div>
    <button class="boton boton-principal" type="submit">
      Agregar evento
    </button>
  `;
  form.addEventListener("submit", guardarNuevoEvento);
  contenedor.appendChild(form);
  const lista = document.createElement("div");
  lista.className = "lista-administracion";
  eventos
    .slice()
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .forEach(evento => {
      const fila = document.createElement("div");
      fila.className = "fila-administracion";
      const info = document.createElement("div");
      info.innerHTML = `
        <strong>${escaparHTML(evento.title)}</strong>
        <p>${escaparHTML(formatoFecha(evento.event_date))}</p>
        <p>Responsable: ${escaparHTML(evento.preacher || "Por asignar")}</p>
      `;
      const acciones = document.createElement("div");
      acciones.className = "acciones-lider";
      const editar = document.createElement("button");
      editar.type = "button";
      editar.className = "boton boton-secundario";
      editar.textContent = "Editar";
      editar.addEventListener("click", () => editarEvento(evento));
      const borrar = document.createElement("button");
      borrar.type = "button";
      borrar.className = "boton boton-borde";
      borrar.textContent = "Eliminar";
      borrar.addEventListener("click", () => eliminarEvento(evento));
      acciones.append(editar, borrar);
      fila.append(info, acciones);
      lista.appendChild(fila);
    });
  contenedor.appendChild(lista);
}
async function guardarNuevoEvento(evento) {
  evento.preventDefault();
  if (!exigirLider()) return;
  try {
    const plan = await obtenerPlanMes(true);
    if (!plan) return;
    const fecha = elemento("nuevoEventoFecha").value;
    if (!fecha.startsWith(
      `${fechaSeleccionada.getFullYear()}-${String(
        fechaSeleccionada.getMonth() + 1
      ).padStart(2, "0")}`
    )) {
      mostrarAviso(
        "avisoGeneral",
        "El evento debe pertenecer al mes seleccionado.",
        "error"
      );
      return;
    }
    const { error } = await db.from("events").insert({
      monthly_plan_id: plan.id,
      event_date: fecha,
      title: elemento("nuevoEventoTitulo").value.trim(),
      preacher: elemento("nuevoEventoResponsable").value.trim() || null,
      snack_responsible: elemento("nuevoEventoRefaccion").value.trim() || null,
      created_by: sesionActual.user.id
    });
    if (error) throw error;
    await cargarDatos(true);
    await mostrarGestionEventos();
    mostrarAviso("avisoGeneral", "Evento guardado.", "exito");
  } catch (error) {
    console.error(error);
    mostrarAviso(
      "avisoGeneral",
      "No se pudo guardar el evento. Comprueba la tabla events y sus permisos.",
      "error"
    );
  }
}
async function editarEvento(evento) {
  if (!exigirLider()) return;
  const titulo = prompt("Nombre del evento:", evento.title);
  if (titulo === null) return;
  const fecha = prompt("Fecha (AAAA-MM-DD):", evento.event_date);
  if (fecha === null) return;
  const responsable = prompt(
    "Responsable (opcional):",
    evento.preacher || ""
  );
  if (responsable === null) return;
  const refaccion = prompt(
    "Responsable de refacción (opcional):",
    evento.snack_responsible || ""
  );
  if (refaccion === null) return;
  if (!titulo.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    mostrarAviso(
      "avisoGeneral",
      "El nombre y la fecha del evento son obligatorios.",
      "error"
    );
    return;
  }
  try {
    const { error } = await db
      .from("events")
      .update({
        title: titulo.trim(),
        event_date: fecha,
        preacher: responsable.trim() || null,
        snack_responsible: refaccion.trim() || null,
        updated_by: sesionActual.user.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", evento.id);
    if (error) throw error;
    await cargarDatos(true);
    await mostrarGestionEventos();
    mostrarAviso("avisoGeneral", "Evento actualizado.", "exito");
  } catch (error) {
    console.error(error);
    mostrarAviso("avisoGeneral", "No se pudo editar el evento.", "error");
  }
}
async function eliminarEvento(evento) {
  if (!exigirLider()) return;
  if (!confirm(`¿Eliminar el evento "${evento.title}"?`)) return;
  try {
    const { error } = await db
      .from("events")
      .delete()
      .eq("id", evento.id);
    if (error) throw error;
    await cargarDatos(true);
    await mostrarGestionEventos();
    mostrarAviso("avisoGeneral", "Evento eliminado.", "exito");
  } catch (error) {
    console.error(error);
    mostrarAviso("avisoGeneral", "No se pudo eliminar el evento.", "error");
  }
}
/* =========================
   16. EXPORTAR CUMPLEAÑOS CSV
   ========================= */
function exportarCumpleanosCSV() {
  if (!exigirLider()) return;
  const filas = [
    ["Nombre", "Fecha de nacimiento", "Teléfono"],
    ...cumpleanos.map(persona => [
      persona.full_name,
      persona.birth_date,
      persona.phone || ""
    ])
  ];
  const csv = filas
    .map(fila => fila.map(valor => {
      const texto = String(valor ?? "");
      return `"${texto.replace(/"/g, '""')}"`;
    }).join(","))
    .join("\r\n");
  const archivo = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8;" }
  );
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download =
    `cumpleanos_${fechaSeleccionada.getFullYear()}_${String(
      fechaSeleccionada.getMonth() + 1
    ).padStart(2, "0")}.csv`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
/* =========================
   17. DOCUMENTOS OFICIALES
   ========================= */
function mostrarAvisoDocumentos() {
  if (!exigirLider()) return;
  const contenedor = elemento("contenidoAdministracion");
  if (!contenedor) return;
  contenedor.replaceChildren();
  const titulo = document.createElement("h3");
  titulo.textContent = "Documentos oficiales";
  const aviso = document.createElement("p");
  aviso.className = "texto-secundario";
  aviso.textContent =
    "El control de versiones, las copias de respaldo y el historial de documentos requieren una implementación adicional. Esta sección todavía no guarda versiones oficiales.";
  contenedor.append(titulo, aviso);
}

/* =========================================================
   18. IMPRESIÓN DEL MES / GENERAR PDF
   ========================================================= */

function imprimirCalendario() {
  if (!esMiembroAutorizado()) {
    mostrarAviso(
      "avisoGeneral",
      "Inicia sesión para imprimir el calendario autorizado.",
      "error"
    );
    return;
  }

  const zona = elemento("zonaImpresion");

  if (!zona) {
    console.error("No se encontró #zonaImpresion.");
    return;
  }

  const anio = fechaSeleccionada.getFullYear();
  const mes = fechaSeleccionada.getMonth();
  const nombreMes = `${MESES[mes]} ${anio}`;

  const prefijoMes =
    `${anio}-${String(mes + 1).padStart(2, "0")}`;

  const reunionesMes = reuniones
    .filter(r => r.meeting_date?.startsWith(prefijoMes))
    .slice()
    .sort((a, b) =>
      a.meeting_date.localeCompare(b.meeting_date)
    );

  const eventosMes = eventos
    .filter(e => e.event_date?.startsWith(prefijoMes))
    .slice()
    .sort((a, b) =>
      a.event_date.localeCompare(b.event_date)
    );

  const cumpleanosMes = cumpleanos
    .filter(p =>
      p.birth_date &&
      p.birth_date.slice(5, 7) ===
        String(mes + 1).padStart(2, "0")
    )
    .slice()
    .sort((a, b) =>
      a.birth_date.slice(5, 10)
        .localeCompare(b.birth_date.slice(5, 10)) ||
      (pNombre(a)).localeCompare(pNombre(b), "es")
    );

  const plan = planesMes.find(p =>
    Number(p.year) === anio &&
    Number(p.month) === mes + 1
  );

  const escapar = valor =>
    escaparHTML(String(valor ?? ""));

  const primerDia = obtenerDiaSemana(
    new Date(anio, mes, 1)
  );

  const cantidadDias =
    new Date(anio, mes + 1, 0).getDate();

  /* Construir la cuadrícula mensual completa */
  const celdas = [];

  for (let i = 0; i < primerDia; i++) {
    celdas.push(`
      <div
        class="reporte-celda reporte-celda-vacia"
        aria-hidden="true"
      ></div>
    `);
  }

  for (let dia = 1; dia <= cantidadDias; dia++) {
    const fecha = fechaISO(new Date(anio, mes, dia));

    const reunionesDia = reunionesMes.filter(
      r => r.meeting_date === fecha
    );

    const eventosDia = eventosMes.filter(
      e => e.event_date === fecha
    );

    const cumpleanosDia = cumpleanosMes.filter(
      p => p.birth_date.slice(5, 10) === fecha.slice(5)
    );

    const marcas = [
      ...reunionesDia.map(r => `
        <div class="reporte-marca">
          ${r.cancelled
            ? "<strong>No habrá reunión</strong>"
            : "Reunión"}
        </div>
      `),

      ...eventosDia.map(e => `
        <div class="reporte-marca">
          ${escapar(e.title || "Evento")}
        </div>
      `),

      ...cumpleanosDia.map(p => `
        <div class="reporte-marca reporte-marca-cumple">
          ${escapar(p.full_name)}
        </div>
      `)
    ].join("");

    celdas.push(`
      <div class="reporte-celda">
        <span class="reporte-numero-dia">${dia}</span>
        <div class="reporte-marcas">
          ${marcas}
        </div>
      </div>
    `);
  }

  while (celdas.length % 7 !== 0) {
    celdas.push(`
      <div
        class="reporte-celda reporte-celda-vacia"
        aria-hidden="true"
      ></div>
    `);
  }

  /* Unir reuniones y eventos y ordenarlos cronológicamente */
  const actividades = [
    ...reunionesMes.map(r => ({
      fecha: r.meeting_date,
      tipo: "reunion",
      datos: r
    })),
    ...eventosMes.map(e => ({
      fecha: e.event_date,
      tipo: "evento",
      datos: e
    }))
  ].sort((a, b) =>
    a.fecha.localeCompare(b.fecha) ||
    a.tipo.localeCompare(b.tipo)
  );

  const htmlActividades = actividades.length
    ? actividades.map(actividad => {
        const fecha = escapar(
          formatoFecha(actividad.fecha)
        );

        if (actividad.tipo === "reunion") {
          const r = actividad.datos;

          return `
            <article class="reporte-actividad">
              <div class="reporte-fecha">${fecha}</div>

              <div class="reporte-actividad-contenido">
                <h3>
                  ${r.cancelled
                    ? "No habrá reunión"
                    : "Reunión de Hope Group"}
                </h3>

                ${r.cancelled ? "" : `
                  <p>
                    <strong>Predicador:</strong>
                    ${escapar(r.preacher || "Por asignar")}
                  </p>

                  <p>
                    <strong>Responsable de refacción:</strong>
                    ${escapar(
                      r.snack_responsible || "Por asignar"
                    )}
                  </p>
                `}
              </div>
            </article>
          `;
        }

        const e = actividad.datos;

        return `
          <article class="reporte-actividad">
            <div class="reporte-fecha">${fecha}</div>

            <div class="reporte-actividad-contenido">
              <h3>${escapar(e.title || "Evento")}</h3>

              <p>
                <strong>Predicador / responsable:</strong>
                ${escapar(e.preacher || "Por asignar")}
              </p>

              <p>
                <strong>Responsable de refacción:</strong>
                ${escapar(
                  e.snack_responsible || "Por asignar"
                )}
              </p>
            </div>
          </article>
        `;
      }).join("")
    : `
      <p class="reporte-vacio">
        No hay reuniones ni eventos registrados para este mes.
      </p>
    `;

  const htmlCumpleanos = cumpleanosMes.length
    ? `
      <ul class="reporte-lista-cumpleanos">
        ${cumpleanosMes.map(p => {
          const dia = Number(p.birth_date.slice(8, 10));

          const fechaCumple = new Date(
            anio,
            mes,
            dia
          );

          const fechaTexto =
            fechaCumple.toLocaleDateString("es-GT", {
              day: "numeric",
              month: "long"
            });

          return `
            <li>
              <span class="reporte-cumple-fecha">
                ${escapar(fechaTexto)}
              </span>
              <span>${escapar(p.full_name)}</span>
            </li>
          `;
        }).join("")}
      </ul>
    `
    : `
      <p class="reporte-vacio">
        No hay cumpleaños registrados para este mes.
      </p>
    `;

  /* Crear el documento mensual */
  zona.innerHTML = `
    <div class="reporte-mensual">
      <header class="reporte-encabezado">

        <div class="reporte-marca-institucional">
          <img
            class="reporte-logo"
            src="recursos/logo.PNG"
            alt="Logo de Hope Group"
          >

          <div>
            <h1>Hope Group</h1>
            <p class="reporte-subtitulo">
              Calendario y organización
            </p>
          </div>
        </div>

        <h2>
          Calendario mensual — ${escapar(nombreMes)}
        </h2>

        ${plan?.theme ? `
          <p>
            <strong>Tema del mes:</strong>
            ${escapar(plan.theme)}
          </p>
        ` : ""}

        ${plan?.bible_verse ? `
          <p>
            <strong>Versículo:</strong>
            ${escapar(plan.bible_verse)}
          </p>
        ` : ""}
      </header>

      <section
        class="reporte-seccion reporte-seccion-calendario"
      >
        <h2>Calendario del mes</h2>

        <div class="reporte-calendario">
          <div class="reporte-dias-semana">
            ${DIAS.map(dia => `
              <div>${escapar(dia)}</div>
            `).join("")}
          </div>

          <div class="reporte-cuadricula">
            ${celdas.join("")}
          </div>
        </div>

        <div class="reporte-leyenda">
          <span>Reunión</span>
          <span>Evento</span>
          <span>Cumpleaños</span>
        </div>
      </section>

      <section class="reporte-seccion">
        <h2>Eventos y reuniones</h2>

        <div class="reporte-lista-actividades">
          ${htmlActividades}
        </div>
      </section>

      <section class="reporte-seccion">
        <h2>Cumpleañeros del mes</h2>
        ${htmlCumpleanos}
      </section>

      <footer class="reporte-pie">
        Hope Group · Documento generado el
        ${escapar(
          new Date().toLocaleDateString("es-GT")
        )}
      </footer>
    </div>
  `;

  /* Mostrar únicamente el documento al imprimir */
  zona.hidden = false;
  document.body.classList.add("imprimiendo-calendario");

  let limpiezaProgramada = false;

  const limpiarDespues = () => {
    if (limpiezaProgramada) return;
    limpiezaProgramada = true;

    zona.hidden = true;
    document.body.classList.remove(
      "imprimiendo-calendario"
    );

    window.removeEventListener(
      "afterprint",
      limpiarDespues
    );
  };

  window.addEventListener(
    "afterprint",
    limpiarDespues
  );

  /* Esperar a que el logo cargue antes de imprimir */
  const imagenes = [...zona.querySelectorAll("img")];

  Promise.all(imagenes.map(img => {
    if (img.complete) return Promise.resolve();

    return new Promise(resolve => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    });
  })).then(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  });
}

/* Nombre seguro para ordenar cumpleaños */
function pNombre(persona) {
  return String(persona?.full_name || "");
}

/* =========================
   19. ACTUALIZACIONES EN TIEMPO REAL
   ========================= */
function configurarTiempoReal() {
  if (!db) return;
  if (canalTiempoReal) {
    db.removeChannel(canalTiempoReal);
  }
  canalTiempoReal = db
    .channel("hope-group-cambios")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "meetings" },
      () => cargarDatos(true)
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "birthdays" },
      () => cargarDatos(true)
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "events" },
      () => cargarDatos(true)
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "monthly_plans" },
      () => cargarDatos(true)
    )
    .subscribe();
}
