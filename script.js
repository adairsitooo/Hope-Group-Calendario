/* =========================================================
   HOPE GROUP — script.js
   Versión local: guarda la información en localStorage.
   Las actividades antiguas de "Grupos" se migran a "Reuniones".
   ========================================================= */
"use strict";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CLAVE_DATOS = "hopeCalendarLocalV1";

let fechaSeleccionada = new Date();
let reuniones = [];
let cumpleanos = [];
let eventos = [];
let planesMes = [];

const elemento = id => document.getElementById(id);
const escuchar = (id, tipo, callback) =>
  elemento(id)?.addEventListener(tipo, callback);

document.addEventListener("DOMContentLoaded", iniciarAplicacion);

function iniciarAplicacion() {
  cargarLocalStorage();
  configurarSelectores();
  configurarEventos();
  actualizarTituloMes();
  renderizarTodo();
  cambiarEstadoConexion("Guardado localmente");
}

/* =========================
   DATOS Y MIGRACIÓN
   ========================= */

function cargarLocalStorage() {
  try {
    const guardado = localStorage.getItem(CLAVE_DATOS);
    if (!guardado) return;

    const datos = JSON.parse(guardado);

    reuniones = Array.isArray(datos.reuniones) ? datos.reuniones : [];
    cumpleanos = Array.isArray(datos.cumpleanos) ? datos.cumpleanos : [];
    eventos = Array.isArray(datos.eventos) ? datos.eventos : [];
    planesMes = Array.isArray(datos.planesMes) ? datos.planesMes : [];

    /*
     * Conserva las actividades guardadas anteriormente como "Grupos".
     * Se convierten en reuniones con su título original.
     */
    const gruposAntiguos = Array.isArray(datos.grupos) ? datos.grupos : [];

    if (gruposAntiguos.length) {
      gruposAntiguos.forEach(grupo => {
        if (!grupo || !grupo.fecha) return;

        const yaExiste = reuniones.some(
          reunion =>
            reunion.id === grupo.id ||
            (
              reunion.fecha === grupo.fecha &&
              reunion.titulo === grupo.titulo &&
              reunion.migradoDeGrupo === true
            )
        );

        if (!yaExiste) {
          reuniones.push({
            id: grupo.id || idNuevo(),
            fecha: grupo.fecha,
            titulo: grupo.titulo || "Reunión",
            predicador: "",
            refaccion: "",
            cancelada: false,
            migradoDeGrupo: true
          });
        }
      });

      guardarLocalStorage();
    }
  } catch (error) {
    console.error("No se pudieron leer los datos locales:", error);
    mostrarAviso(
      "avisoGeneral",
      "No se pudieron leer los datos guardados. No borres los datos del navegador.",
      "error"
    );
  }
}

function guardarLocalStorage() {
  try {
    localStorage.setItem(
      CLAVE_DATOS,
      JSON.stringify({ reuniones, cumpleanos, eventos, planesMes })
    );

    cambiarEstadoConexion("Cambios guardados localmente");
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los datos:", error);
    mostrarAviso(
      "avisoGeneral",
      "No se pudieron guardar los cambios. Comprueba el espacio disponible del navegador.",
      "error"
    );
    return false;
  }
}

/* =========================
   EVENTOS Y SELECTORES
   ========================= */

function configurarEventos() {
  escuchar("mesAnterior", "click", () => moverMes(-1));
  escuchar("mesSiguiente", "click", () => moverMes(1));
  escuchar("selectorMes", "change", cambiarPeriodo);
  escuchar("selectorAnio", "change", cambiarPeriodo);
  escuchar("btnImprimir", "click", imprimirCalendario);

  escuchar("btnGestionarCumpleanos", "click", mostrarGestionCumpleanos);
  escuchar("btnGestionarReuniones", "click", mostrarGestionReuniones);
  escuchar("btnGestionarEventos", "click", mostrarGestionEventos);
  escuchar("btnExportar", "click", exportarCumpleanosCSV);
  escuchar("btnGestionarDocumento", "click", mostrarAvisoDocumentos);
}

function configurarSelectores() {
  const selMes = elemento("selectorMes");
  const selAnio = elemento("selectorAnio");

  if (selMes) selMes.value = String(fechaSeleccionada.getMonth());

  if (selAnio) {
    selAnio.replaceChildren();

    const actual = new Date().getFullYear();

    for (let anio = actual - 3; anio <= actual + 7; anio++) {
      const opcion = document.createElement("option");
      opcion.value = String(anio);
      opcion.textContent = String(anio);
      selAnio.appendChild(opcion);
    }

    selAnio.value = String(fechaSeleccionada.getFullYear());
  }
}

function cambiarPeriodo() {
  const mes = Number(elemento("selectorMes")?.value);
  const anio = Number(elemento("selectorAnio")?.value);

  if (
    !Number.isInteger(mes) ||
    mes < 0 ||
    mes > 11 ||
    !Number.isInteger(anio)
  ) return;

  fechaSeleccionada = new Date(anio, mes, 1);
  actualizarTituloMes();
  renderizarTodo();
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

  const selectorAnio = elemento("selectorAnio");

  if (selectorAnio) {
    const anio = fechaSeleccionada.getFullYear();

    if (![...selectorAnio.options].some(op => Number(op.value) === anio)) {
      const opcion = document.createElement("option");
      opcion.value = String(anio);
      opcion.textContent = String(anio);
      selectorAnio.appendChild(opcion);
    }

    selectorAnio.value = String(anio);
  }

  actualizarTituloMes();
  renderizarTodo();
}

function actualizarTituloMes() {
  if (elemento("mesActual")) {
    elemento("mesActual").textContent =
      `${MESES[fechaSeleccionada.getMonth()]} ${fechaSeleccionada.getFullYear()}`;
  }
}

/* =========================
   UTILIDADES
   ========================= */

function cambiarEstadoConexion(texto) {
  if (elemento("estadoConexion")) {
    elemento("estadoConexion").textContent = texto;
  }
}

function mostrarAviso(id, mensaje, tipo = "info") {
  const nodo = elemento(id);
  if (!nodo) return;

  nodo.textContent = mensaje;
  nodo.className = `aviso aviso-${tipo}`;
  nodo.hidden = false;
}

function ocultarAviso(id) {
  if (elemento(id)) elemento(id).hidden = true;
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
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function formatoFecha(fecha) {
  if (!fecha) return "Fecha sin definir";

  const fechaConvertida = new Date(`${fecha}T12:00:00`);

  return Number.isNaN(fechaConvertida.getTime())
    ? fecha
    : fechaConvertida.toLocaleDateString("es-GT", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
}

function obtenerDiaSemana(fecha) {
  return (fecha.getDay() + 6) % 7;
}

function idNuevo() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function renderizarTodo() {
  renderizarCalendario();
  renderizarCumpleanos();

  const fecha = elemento("calendario")
    ?.querySelector(".dia.seleccionado")
    ?.dataset.fecha;

  renderizarDetalleDia(fecha || null);
}

function tituloReunion(reunion) {
  return reunion.titulo || "Reunión";
}

function actividadesFecha(fecha) {
  return [
    ...reuniones
      .filter(x => x.fecha === fecha)
      .map(x => ({ categoria: "reunion", datos: x })),

    ...eventos
      .filter(x => x.fecha === fecha)
      .map(x => ({ categoria: "evento", datos: x })),

    ...cumpleanos
      .filter(x => x.fecha?.slice(5) === fecha.slice(5))
      .map(x => ({ categoria: "cumple", datos: x }))
  ];
}

/* =========================
   CALENDARIO PRINCIPAL
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

  const cuadricula = document.createElement("div");
  cuadricula.className = "dias-mes";

  const anio = fechaSeleccionada.getFullYear();
  const mes = fechaSeleccionada.getMonth();
  const inicio = obtenerDiaSemana(new Date(anio, mes, 1));
  const total = new Date(anio, mes + 1, 0).getDate();

  const seleccionada =
    contenedor.querySelector(".dia.seleccionado")?.dataset.fecha ||
    fechaISO(fechaSeleccionada);

  for (let i = 0; i < inicio; i++) {
    const vacio = document.createElement("div");
    vacio.className = "dia dia-vacio";
    vacio.setAttribute("aria-hidden", "true");
    cuadricula.appendChild(vacio);
  }

  for (let numero = 1; numero <= total; numero++) {
    const fecha = fechaISO(new Date(anio, mes, numero));
    const celda = document.createElement("button");

    celda.type = "button";
    celda.className = "dia";
    celda.dataset.fecha = fecha;
    celda.setAttribute("aria-label", `${numero} de ${MESES[mes]} de ${anio}`);

    if (fecha === seleccionada) celda.classList.add("seleccionado");

    const numeroDia = document.createElement("span");
    numeroDia.className = "numero-dia";
    numeroDia.textContent = String(numero);
    celda.appendChild(numeroDia);

    const marcas = document.createElement("span");
    marcas.className = "marcas-dia";

    reuniones
      .filter(x => x.fecha === fecha)
      .forEach(x => agregarMarca(
        marcas,
        "marca-reunion",
        x.cancelada ? `${tituloReunion(x)} (cancelada)` : tituloReunion(x)
      ));

    if (cumpleanos.some(x => x.fecha?.slice(5) === fecha.slice(5))) {
      agregarMarca(marcas, "marca-cumple", "Cumpleaños");
    }

    eventos
      .filter(x => x.fecha === fecha)
      .forEach(x => agregarMarca(marcas, "marca-evento", x.titulo || "Evento"));

    celda.appendChild(marcas);

    celda.addEventListener("click", () => {
      contenedor
        .querySelectorAll(".dia.seleccionado")
        .forEach(x => x.classList.remove("seleccionado"));

      celda.classList.add("seleccionado");
      renderizarDetalleDia(fecha);
    });

    cuadricula.appendChild(celda);
  }

  contenedor.appendChild(cuadricula);
}

function agregarMarca(contenedor, clase, titulo) {
  const marca = document.createElement("span");
  marca.className = clase;
  marca.title = titulo;
  marca.setAttribute("aria-label", titulo);
  contenedor.appendChild(marca);
}

function renderizarDetalleDia(fecha) {
  const titulo = elemento("tituloDetalle");
  const detalle = elemento("detalleDia");

  if (!detalle) return;
  detalle.replaceChildren();

  if (!fecha) {
    if (titulo) titulo.textContent = "Selecciona una fecha";

    const parrafo = document.createElement("p");
    parrafo.className = "texto-secundario";
    parrafo.textContent = "Selecciona un día para consultar sus actividades.";
    detalle.appendChild(parrafo);
    return;
  }

  if (titulo) titulo.textContent = formatoFecha(fecha);

  const items = actividadesFecha(fecha);

  if (!items.length) {
    const parrafo = document.createElement("p");
    parrafo.className = "texto-secundario";
    parrafo.textContent = "No hay actividades registradas para este día.";
    detalle.appendChild(parrafo);
    return;
  }

  items.forEach(({ categoria, datos }) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = `detalle-actividad detalle-${categoria}`;

    const encabezado = document.createElement("h4");
    const parrafo = document.createElement("p");

    if (categoria === "reunion") {
      encabezado.textContent = datos.cancelada
        ? `${tituloReunion(datos)} — Cancelada`
        : tituloReunion(datos);

      parrafo.textContent = datos.cancelada
        ? "Esta reunión está cancelada."
        : `Predicador: ${datos.predicador || "Por asignar"} · Refacción: ${datos.refaccion || "Por asignar"}`;
    }

    if (categoria === "evento") {
      encabezado.textContent = datos.titulo || "Evento";
      parrafo.textContent = "Evento programado";
    }

    if (categoria === "cumple") {
      encabezado.textContent = datos.nombre;
      parrafo.textContent = "Cumpleaños";
    }

    tarjeta.append(encabezado, parrafo);
    detalle.appendChild(tarjeta);
  });
}

function renderizarCumpleanos() {
  const contenedor = elemento("cumpleanosMes");
  if (!contenedor) return;

  contenedor.replaceChildren();

  const mes = fechaSeleccionada.getMonth();

  const lista = cumpleanos
    .filter(x => x.fecha && new Date(`${x.fecha}T12:00:00`).getMonth() === mes)
    .sort((a, b) =>
      Number(a.fecha.slice(8, 10)) - Number(b.fecha.slice(8, 10)) ||
      a.nombre.localeCompare(b.nombre, "es")
    );

  if (!lista.length) {
    const parrafo = document.createElement("p");
    parrafo.className = "texto-secundario";
    parrafo.textContent = "No hay cumpleaños registrados este mes.";
    contenedor.appendChild(parrafo);
    return;
  }

  lista.forEach(x => {
    const fila = document.createElement("article");
    fila.className = "cumple";

    const fecha = document.createElement("span");
    fecha.className = "cumple-fecha";
    fecha.textContent = x.fecha.slice(8, 10);

    const nombre = document.createElement("span");
    nombre.className = "cumple-nombre";
    nombre.textContent = x.nombre;

    fila.append(fecha, nombre);
    contenedor.appendChild(fila);
  });
}

/* =========================
   ADMINISTRACIÓN
   ========================= */

function limpiarAdmin(tituloTexto) {
  const contenedor = elemento("contenidoAdministracion");
  if (!contenedor) return null;

  contenedor.replaceChildren();

  const titulo = document.createElement("h3");
  titulo.textContent = tituloTexto;
  contenedor.appendChild(titulo);

  return contenedor;
}

function campoHTML(id, label, type = "text", extra = "") {
  return `<div class="campo"><label for="${id}">${label}</label><input id="${id}" type="${type}" ${extra} required></div>`;
}

function crearListaAdmin(contenedor, items, descripcion, editar, borrar) {
  const lista = document.createElement("div");
  lista.className = "lista-administracion";

  items.forEach(item => {
    const fila = document.createElement("div");
    fila.className = "fila-administracion";

    const info = document.createElement("div");
    info.innerHTML = descripcion(item);

    const acciones = document.createElement("div");
    acciones.className = "acciones-lider";

    [
      ["Editar", "boton boton-secundario", () => editar(item)],
      ["Eliminar", "boton boton-borde", () => borrar(item)]
    ].forEach(([texto, clase, funcion]) => {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = clase;
      boton.textContent = texto;
      boton.addEventListener("click", funcion);
      acciones.appendChild(boton);
    });

    fila.append(info, acciones);
    lista.appendChild(fila);
  });

  contenedor.appendChild(lista);
}

function fechaLimitesMes() {
  return {
    min: fechaISO(new Date(
      fechaSeleccionada.getFullYear(),
      fechaSeleccionada.getMonth(),
      1
    )),
    max: fechaISO(new Date(
      fechaSeleccionada.getFullYear(),
      fechaSeleccionada.getMonth() + 1,
      0
    ))
  };
}

/* Cumpleaños */

function mostrarGestionCumpleanos() {
  const contenedor = limpiarAdmin("Administrar cumpleaños");
  if (!contenedor) return;

  const formulario = document.createElement("form");
  formulario.className = "formulario";

  formulario.innerHTML =
    campoHTML("cumpleNombre", "Nombre completo", "text", 'maxlength="120"') +
    campoHTML("cumpleFecha", "Fecha de nacimiento", "date") +
    `<div class="campo"><label for="cumpleTelefono">Teléfono (opcional)</label><input id="cumpleTelefono" type="tel" maxlength="25"></div>
    <button class="boton boton-principal" type="submit">Agregar cumpleaños</button>`;

  formulario.addEventListener("submit", e => {
    e.preventDefault();

    const nombre = elemento("cumpleNombre").value.trim();
    const fecha = elemento("cumpleFecha").value;

    if (!nombre || !fecha) return;

    cumpleanos.push({
      id: idNuevo(),
      nombre,
      fecha,
      telefono: elemento("cumpleTelefono").value.trim()
    });

    guardarLocalStorage();
    renderizarTodo();
    mostrarGestionCumpleanos();
    mostrarAviso("avisoGeneral", "Cumpleaños agregado.", "exito");
  });

  contenedor.appendChild(formulario);

  crearListaAdmin(
    contenedor,
    cumpleanos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)),
    x => `<strong>${escaparHTML(x.nombre)}</strong><p>${escaparHTML(formatoFecha(x.fecha))}</p>`,
    x => {
      const nombre = prompt("Nombre completo:", x.nombre);
      if (nombre === null) return;

      const fecha = prompt("Fecha (AAAA-MM-DD):", x.fecha);
      if (fecha === null) return;

      if (!nombre.trim() || !validarFecha(fecha)) {
        mostrarAviso("avisoGeneral", "Revisa el nombre y la fecha.", "error");
        return;
      }

      x.nombre = nombre.trim();
      x.fecha = fecha;

      guardarLocalStorage();
      renderizarTodo();
      mostrarGestionCumpleanos();
    },
    x => {
      if (!confirm(`¿Eliminar el cumpleaños de ${x.nombre}?`)) return;

      cumpleanos = cumpleanos.filter(p => p.id !== x.id);
      guardarLocalStorage();
      renderizarTodo();
      mostrarGestionCumpleanos();
    }
  );
}

/* Reuniones: incluye las actividades antiguas de grupos */

function mostrarGestionReuniones() {
  const contenedor = limpiarAdmin("Administrar reuniones");
  if (!contenedor) return;

  const limites = fechaLimitesMes();
  const formulario = document.createElement("form");
  formulario.className = "formulario";

  formulario.innerHTML =
    `<div class="campo"><label for="reunionTitulo">Nombre de la reunión o actividad (opcional)</label><input id="reunionTitulo" maxlength="160" placeholder="Ej. Reunión de jóvenes"></div>` +
    campoHTML("reunionFecha", "Fecha de reunión", "date", `min="${limites.min}" max="${limites.max}"`) +
    `<div class="campo"><label for="reunionPredicador">Predicador (opcional)</label><input id="reunionPredicador" maxlength="120"></div>
    <div class="campo"><label for="reunionRefaccion">Responsable de refacción (opcional)</label><input id="reunionRefaccion" maxlength="120"></div>
    <div class="campo campo-checkbox"><label><input id="reunionCancelada" type="checkbox"> No habrá reunión</label></div>
    <button class="boton boton-principal" type="submit">Agregar reunión</button>`;

  formulario.addEventListener("submit", e => {
    e.preventDefault();

    const fecha = elemento("reunionFecha").value;
    const titulo = elemento("reunionTitulo").value.trim();

    if (!fecha) return;

    if (!fecha.startsWith(limites.min.slice(0, 7))) {
      mostrarAviso("avisoGeneral", "La reunión debe pertenecer al mes seleccionado.", "error");
      return;
    }

    reuniones.push({
      id: idNuevo(),
      fecha,
      titulo,
      predicador: elemento("reunionPredicador").value.trim(),
      refaccion: elemento("reunionRefaccion").value.trim(),
      cancelada: elemento("reunionCancelada").checked
    });

    guardarLocalStorage();
    renderizarTodo();
    mostrarGestionReuniones();
    mostrarAviso("avisoGeneral", "Reunión guardada.", "exito");
  });

  contenedor.appendChild(formulario);

  crearListaAdmin(
    contenedor,
    reuniones.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)),
    x =>
      `<strong>${escaparHTML(formatoFecha(x.fecha))} — ${escaparHTML(tituloReunion(x))}</strong>
      <p>${x.cancelada ? "Reunión cancelada" : `Predicador: ${escaparHTML(x.predicador || "Por asignar")}`}</p>
      ${x.cancelada ? "" : `<p>Refacción: ${escaparHTML(x.refaccion || "Por asignar")}</p>`}`,
    x => {
      const titulo = prompt("Nombre de la reunión o actividad:", x.titulo || "");
      if (titulo === null) return;

      const fecha = prompt("Fecha (AAAA-MM-DD):", x.fecha);
      if (fecha === null) return;

      if (!validarFecha(fecha)) {
        mostrarAviso("avisoGeneral", "Revisa la fecha.", "error");
        return;
      }

      const predicador = prompt("Predicador:", x.predicador || "");
      if (predicador === null) return;

      const refaccion = prompt("Responsable de refacción:", x.refaccion || "");
      if (refaccion === null) return;

      x.titulo = titulo.trim();
      x.fecha = fecha;
      x.predicador = predicador.trim();
      x.refaccion = refaccion.trim();
      x.cancelada = confirm("¿Marcar la reunión como cancelada? Aceptar = sí.");

      guardarLocalStorage();
      renderizarTodo();
      mostrarGestionReuniones();
    },
    x => {
      if (!confirm(`¿Eliminar "${tituloReunion(x)}" del ${formatoFecha(x.fecha)}?`)) return;

      reuniones = reuniones.filter(r => r.id !== x.id);
      guardarLocalStorage();
      renderizarTodo();
      mostrarGestionReuniones();
    }
  );
}

/* Eventos */

function mostrarGestionEventos() {
  const contenedor = limpiarAdmin("Administrar eventos");
  if (!contenedor) return;

  const limites = fechaLimitesMes();
  const formulario = document.createElement("form");
  formulario.className = "formulario";

  formulario.innerHTML =
    campoHTML("eventoTitulo", "Nombre del evento", "text", 'maxlength="160"') +
    campoHTML("eventoFecha", "Fecha", "date", `min="${limites.min}" max="${limites.max}"`) +
    `<button class="boton boton-principal" type="submit">Agregar evento</button>`;

  formulario.addEventListener("submit", e => {
    e.preventDefault();

    const titulo = elemento("eventoTitulo").value.trim();
    const fecha = elemento("eventoFecha").value;

    if (!titulo || !fecha) return;

    if (!fecha.startsWith(limites.min.slice(0, 7))) {
      mostrarAviso("avisoGeneral", "El evento debe pertenecer al mes seleccionado.", "error");
      return;
    }

    eventos.push({ id: idNuevo(), titulo, fecha });

    guardarLocalStorage();
    renderizarTodo();
    mostrarGestionEventos();
    mostrarAviso("avisoGeneral", "Evento guardado.", "exito");
  });

  contenedor.appendChild(formulario);

  crearListaAdmin(
    contenedor,
    eventos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)),
    x => `<strong>${escaparHTML(x.titulo)}</strong><p>${escaparHTML(formatoFecha(x.fecha))}</p>`,
    x => {
      const titulo = prompt("Nombre del evento:", x.titulo);
      if (titulo === null) return;

      const fecha = prompt("Fecha (AAAA-MM-DD):", x.fecha);
      if (fecha === null) return;

      if (!titulo.trim() || !validarFecha(fecha)) {
        mostrarAviso("avisoGeneral", "El nombre y la fecha son obligatorios.", "error");
        return;
      }

      x.titulo = titulo.trim();
      x.fecha = fecha;

      guardarLocalStorage();
      renderizarTodo();
      mostrarGestionEventos();
    },
    x => {
      if (!confirm(`¿Eliminar el evento "${x.titulo}"?`)) return;

      eventos = eventos.filter(e => e.id !== x.id);
      guardarLocalStorage();
      renderizarTodo();
      mostrarGestionEventos();
    }
  );
}

function validarFecha(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;

  const d = new Date(`${fecha}T12:00:00`);
  return !Number.isNaN(d.getTime()) && fechaISO(d) === fecha;
}

/* =========================
   EXPORTAR Y RESPALDAR
   ========================= */

function exportarCumpleanosCSV() {
  const filas = [
    ["Nombre", "Fecha de nacimiento", "Teléfono"],
    ...cumpleanos.map(x => [x.nombre, x.fecha, x.telefono || ""])
  ];

  const csv = filas
    .map(fila => fila.map(valor =>
      `"${String(valor ?? "").replace(/"/g, '""')}"`
    ).join(","))
    .join("\r\n");

  descargarArchivo(
    `\uFEFF${csv}`,
    `cumpleanos_${fechaSeleccionada.getFullYear()}_${String(fechaSeleccionada.getMonth() + 1).padStart(2, "0")}.csv`,
    "text/csv;charset=utf-8;"
  );
}

function descargarArchivo(contenido, nombre, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function mostrarAvisoDocumentos() {
  const contenedor = limpiarAdmin("Respaldo de datos");
  if (!contenedor) return;

  const parrafo = document.createElement("p");
  parrafo.className = "texto-secundario";
  parrafo.textContent =
    "Descarga una copia de seguridad de los datos locales y guárdala en un lugar seguro.";

  const exportar = document.createElement("button");
  exportar.type = "button";
  exportar.className = "boton boton-principal";
  exportar.textContent = "Descargar respaldo JSON";

  exportar.addEventListener("click", () => {
    descargarArchivo(
      JSON.stringify({ reuniones, cumpleanos, eventos, planesMes }, null, 2),
      `hope-calendar-respaldo-${fechaISO(new Date())}.json`,
      "application/json"
    );
  });

  const etiqueta = document.createElement("label");
  etiqueta.className = "campo";
  etiqueta.textContent = "Restaurar respaldo JSON";

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";

  input.addEventListener("change", async () => {
    const archivo = input.files?.[0];
    if (!archivo) return;

    try {
      const datos = JSON.parse(await archivo.text());

      if (
        !Array.isArray(datos.reuniones) ||
        !Array.isArray(datos.cumpleanos) ||
        !Array.isArray(datos.eventos) ||
        (datos.grupos !== undefined && !Array.isArray(datos.grupos))
      ) {
        throw new Error("El archivo no tiene el formato esperado.");
      }

      if (!confirm("Restaurar reemplazará los datos locales actuales. ¿Continuar?")) {
        input.value = "";
        return;
      }

      reuniones = datos.reuniones.slice();
      cumpleanos = datos.cumpleanos;
      eventos = datos.eventos;
      planesMes = Array.isArray(datos.planesMes) ? datos.planesMes : [];

      // También migra los grupos incluidos en respaldos antiguos.
      const gruposAntiguos = Array.isArray(datos.grupos) ? datos.grupos : [];

      gruposAntiguos.forEach(grupo => {
        if (!grupo || !grupo.fecha) return;

        const yaExiste = reuniones.some(
          reunion =>
            reunion.id === grupo.id ||
            (
              reunion.fecha === grupo.fecha &&
              reunion.titulo === grupo.titulo &&
              reunion.migradoDeGrupo === true
            )
        );

        if (!yaExiste) {
          reuniones.push({
            id: grupo.id || idNuevo(),
            fecha: grupo.fecha,
            titulo: grupo.titulo || "Reunión",
            predicador: "",
            refaccion: "",
            cancelada: false,
            migradoDeGrupo: true
          });
        }
      });

      if (!guardarLocalStorage()) return;

      renderizarTodo();
      mostrarAviso("avisoGeneral", "Respaldo restaurado correctamente.", "exito");
      mostrarAvisoDocumentos();
    } catch (error) {
      mostrarAviso(
        "avisoGeneral",
        `No se pudo restaurar el archivo: ${error.message}`,
        "error"
      );
    }
  });

  etiqueta.appendChild(input);
  contenedor.append(parrafo, exportar, etiqueta);
}

/* =========================
   CALENDARIO PARA PDF
   ========================= */

function imprimirCalendario() {
  const zona = elemento("zonaImpresion");

  if (!zona) {
    console.error("No se encontró #zonaImpresion.");
    return;
  }

  const anio = fechaSeleccionada.getFullYear();
  const mes = fechaSeleccionada.getMonth();
  const nombreMes = `${MESES[mes]} ${anio}`;
  const prefijo = `${anio}-${String(mes + 1).padStart(2, "0")}`;

  const reunionesMes = reuniones
    .filter(x => x.fecha?.startsWith(prefijo))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const eventosMes = eventos
    .filter(x => x.fecha?.startsWith(prefijo))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const cumpleMes = cumpleanos
    .filter(x => x.fecha?.slice(5, 7) === String(mes + 1).padStart(2, "0"))
    .sort((a, b) =>
      a.fecha.slice(5, 10).localeCompare(b.fecha.slice(5, 10)) ||
      a.nombre.localeCompare(b.nombre, "es")
    );

  const plan = planesMes.find(
    x => Number(x.year) === anio && Number(x.month) === mes + 1
  ) || {};

  const inicio = obtenerDiaSemana(new Date(anio, mes, 1));
  const total = new Date(anio, mes + 1, 0).getDate();
  const celdas = [];

  for (let i = 0; i < inicio; i++) {
    celdas.push('<div class="reporte-celda reporte-celda-vacia" aria-hidden="true"></div>');
  }

  for (let dia = 1; dia <= total; dia++) {
    const fecha = fechaISO(new Date(anio, mes, dia));

    const marcas = [
      ...reunionesMes
        .filter(x => x.fecha === fecha)
        .map(x =>
          `<div class="reporte-marca reporte-marca-reunion">${escaparHTML(tituloReunion(x))}${x.cancelada ? " — Cancelada" : ""}</div>`
        ),

      ...eventosMes
        .filter(x => x.fecha === fecha)
        .map(x =>
          `<div class="reporte-marca reporte-marca-evento">${escaparHTML(x.titulo || "Evento")}</div>`
        ),

      ...cumpleMes
        .filter(x => x.fecha.slice(5, 10) === fecha.slice(5))
        .map(x =>
          `<div class="reporte-marca reporte-marca-cumple">Cumpleaños: ${escaparHTML(x.nombre)}</div>`
        )
    ].join("");

    celdas.push(
      `<div class="reporte-celda">
        <span class="reporte-numero-dia">${dia}</span>
        <div class="reporte-marcas">${marcas}</div>
      </div>`
    );
  }

  while (celdas.length % 7 !== 0) {
    celdas.push('<div class="reporte-celda reporte-celda-vacia" aria-hidden="true"></div>');
  }

  const actividades = [
    ...reunionesMes.map(x => ({ fecha: x.fecha, tipo: "reunion", datos: x })),
    ...eventosMes.map(x => ({ fecha: x.fecha, tipo: "evento", datos: x }))
  ].sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || a.tipo.localeCompare(b.tipo)
  );

  const htmlActividades = actividades.length
    ? actividades.map(x => {
        const datos = x.datos;
        let titulo = "";
        let detalle = "";

        if (x.tipo === "reunion") {
          titulo = `${tituloReunion(datos)}${datos.cancelada ? " — Cancelada" : ""}`;

          detalle = datos.cancelada
            ? "<p>Esta reunión está cancelada.</p>"
            : `<p><strong>Predicador:</strong> ${escaparHTML(datos.predicador || "Por asignar")}</p>
               <p><strong>Responsable de refacción:</strong> ${escaparHTML(datos.refaccion || "Por asignar")}</p>`;
        }

        if (x.tipo === "evento") {
          titulo = datos.titulo || "Evento";
        }

        return `<article class="reporte-actividad">
          <div class="reporte-fecha">${escaparHTML(formatoFecha(x.fecha))}</div>
          <div class="reporte-actividad-contenido">
            <h3>${escaparHTML(titulo)}</h3>${detalle}
          </div>
        </article>`;
      }).join("")
    : '<p class="reporte-vacio">No hay actividades registradas para este mes.</p>';

  const htmlCumple = cumpleMes.length
    ? `<ul class="reporte-lista-cumpleanos">${cumpleMes.map(x => {
        const fechaCumple = new Date(
          `${anio}-${String(mes + 1).padStart(2, "0")}-${x.fecha.slice(8, 10)}T12:00:00`
        ).toLocaleDateString("es-GT", { day: "numeric", month: "long" });

        return `<li>
          <span class="reporte-cumple-fecha">${escaparHTML(fechaCumple)}</span>
          <span>${escaparHTML(x.nombre)}</span>
        </li>`;
      }).join("")}</ul>`
    : '<p class="reporte-vacio">No hay cumpleaños registrados para este mes.</p>';

  zona.innerHTML = `
    <div class="reporte-mensual">
      <header class="reporte-encabezado">
        <div class="reporte-marca-institucional">
          <img class="reporte-logo" src="recursos/logo.PNG" alt="Logo de Hope Group" onerror="this.style.display='none'">
          <div>
            <h1>Hope Group</h1>
            <p class="reporte-subtitulo">Calendario y organización</p>
          </div>
        </div>

        <h2>Calendario mensual — ${escaparHTML(nombreMes)}</h2>
        ${plan.theme ? `<p><strong>Tema del mes:</strong> ${escaparHTML(plan.theme)}</p>` : ""}
        ${plan.bible_verse ? `<p><strong>Versículo:</strong> ${escaparHTML(plan.bible_verse)}</p>` : ""}
      </header>

      <section class="reporte-seccion reporte-seccion-calendario">
        <h2>Calendario del mes</h2>

        <div class="reporte-calendario">
          <div class="reporte-dias-semana">
            ${DIAS.map(dia => `<div>${dia}</div>`).join("")}
          </div>

          <div class="reporte-cuadricula">
            ${celdas.join("")}
          </div>
        </div>

        <div class="reporte-leyenda">
          <span>Reuniones</span>
          <span>Eventos</span>
          <span>Cumpleaños</span>
        </div>
      </section>

      <section class="reporte-seccion">
        <h2>Actividades del mes</h2>
        <div class="reporte-lista-actividades">${htmlActividades}</div>
      </section>

      <section class="reporte-seccion">
        <h2>Cumpleañeros del mes</h2>
        ${htmlCumple}
      </section>

      <footer class="reporte-pie">
        Hope Group · Documento generado el ${escaparHTML(new Date().toLocaleDateString("es-GT"))}
      </footer>
    </div>
  `;

  zona.hidden = false;
  document.body.classList.add("imprimiendo-calendario");

  const limpiar = () => {
    zona.hidden = true;
    document.body.classList.remove("imprimiendo-calendario");
    window.removeEventListener("afterprint", limpiar);
  };

  window.addEventListener("afterprint", limpiar, { once: true });

  const imagenes = [...zona.querySelectorAll("img")];

  Promise.all(
    imagenes.map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise(resolve => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          })
    )
  ).then(() => setTimeout(() => window.print(), 100));
}

