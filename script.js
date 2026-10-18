
/* =========================================================
   HOPE GROUP — SCRIPT PRINCIPAL
   Archivo: script.js
   ========================================================= */

/* 1. CONFIGURACIÓN DE SUPABASE
   Sustituye estos valores por los de tu proyecto.
   Usa únicamente la clave publicable (anon/publishable).
   NUNCA coloques la service_role en este archivo.
   ========================================================= */

const SUPABASE_URL = "https://duakloumuwgjapduolqc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_y1iV_TM16wjWbdV5s9mafg_7BymHxru";

let db = null;
let sesionActual = null;
let esLider = false;
let fechaSeleccionada = new Date();
let reuniones = [];
let cumpleanos = [];
let reunionesPrivadas = [];
let cumpleanosPrivados = [];
let canalTiempoReal = null;
let cargando = false;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril",
  "Mayo", "Junio", "Julio", "Agosto",
  "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DIAS = [
  "Lunes", "Martes", "Miércoles", "Jueves",
  "Viernes", "Sábado", "Domingo"
];

const $ = (id) => document.getElementById(id);


/* =========================================================
   2. UTILIDADES
   ========================================================= */

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caracter) => ({
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

function parsearFechaLocal(valor) {
  if (!valor) return null;

  const partes = String(valor).slice(0, 10).split("-");

  if (partes.length !== 3) return null;

  const anio = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);

  if (!anio || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return null;
  }

  const fecha = new Date(anio, mes - 1, dia);

  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null;
  }

  return fecha;
}

function fechaLarga(fecha) {
  return fecha.toLocaleDateString("es-GT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatoCorto(fecha) {
  return fecha.toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function mostrarAviso(id, mensaje, tipo = "info") {
  const elemento = $(id);
  if (!elemento) return;

  elemento.textContent = mensaje;
  elemento.hidden = !mensaje;
  elemento.className = `aviso aviso-${tipo}`;
}

function ocultarAviso(id) {
  const elemento = $(id);
  if (elemento) elemento.hidden = true;
}

function establecerConexion(mensaje, conectado = false) {
  const elemento = $("estadoConexion");
  if (!elemento) return;

  elemento.replaceChildren();

  const punto = document.createElement("span");
  punto.className = "indicador-conexion";
  punto.setAttribute("aria-hidden", "true");

  const texto = document.createElement("span");
  texto.textContent = mensaje;

  elemento.append(punto, texto);
  elemento.classList.toggle("conectado", conectado);
}

function fechaEsBisiesta(anio) {
  return anio % 4 === 0 &&
    (anio % 100 !== 0 || anio % 400 === 0);
}

function obtenerDiaMesCumpleanos(cumple) {
  if (cumple.day_month) {
    const partes = String(cumple.day_month).split("-");
    if (partes.length === 2) {
      return {
        mes: Number(partes[0]),
        dia: Number(partes[1])
      };
    }
  }

  if (cumple.birth_date) {
    const fecha = parsearFechaLocal(cumple.birth_date);

    if (fecha) {
      return {
        mes: fecha.getMonth() + 1,
        dia: fecha.getDate()
      };
    }
  }

  return null;
}

function obtenerFechaCelebracion(cumple, anio) {
  const datos = obtenerDiaMesCumpleanos(cumple);
  if (!datos) return null;

  let mes = datos.mes;
  let dia = datos.dia;

  // Cumpleaños del 29 de febrero:
  // se celebra el 28 de febrero en años no bisiestos.
  if (
    mes === 2 &&
    dia === 29 &&
    !fechaEsBisiesta(anio)
  ) {
    dia = 28;
  }

  return new Date(anio, mes - 1, dia);
}

function fechaValida(valor) {
  return parsearFechaLocal(valor) !== null;
}

function esConfiguracionValida() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("PEGA_AQUI") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("PEGA_AQUI")
  );
}

function obtenerRangoMes(anio, mes) {
  const inicio = `${anio}-${String(mes + 1).padStart(2, "0")}-01`;

  const siguienteMes = new Date(anio, mes + 1, 1);
  const fin = fechaISO(siguienteMes);

  return { inicio, fin };
}


/* =========================================================
   3. INICIALIZACIÓN
   ========================================================= */

document.addEventListener("DOMContentLoaded", iniciarAplicacion);

async function iniciarAplicacion() {
  configurarSelectoresPeriodo();
  configurarEventos();
  actualizarTituloMes();

  if (!esConfiguracionValida()) {
    establecerConexion("Falta configurar Supabase");
    mostrarAviso(
      "avisoGeneral",
      "Configura SUPABASE_URL y SUPABASE_ANON_KEY en script.js para conectar la página.",
      "error"
    );

    renderizarCalendario();
    renderizarCumpleanos();
    renderizarDetalleDia();
    return;
  }

  if (!window.supabase?.createClient) {
    establecerConexion("No se pudo cargar Supabase");
    mostrarAviso(
      "avisoGeneral",
      "No se pudo cargar la biblioteca de Supabase. Comprueba tu conexión a internet.",
      "error"
    );
    return;
  }

  db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  await comprobarSesionInicial();

  db.auth.onAuthStateChange((_evento, sesion) => {
    sesionActual = sesion;

    // No se realizan operaciones de autenticación dentro
    // de este callback; la actualización se ejecuta después.
    Promise.resolve().then(() => actualizarSesion());
  });

  configurarTiempoReal();
  await cargarDatos();
}


/* =========================================================
   4. SELECTORES DE MES Y AÑO
   ========================================================= */

function configurarSelectoresPeriodo() {
  const selectorMes = $("selectorMes");
  const selectorAnio = $("selectorAnio");

  if (selectorMes) {
    selectorMes.value = String(fechaSeleccionada.getMonth());
  }

  if (selectorAnio) {
    const anioActual = new Date().getFullYear();
    const anios = [];

    for (let anio = anioActual - 2; anio <= anioActual + 5; anio++) {
      anios.push(anio);
    }

    selectorAnio.replaceChildren();

    anios.forEach((anio) => {
      const opcion = document.createElement("option");
      opcion.value = String(anio);
      opcion.textContent = String(anio);
      selectorAnio.appendChild(opcion);
    });

    selectorAnio.value = String(fechaSeleccionada.getFullYear());
  }
}

function sincronizarSelectoresPeriodo() {
  if ($("selectorMes")) {
    $("selectorMes").value = String(fechaSeleccionada.getMonth());
  }

  if ($("selectorAnio")) {
    const anio = fechaSeleccionada.getFullYear();
    const selector = $("selectorAnio");

    if (![...selector.options].some((opcion) => opcion.value === String(anio))) {
      const opcion = document.createElement("option");
      opcion.value = String(anio);
      opcion.textContent = String(anio);
      selector.appendChild(opcion);
    }

    selector.value = String(anio);
  }
}

function cambiarPeriodo(mes, anio) {
  fechaSeleccionada = new Date(anio, mes, 1);

  sincronizarSelectoresPeriodo();
  actualizarTituloMes();

  cargarDatos();
}

function actualizarTituloMes() {
  const elemento = $("mesActual");
  if (!elemento) return;

  elemento.textContent =
    `${MESES[fechaSeleccionada.getMonth()]} ${fechaSeleccionada.getFullYear()}`;
}


/* =========================================================
   5. EVENTOS DE LA PÁGINA
   ========================================================= */

function configurarEventos() {
  $("mesAnterior")?.addEventListener("click", () => {
    cambiarPeriodo(
      fechaSeleccionada.getMonth() - 1,
      fechaSeleccionada.getFullYear()
    );
  });

  $("mesSiguiente")?.addEventListener("click", () => {
    cambiarPeriodo(
      fechaSeleccionada.getMonth() + 1,
      fechaSeleccionada.getFullYear()
    );
  });

  $("selectorMes")?.addEventListener("change", (evento) => {
    cambiarPeriodo(
      Number(evento.target.value),
      fechaSeleccionada.getFullYear()
    );
  });

  $("selectorAnio")?.addEventListener("change", (evento) => {
    cambiarPeriodo(
      fechaSeleccionada.getMonth(),
      Number(evento.target.value)
    );
  });

  $("btnImprimir")?.addEventListener("click", () => {
    window.print();
  });

  $("formCumpleanos")?.addEventListener("submit", registrarCumpleanos);
  $("formLogin")?.addEventListener("submit", iniciarSesion);
  $("btnLogout")?.addEventListener("click", cerrarSesion);
  $("btnActualizar")?.addEventListener("click", cargarDatos);
  $("btnExportar")?.addEventListener("click", exportarCumpleanosCSV);
  $("btnGestionarReuniones")?.addEventListener("click", mostrarGestionReuniones);
  $("btnGestionarCumpleanos")?.addEventListener("click", mostrarGestionCumpleanos);
  $("btnGestionarDocumento")?.addEventListener("click", mostrarAvisoDocumentos);

  $("calendario")?.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-fecha]");
    if (!boton) return;

    const fecha = parsearFechaLocal(boton.dataset.fecha);
    if (!fecha) return;

    fechaSeleccionada = fecha;
    sincronizarSelectoresPeriodo();
    actualizarTituloMes();

    renderizarCalendario();
    renderizarDetalleDia();
  });
}


/* =========================================================
   6. CARGA DE DATOS PÚBLICOS
   ========================================================= */

async function cargarDatos() {
  if (!db || cargando) return;

  cargando = true;
  establecerConexion("Sincronizando información...");

  try {
    const anio = fechaSeleccionada.getFullYear();
    const mes = fechaSeleccionada.getMonth();
    const { inicio, fin } = obtenerRangoMes(anio, mes);

    const [resultadoReuniones, resultadoCumpleanos] = await Promise.all([
      db
        .from("public_meetings")
        .select("meeting_date, cancelled, preacher, snack_responsible")
        .gte("meeting_date", inicio)
        .lt("meeting_date", fin)
        .order("meeting_date", { ascending: true }),

      db
        .from("public_birthdays")
        .select("full_name, day_month")
    ]);

    if (resultadoReuniones.error) {
      throw resultadoReuniones.error;
    }

    if (resultadoCumpleanos.error) {
      throw resultadoCumpleanos.error;
    }

    reuniones = resultadoReuniones.data || [];
    cumpleanos = resultadoCumpleanos.data || [];

    renderizarCalendario();
    renderizarCumpleanos();
    renderizarDetalleDia();

    establecerConexion("Información sincronizada", true);
    ocultarAviso("avisoGeneral");

    if (esLider) {
      await cargarDatosPrivados();
    }
  } catch (error) {
    console.error("Error al cargar los datos:", error);

    establecerConexion("No se pudo sincronizar");

    mostrarAviso(
      "avisoGeneral",
      "No se pudieron cargar los datos. Comprueba tu conexión e inténtalo de nuevo.",
      "error"
    );

    renderizarCalendario();
    renderizarCumpleanos();
    renderizarDetalleDia();
  } finally {
    cargando = false;
  }
}


/* =========================================================
   7. CALENDARIO
   Semana de lunes a domingo.
   ========================================================= */

function renderizarCalendario() {
  const contenedor = $("calendario");
  if (!contenedor) return;

  contenedor.replaceChildren();

  const anio = fechaSeleccionada.getFullYear();
  const mes = fechaSeleccionada.getMonth();
  const primerDia = new Date(anio, mes, 1);
  const totalDias = new Date(anio, mes + 1, 0).getDate();

  // JavaScript usa domingo=0. Aquí lunes=0.
  const desplazamiento = (primerDia.getDay() + 6) % 7;

  DIAS.forEach((dia) => {
    const encabezado = document.createElement("div");
    encabezado.className = "dia-semana";
    encabezado.textContent = dia.slice(0, 3);
    encabezado.setAttribute("role", "columnheader");
    contenedor.appendChild(encabezado);
  });

  for (let i = 0; i < desplazamiento; i++) {
    const vacio = document.createElement("div");
    vacio.className = "dia vacio";
    vacio.setAttribute("aria-hidden", "true");
    contenedor.appendChild(vacio);
  }

  const hoy = fechaISO(new Date());

  for (let numeroDia = 1; numeroDia <= totalDias; numeroDia++) {
    const fecha = new Date(anio, mes, numeroDia);
    const fechaTexto = fechaISO(fecha);

    const reunionesDelDia = reuniones.filter(
      (reunion) => String(reunion.meeting_date).slice(0, 10) === fechaTexto
    );

    const cumpleanosDelDia = cumpleanos.filter((cumple) => {
      const fechaCumple = obtenerFechaCelebracion(cumple, anio);

      return fechaCumple &&
        fechaCumple.getMonth() === mes &&
        fechaCumple.getDate() === numeroDia;
    });

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "dia";
    boton.dataset.fecha = fechaTexto;
    boton.setAttribute("role", "gridcell");

    if (fechaTexto === hoy) boton.classList.add("hoy");

    if (fechaTexto === fechaISO(fechaSeleccionada)) {
      boton.classList.add("seleccionado");
      boton.setAttribute("aria-selected", "true");
    } else {
      boton.setAttribute("aria-selected", "false");
    }

    boton.setAttribute("aria-label", fechaLarga(fecha));

    const numero = document.createElement("span");
    numero.className = "numero-dia";
    numero.textContent = String(numeroDia);
    boton.appendChild(numero);

    if (reunionesDelDia.length > 0) {
      const marca = document.createElement("span");
      marca.className = "marca-reunion";
      marca.setAttribute("aria-label", "Reunión");
      boton.appendChild(marca);
    }

    if (cumpleanosDelDia.length > 0) {
      const marca = document.createElement("span");
      marca.className = "marca-cumple";
      marca.setAttribute("aria-label", "Cumpleaños");
      boton.appendChild(marca);
    }

    contenedor.appendChild(boton);
  }
}


/* =========================================================
   8. DETALLES DE LA FECHA SELECCIONADA
   ========================================================= */

function renderizarDetalleDia() {
  const titulo = $("tituloDetalle");
  const contenedor = $("detalleDia");

  if (!titulo || !contenedor) return;

  const fecha = new Date(
    fechaSeleccionada.getFullYear(),
    fechaSeleccionada.getMonth(),
    fechaSeleccionada.getDate()
  );

  const fechaTexto = fechaISO(fecha);

  titulo.textContent = fechaLarga(fecha);
  contenedor.replaceChildren();

  const reunionesDelDia = reuniones.filter(
    (reunion) => String(reunion.meeting_date).slice(0, 10) === fechaTexto
  );

  const cumpleanosDelDia = cumpleanos.filter((cumple) => {
    const fechaCumple = obtenerFechaCelebracion(
      cumple,
      fecha.getFullYear()
    );

    return fechaCumple &&
      fechaCumple.getMonth() === fecha.getMonth() &&
      fechaCumple.getDate() === fecha.getDate();
  });

  if (!reunionesDelDia.length && !cumpleanosDelDia.length) {
    const mensaje = document.createElement("p");
    mensaje.className = "texto-secundario";
    mensaje.textContent = "No hay eventos registrados para esta fecha.";
    contenedor.appendChild(mensaje);
    return;
  }

  reunionesDelDia.forEach((reunion) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "detalle-item";

    const tituloReunion = document.createElement("h4");
    tituloReunion.textContent = reunion.cancelled
      ? "No habrá reunión"
      : "Reunión de Hope Group";

    tarjeta.appendChild(tituloReunion);

    if (!reunion.cancelled) {
      agregarLineaDetalle(
        tarjeta,
        "Predicador",
        reunion.preacher || "Por asignar"
      );

      agregarLineaDetalle(
        tarjeta,
        "Refacción",
        formatearResponsables(reunion.snack_responsible) || "Por asignar"
      );
    }

    contenedor.appendChild(tarjeta);
  });

  if (cumpleanosDelDia.length) {
    const tarjeta = document.createElement("div");
    tarjeta.className = "detalle-item";

    const tituloCumples = document.createElement("h4");
    tituloCumples.textContent = "Cumpleaños";
    tarjeta.appendChild(tituloCumples);

    const lista = document.createElement("ul");

    cumpleanosDelDia.forEach((cumple) => {
      const elemento = document.createElement("li");
      elemento.textContent = cumple.full_name;
      lista.appendChild(elemento);
    });

    tarjeta.appendChild(lista);
    contenedor.appendChild(tarjeta);
  }
}

function agregarLineaDetalle(contenedor, etiqueta, valor) {
  const linea = document.createElement("p");

  const fuerte = document.createElement("strong");
  fuerte.textContent = `${etiqueta}: `;

  const texto = document.createElement("span");
  texto.textContent = valor;

  linea.append(fuerte, texto);
  contenedor.appendChild(linea);
}

function formatearResponsables(valor) {
  if (Array.isArray(valor)) return valor.join(", ");
  if (typeof valor === "string") return valor.trim();
  return "";
}


/* =========================================================
   9. CUMPLEAÑOS DEL MES
   Solo se muestran nombre y día/mes.
   ========================================================= */

function renderizarCumpleanos() {
  const contenedor = $("cumpleanosMes");
  if (!contenedor) return;

  contenedor.replaceChildren();

  const anio = fechaSeleccionada.getFullYear();
  const mes = fechaSeleccionada.getMonth();

  const delMes = cumpleanos
    .map((cumple) => ({
      cumple,
      fecha: obtenerFechaCelebracion(cumple, anio)
    }))
    .filter((item) =>
      item.fecha && item.fecha.getMonth() === mes
    )
    .sort((a, b) => a.fecha.getDate() - b.fecha.getDate());

  if (!delMes.length) {
    const mensaje = document.createElement("p");
    mensaje.className = "texto-secundario";
    mensaje.textContent = "No hay cumpleaños registrados este mes.";
    contenedor.appendChild(mensaje);
    return;
  }

  delMes.forEach(({ cumple, fecha }) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "cumple";

    const icono = document.createElement("div");
    icono.className = "cumple-icono";
    icono.textContent = String(fecha.getDate()).padStart(2, "0");
    icono.setAttribute("aria-hidden", "true");

    const informacion = document.createElement("div");

    const nombre = document.createElement("p");
    nombre.className = "cumple-nombre";
    nombre.textContent = cumple.full_name;

    const diaMes = document.createElement("p");
    diaMes.className = "cumple-fecha";
    diaMes.textContent = fecha.toLocaleDateString("es-GT", {
      day: "numeric",
      month: "long"
    });

    informacion.append(nombre, diaMes);
    tarjeta.append(icono, informacion);
    contenedor.appendChild(tarjeta);
  });
}


/* =========================================================
   10. REGISTRO PÚBLICO DE CUMPLEAÑOS
   La privacidad también debe imponerse en Supabase.
   ========================================================= */

async function registrarCumpleanos(evento) {
  evento.preventDefault();

  if (!db) {
    mostrarAviso("avisoCumpleanos", "Supabase no está configurado.", "error");
    return;
  }

  const nombre = normalizarTexto($("nombreCumple")?.value);
  const nacimiento = $("fechaCumple")?.value;
  const telefono = normalizarTexto($("telefonoCumple")?.value);

  if (nombre.length < 2 || nombre.length > 120) {
    mostrarAviso(
      "avisoCumpleanos",
      "Escribe un nombre completo válido.",
      "error"
    );
    return;
  }

  if (!fechaValida(nacimiento)) {
    mostrarAviso(
      "avisoCumpleanos",
      "Selecciona una fecha de nacimiento válida.",
      "error"
    );
    return;
  }

  if (telefono.length > 25) {
    mostrarAviso(
      "avisoCumpleanos",
      "El teléfono no debe superar 25 caracteres.",
      "error"
    );
    return;
  }

  const fechaNac = parsearFechaLocal(nacimiento);
  const hoy = parsearFechaLocal(fechaISO(new Date()));

  if (fechaNac > hoy) {
    const continuar = window.confirm(
      "La fecha de nacimiento está en el futuro. ¿Deseas registrarla de todos modos?"
    );

    if (!continuar) return;
  }

  const boton = $("btnGuardarCumple");
  if (boton) boton.disabled = true;

  mostrarAviso(
    "avisoCumpleanos",
    "Registrando cumpleaños...",
    "info"
  );

  try {
    const { error } = await db.from("birthdays").insert({
      full_name: nombre,
      birth_date: nacimiento,
      phone: telefono || null
    });

    if (error) {
      if (
        error.code === "23505" ||
        /duplicate|unique/i.test(error.message || "")
      ) {
        throw new Error(
          "Ya existe un registro con ese nombre y fecha de nacimiento."
        );
      }

      throw error;
    }

    $("formCumpleanos").reset();

    mostrarAviso(
      "avisoCumpleanos",
      "¡Cumpleaños registrado correctamente!",
      "exito"
    );

    await cargarDatos();
  } catch (error) {
    console.error("Error al registrar cumpleaños:", error);

    mostrarAviso(
      "avisoCumpleanos",
      error.message?.includes("Ya existe")
        ? error.message
        : "No se pudo registrar. Comprueba la conexión o contacta a un líder.",
      "error"
    );
  } finally {
    if (boton) boton.disabled = false;
  }
}


/* =========================================================
   11. AUTENTICACIÓN DE LÍDERES
   ========================================================= */

async function comprobarSesionInicial() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    console.error("Error al comprobar la sesión:", error);
    return;
  }

  sesionActual = data.session;
  await actualizarSesion();
}

async function iniciarSesion(evento) {
  evento.preventDefault();

  if (!db) return;

  const correo = normalizarTexto($("correoLider")?.value);
  const clave = $("claveLider")?.value;

  const boton = $("btnLogin");
  if (boton) boton.disabled = true;

  mostrarAviso("avisoLogin", "Verificando acceso...", "info");

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: correo,
      password: clave
    });

    if (error) throw error;

    sesionActual = data.session;
    await actualizarSesion();

    if (esLider) {
      $("formLogin")?.reset();
      mostrarAviso("avisoLogin", "", "info");
    } else {
      mostrarAviso(
        "avisoLogin",
        "Esta cuenta no tiene autorización de líder.",
        "error"
      );

      await db.auth.signOut();
    }
  } catch (error) {
    console.error("Error al iniciar sesión:", error);

    mostrarAviso(
      "avisoLogin",
      "No se pudo iniciar sesión. Comprueba tus datos o contacta al administrador.",
      "error"
    );
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function actualizarSesion() {
  if (!db) return;

  const { data } = await db.auth.getSession();
  sesionActual = data.session;

  esLider = false;

  if (sesionActual?.user) {
    const { data: perfil, error } = await db
      .from("leader_profiles")
      .select("user_id")
      .eq("user_id", sesionActual.user.id)
      .maybeSingle();

    if (!error && perfil) {
      esLider = true;
    } else {
      // Si no existe perfil de líder, la sesión no obtiene
      // permisos administrativos en la interfaz.
      if (error) console.error("Error al verificar el perfil:", error);
    }
  }

  actualizarInterfazLider();

  if (esLider) {
    await cargarDatosPrivados();
  } else {
    cumpleanosPrivados = [];
    reunionesPrivadas = [];
  }
}

function actualizarInterfazLider() {
  const formulario = $("formLogin");
  const panel = $("panelLider");
  const correo = $("correoActivo");

  if (formulario) formulario.hidden = esLider;
  if (panel) panel.hidden = !esLider;

  if (correo) {
    correo.textContent = esLider
      ? sesionActual?.user?.email || "Líder autorizado"
      : "";
  }
}

async function cerrarSesion() {
  if (!db) return;

  const { error } = await db.auth.signOut();

  if (error) {
    mostrarAviso(
      "avisoLogin",
      "No se pudo cerrar la sesión. Inténtalo de nuevo.",
      "error"
    );
    return;
  }

  sesionActual = null;
  esLider = false;
  cumpleanosPrivados = [];
  reunionesPrivadas = [];

  actualizarInterfazLider();
  mostrarAviso("avisoLogin", "Sesión cerrada correctamente.", "info");

  await cargarDatos();
}


/* =========================================================
   12. DATOS PRIVADOS PARA LÍDERES
   ========================================================= */

async function cargarDatosPrivados() {
  if (!db || !esLider) return;

  try {
    const anio = fechaSeleccionada.getFullYear();
    const mes = fechaSeleccionada.getMonth();
    const { inicio, fin } = obtenerRangoMes(anio, mes);

    const [resultadoCumples, resultadoReuniones] = await Promise.all([
      db
        .from("birthdays")
        .select("id, full_name, birth_date, phone")
        .order("full_name", { ascending: true }),

      db
        .from("meetings")
        .select("id, monthly_plan_id, meeting_date, cancelled, preacher, snack_responsible")
        .gte("meeting_date", inicio)
        .lt("meeting_date", fin)
        .order("meeting_date", { ascending: true })
    ]);

    if (resultadoCumples.error) throw resultadoCumples.error;
    if (resultadoReuniones.error) throw resultadoReuniones.error;

    cumpleanosPrivados = resultadoCumples.data || [];
    reunionesPrivadas = resultadoReuniones.data || [];
  } catch (error) {
    console.error("Error al cargar datos privados:", error);
  }
}


/* =========================================================
   13. GESTIONAR CUMPLEAÑOS
   ========================================================= */

async function mostrarGestionCumpleanos() {
  if (!esLider) return;

  await cargarDatosPrivados();

  const contenedor = $("contenidoAdministracion");
  if (!contenedor) return;

  contenedor.replaceChildren();

  const titulo = document.createElement("h3");
  titulo.textContent = "Administrar cumpleaños";
  contenedor.appendChild(titulo);

  if (!cumpleanosPrivados.length) {
    const mensaje = document.createElement("p");
    mensaje.textContent = "No hay registros.";
    contenedor.appendChild(mensaje);
    return;
  }

  cumpleanosPrivados.forEach((cumple) => {
    const fila = document.createElement("div");
    fila.className = "fila-administracion";

    const info = document.createElement("div");

    const nombre = document.createElement("strong");
    nombre.textContent = cumple.full_name;

    const fecha = document.createElement("p");
    const fechaNac = parsearFechaLocal(cumple.birth_date);
    fecha.textContent = fechaNac ? formatoCorto(fechaNac) : "Sin fecha";

    const telefono = document.createElement("p");
    telefono.textContent = cumple.phone || "Sin teléfono";

    info.append(nombre, fecha, telefono);

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton boton-peligro boton-pequeno";
    boton.textContent = "Eliminar";

    boton.addEventListener("click", async () => {
      const confirmar = window.confirm(
        `¿Eliminar el registro de ${cumple.full_name}? Esta acción no se puede deshacer.`
      );

      if (!confirmar) return;

      const { error } = await db
        .from("birthdays")
        .delete()
        .eq("id", cumple.id);

      if (error) {
        alert("No se pudo eliminar el registro. Comprueba los permisos.");
        console.error(error);
        return;
      }

      await cargarDatos();
      await mostrarGestionCumpleanos();
    });

    fila.append(info, boton);
    contenedor.appendChild(fila);
  });
}

/* =========================================================
   14. GESTIONAR REUNIONES Y ASIGNACIONES
   ========================================================= */

// Obtiene el plan del mes seleccionado o crea uno como borrador.
async function obtenerPlanMes(crearSiNoExiste = false) {
  if (!db || !esLider) {
    throw new Error("Debes iniciar sesión como líder.");
  }

  const anio = fechaSeleccionada.getFullYear();
  const mes = fechaSeleccionada.getMonth() + 1;

  const { data, error } = await db
    .from("monthly_plans")
    .select("id, year, month, status")
    .eq("year", anio)
    .eq("month", mes)
    .maybeSingle();

  if (error) throw error;
  if (data || !crearSiNoExiste) return data;

  const { data: nuevoPlan, error: errorCrear } = await db
    .from("monthly_plans")
    .insert({
      year: anio,
      month: mes,
      status: "draft",
      created_by: sesionActual.user.id
    })
    .select("id, year, month, status")
    .single();

  if (errorCrear) {
    // Puede que otro intento ya haya creado el plan.
    const { data: existente, error: errorBuscar } = await db
      .from("monthly_plans")
      .select("id, year, month, status")
      .eq("year", anio)
      .eq("month", mes)
      .maybeSingle();

    if (errorBuscar || !existente) throw errorCrear;
    return existente;
  }

  return nuevoPlan;
}


// Panel principal de reuniones.
async function mostrarGestionReuniones() {
  if (!esLider) return;

  const contenedor = $("contenidoAdministracion");
  if (!contenedor) return;

  contenedor.replaceChildren();

  const titulo = document.createElement("h3");
  titulo.textContent = "Gestionar reuniones";
  contenedor.appendChild(titulo);

  const descripcion = document.createElement("p");
  descripcion.textContent =
    "Selecciona la fecha, asigna la predicación y la refacción, y guarda la reunión.";
  contenedor.appendChild(descripcion);

  try {
    const plan = await obtenerPlanMes(false);
    await cargarDatosPrivados();

    const estado = document.createElement("p");
    estado.textContent = plan
      ? `Estado del plan: ${
          plan.status === "published" ? "Publicado" :
          plan.status === "archived" ? "Archivado" : "Borrador"
        }`
      : "Todavía no existe un plan para este mes.";
    contenedor.appendChild(estado);

    // Formulario para crear reuniones.
    const formulario = document.createElement("form");
    formulario.id = "formNuevaReunion";
    formulario.className = "formulario";

    const fechaInicial = fechaISO(new Date(
      fechaSeleccionada.getFullYear(),
      fechaSeleccionada.getMonth(),
      Math.max(1, fechaSeleccionada.getDate())
    ));

    formulario.innerHTML = `
      <h4>Agregar una reunión</h4>

      <div class="campo">
        <label for="nuevaFechaReunion">Fecha de la reunión</label>
        <input
          type="date"
          id="nuevaFechaReunion"
          value="${fechaInicial}"
          required
        >
      </div>

      <div class="campo">
        <label for="nuevoPredicador">Quién dará la prédica</label>
        <input
          type="text"
          id="nuevoPredicador"
          maxlength="120"
          placeholder="Nombre del predicador"
        >
      </div>

      <div class="campo">
        <label for="nuevaRefaccion">Responsable(s) de la refacción</label>
        <input
          type="text"
          id="nuevaRefaccion"
          maxlength="250"
          placeholder="Uno o varios nombres, separados por comas"
        >
      </div>

      <div class="campo">
        <label>
          <input type="checkbox" id="nuevaReunionCancelada">
          No habrá reunión ese día
        </label>
      </div>

      <button
        type="submit"
        class="boton boton-principal ancho-completo"
        id="btnCrearReunion"
      >
        Guardar reunión
      </button>
    `;

    formulario.addEventListener("submit", guardarNuevaReunion);
    contenedor.appendChild(formulario);

    // Publicar el plan hace visibles sus reuniones en el calendario.
    const botonPublicar = document.createElement("button");
    botonPublicar.type = "button";
    botonPublicar.className = "boton boton-secundario ancho-completo";
    botonPublicar.textContent = plan?.status === "published"
      ? "El plan de este mes ya está publicado"
      : "Publicar calendario de este mes";
    botonPublicar.disabled = plan?.status === "published";

    botonPublicar.addEventListener("click", publicarPlanMes);
    contenedor.appendChild(botonPublicar);

    const subtitulo = document.createElement("h4");
    subtitulo.textContent = "Reuniones registradas";
    contenedor.appendChild(subtitulo);

    if (!reunionesPrivadas.length) {
      const mensaje = document.createElement("p");
      mensaje.textContent =
        "Todavía no hay reuniones. Usa el formulario de arriba para agregar la primera.";
      contenedor.appendChild(mensaje);
      return;
    }

    reunionesPrivadas.forEach((reunion) => {
      const fila = document.createElement("div");
      fila.className = "fila-administracion";

      const info = document.createElement("div");
      const fecha = parsearFechaLocal(reunion.meeting_date);

      const nombre = document.createElement("strong");
      nombre.textContent = fecha
        ? fechaLarga(fecha)
        : String(reunion.meeting_date);

      const predica = document.createElement("p");
      predica.textContent = reunion.cancelled
        ? "Reunión cancelada"
        : `Prédica: ${reunion.preacher || "Por asignar"}`;

      const refaccion = document.createElement("p");
      refaccion.textContent = reunion.cancelled
        ? ""
        : `Refacción: ${
            formatearResponsables(reunion.snack_responsible) || "Por asignar"
          }`;

      info.append(nombre, predica, refaccion);

      const botonEditar = document.createElement("button");
      botonEditar.type = "button";
      botonEditar.className = "boton boton-secundario boton-pequeno";
      botonEditar.textContent = "Editar";
      botonEditar.addEventListener("click", () => editarReunion(reunion));

      fila.append(info, botonEditar);
      contenedor.appendChild(fila);
    });
  } catch (error) {
    console.error("Error al gestionar reuniones:", error);

    const mensaje = document.createElement("p");
    mensaje.className = "aviso aviso-error";
    mensaje.textContent =
      "No se pudo abrir la administración. Comprueba los permisos de Supabase y la conexión.";
    contenedor.appendChild(mensaje);
  }
}


// Guarda una reunión nueva en Supabase.
async function guardarNuevaReunion(evento) {
  evento.preventDefault();

  if (!esLider || !db) return;

  const fecha = $("nuevaFechaReunion")?.value;
  const predicador = normalizarTexto($("nuevoPredicador")?.value);
  const refaccion = normalizarTexto($("nuevaRefaccion")?.value);
  const cancelada = $("nuevaReunionCancelada")?.checked || false;
  const boton = $("btnCrearReunion");

  if (!fechaValida(fecha)) {
    alert("Selecciona una fecha válida.");
    return;
  }

  const fechaReunion = parsearFechaLocal(fecha);

  // Evita guardar una reunión dentro del plan de otro mes.
  if (
    fechaReunion.getFullYear() !== fechaSeleccionada.getFullYear() ||
    fechaReunion.getMonth() !== fechaSeleccionada.getMonth()
  ) {
    alert("La fecha debe pertenecer al mes seleccionado en el calendario.");
    return;
  }

  if (predicador.length > 120 || refaccion.length > 250) {
    alert("Revisa la longitud de los nombres ingresados.");
    return;
  }

  if (boton) boton.disabled = true;

  try {
    const plan = await obtenerPlanMes(true);

    if (plan.status === "archived") {
      throw new Error(
        "Este plan está archivado. Selecciona otro mes o revisa su estado."
      );
    }

    const { error } = await db
      .from("meetings")
      .insert({
        monthly_plan_id: plan.id,
        meeting_date: fecha,
        cancelled: cancelada,
        preacher: cancelada ? null : (predicador || null),
        snack_responsible: cancelada ? null : (refaccion || null)
      });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Ya existe una reunión registrada para esa fecha.");
      }
      throw error;
    }

    alert(
      plan.status === "published"
        ? "Reunión guardada. Se actualizará el calendario público."
        : "Reunión guardada como borrador. Publica el plan para mostrarla al grupo."
    );

    await cargarDatos();
    await mostrarGestionReuniones();
  } catch (error) {
    console.error("Error al crear reunión:", error);
    alert(error.message || "No se pudo guardar la reunión. Revisa los permisos de Supabase.");
  } finally {
    if (boton) boton.disabled = false;
  }
}


// Publica el plan mensual para que aparezca en el calendario público.
async function publicarPlanMes() {
  if (!esLider || !db) return;

  const confirmar = window.confirm(
    `¿Publicar el calendario de ${MESES[fechaSeleccionada.getMonth()]} ${fechaSeleccionada.getFullYear()}?`
  );

  if (!confirmar) return;

  try {
    const plan = await obtenerPlanMes(true);

    if (plan.status === "archived") {
      alert("No se puede publicar un plan archivado.");
      return;
    }

    const { error } = await db
      .from("monthly_plans")
      .update({ status: "published" })
      .eq("id", plan.id);

    if (error) throw error;

    alert("¡Calendario publicado!");

    await cargarDatos();
    await mostrarGestionReuniones();
  } catch (error) {
    console.error("Error al publicar el plan:", error);
    alert("No se pudo publicar. Verifica los permisos de monthly_plans en Supabase.");
  }
}


// Edita una reunión existente.
async function editarReunion(reunion) {
  if (!esLider || !db) return;

  const fechaActual = String(reunion.meeting_date).slice(0, 10);

  const nuevaFecha = window.prompt(
    "Fecha de la reunión (AAAA-MM-DD):",
    fechaActual
  );
  if (nuevaFecha === null) return;

  if (!fechaValida(nuevaFecha)) {
    alert("La fecha no es válida. Usa el formato AAAA-MM-DD.");
    return;
  }

  const fechaValidada = parsearFechaLocal(nuevaFecha);

  if (
    fechaValidada.getFullYear() !== fechaSeleccionada.getFullYear() ||
    fechaValidada.getMonth() !== fechaSeleccionada.getMonth()
  ) {
    alert("Para editarla, selecciona primero el mes al que pertenece la reunión.");
    return;
  }

  const nuevoPredicador = window.prompt(
    "Nombre del predicador:",
    reunion.preacher || ""
  );
  if (nuevoPredicador === null) return;

  const nuevaRefaccion = window.prompt(
    "Responsable(s) de refacción, separados por comas:",
    formatearResponsables(reunion.snack_responsible)
  );
  if (nuevaRefaccion === null) return;

  const respuesta = window.prompt(
    "¿Cancelar la reunión? Escribe sí o no:",
    reunion.cancelled ? "sí" : "no"
  );
  if (respuesta === null) return;

  const cancelada = ["sí", "si", "s", "yes", "y"].includes(
    respuesta.trim().toLowerCase()
  );

  try {
    const { error } = await db
      .from("meetings")
      .update({
        meeting_date: nuevaFecha,
        preacher: cancelada ? null : (normalizarTexto(nuevoPredicador) || null),
        snack_responsible: cancelada
          ? null
          : (normalizarTexto(nuevaRefaccion) || null),
        cancelled: cancelada
      })
      .eq("id", reunion.id);

    if (error) throw error;

    alert("Reunión actualizada correctamente.");

    await cargarDatos();
    await mostrarGestionReuniones();
  } catch (error) {
    console.error("Error al actualizar reunión:", error);
    alert("No se pudo guardar la reunión. Verifica los permisos y la estructura de la tabla.");
  }
}



/* =========================================================
   15. EXPORTACIÓN CSV PARA LÍDERES
   ========================================================= */

async function exportarCumpleanosCSV() {
  if (!esLider) return;

  await cargarDatosPrivados();

  if (!cumpleanosPrivados.length) {
    alert("No hay cumpleaños para exportar.");
    return;
  }

  const encabezados = [
    "Nombre completo",
    "Fecha de nacimiento",
    "Teléfono"
  ];

  const filas = cumpleanosPrivados.map((cumple) => [
    cumple.full_name,
    cumple.birth_date,
    cumple.phone || ""
  ]);

  const escaparCSV = (valor) =>
    `"${String(valor ?? "").replace(/"/g, '""')}"`;

  const contenido = [
    encabezados,
    ...filas
  ].map((fila) => fila.map(escaparCSV).join(",")).join("\r\n");

  const blob = new Blob(
    ["\uFEFF" + contenido],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = `cumpleanos_${fechaISO(new Date())}.csv`;

  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  URL.revokeObjectURL(url);
}


/* =========================================================
   16. DOCUMENTOS Y VERSIONES
   ========================================================= */

function mostrarAvisoDocumentos() {
  const contenedor = $("contenidoAdministracion");
  if (!contenedor) return;

  contenedor.replaceChildren();

  const titulo = document.createElement("h3");
  titulo.textContent = "Documentos oficiales";

  const mensaje = document.createElement("p");
  mensaje.textContent =
    "La publicación de PDF oficiales, el historial de versiones, los borradores privados y la selección de la versión vigente todavía requieren implementar el módulo de documentos y su almacenamiento.";

  contenedor.append(titulo, mensaje);
}


/* =========================================================
   17. ACTUALIZACIÓN EN TIEMPO REAL
   ========================================================= */

function configurarTiempoReal() {
  if (!db || canalTiempoReal) return;

  canalTiempoReal = db
    .channel("hope-group-reuniones")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "meetings"
      },
      async () => {
        await cargarDatos();
      }
    )
    .subscribe((estado) => {
      if (estado === "CHANNEL_ERROR") {
        console.warn("No se pudo activar la sincronización en tiempo real.");
      }
    });
}
