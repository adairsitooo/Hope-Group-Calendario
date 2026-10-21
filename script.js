/* =========================================================
   HOPE GROUP — script.js
   Versión local: sin Supabase ni inicio de sesión.
   Guarda la información en localStorage del navegador.
   ========================================================= */
"use strict";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CLAVE_DATOS = "hopeCalendarLocalV1";
let fechaSeleccionada = new Date();
let reuniones = [];
let grupos = [];
let cumpleanos = [];
let eventos = [];
let planesMes = [];

const elemento = id => document.getElementById(id);
const escuchar = (id, tipo, callback) => elemento(id)?.addEventListener(tipo, callback);

document.addEventListener("DOMContentLoaded", iniciarAplicacion);

function iniciarAplicacion() {
  cargarLocalStorage();
  configurarSelectores();
  configurarEventos();
  actualizarTituloMes();
  renderizarTodo();
  cambiarEstadoConexion("Guardado localmente");
}

function cargarLocalStorage() {
  try {
    const guardado = localStorage.getItem(CLAVE_DATOS);
    if (!guardado) return;
    const datos = JSON.parse(guardado);
    reuniones = Array.isArray(datos.reuniones) ? datos.reuniones : [];
    grupos = Array.isArray(datos.grupos) ? datos.grupos : [];
    cumpleanos = Array.isArray(datos.cumpleanos) ? datos.cumpleanos : [];
    eventos = Array.isArray(datos.eventos) ? datos.eventos : [];
    planesMes = Array.isArray(datos.planesMes) ? datos.planesMes : [];
  } catch (error) {
    console.error("No se pudieron leer los datos locales:", error);
    mostrarAviso("avisoGeneral", "No se pudieron leer los datos guardados. No borres los datos del navegador.", "error");
  }
}

function guardarLocalStorage() {
  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify({ reuniones, grupos, cumpleanos, eventos, planesMes }));
    cambiarEstadoConexion("Cambios guardados localmente");
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los datos:", error);
    mostrarAviso("avisoGeneral", "No se pudieron guardar los cambios. Comprueba el espacio disponible del navegador.", "error");
    return false;
  }
}

function configurarEventos() {
  escuchar("mesAnterior", "click", () => moverMes(-1));
  escuchar("mesSiguiente", "click", () => moverMes(1));
  escuchar("selectorMes", "change", cambiarPeriodo);
  escuchar("selectorAnio", "change", cambiarPeriodo);
  escuchar("btnImprimir", "click", imprimirCalendario);
  escuchar("btnActualizar", "click", () => { cargarLocalStorage(); renderizarTodo(); mostrarAviso("avisoGeneral", "Información local actualizada.", "exito"); });
  escuchar("btnGestionarCumpleanos", "click", mostrarGestionCumpleanos);
  escuchar("btnGestionarReuniones", "click", mostrarGestionReuniones);
  escuchar("btnGestionarGrupos", "click", mostrarGestionGrupos);
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
      const op = document.createElement("option"); op.value = String(anio); op.textContent = String(anio); selAnio.appendChild(op);
    }
    selAnio.value = String(fechaSeleccionada.getFullYear());
  }
}
function cambiarPeriodo() {
  const mes = Number(elemento("selectorMes")?.value);
  const anio = Number(elemento("selectorAnio")?.value);
  if (!Number.isInteger(mes) || mes < 0 || mes > 11 || !Number.isInteger(anio)) return;
  fechaSeleccionada = new Date(anio, mes, 1);
  actualizarTituloMes(); renderizarTodo();
}
function moverMes(cantidad) {
  fechaSeleccionada = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth() + cantidad, 1);
  if (elemento("selectorMes")) elemento("selectorMes").value = String(fechaSeleccionada.getMonth());
  const selAnio = elemento("selectorAnio");
  if (selAnio) {
    const anio = fechaSeleccionada.getFullYear();
    if (![...selAnio.options].some(op => Number(op.value) === anio)) {
      const op = document.createElement("option"); op.value = String(anio); op.textContent = String(anio); selAnio.appendChild(op);
    }
    selAnio.value = String(anio);
  }
  actualizarTituloMes(); renderizarTodo();
}
function actualizarTituloMes() {
  if (elemento("mesActual")) elemento("mesActual").textContent = `${MESES[fechaSeleccionada.getMonth()]} ${fechaSeleccionada.getFullYear()}`;
}
function cambiarEstadoConexion(texto) { if (elemento("estadoConexion")) elemento("estadoConexion").textContent = texto; }
function mostrarAviso(id, mensaje, tipo = "info") { const n = elemento(id); if (!n) return; n.textContent = mensaje; n.className = `aviso aviso-${tipo}`; n.hidden = false; }
function ocultarAviso(id) { if (elemento(id)) elemento(id).hidden = true; }
function escaparHTML(valor) { return String(valor ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function fechaISO(fecha) { return `${fecha.getFullYear()}-${String(fecha.getMonth()+1).padStart(2,"0")}-${String(fecha.getDate()).padStart(2,"0")}`; }
function formatoFecha(fecha) { if (!fecha) return "Fecha sin definir"; const d = new Date(`${fecha}T12:00:00`); return Number.isNaN(d.getTime()) ? fecha : d.toLocaleDateString("es-GT", { day:"numeric", month:"long", year:"numeric" }); }
function obtenerDiaSemana(fecha) { return (fecha.getDay() + 6) % 7; }
function idNuevo() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function renderizarTodo() { renderizarCalendario(); renderizarCumpleanos(); const fecha = elemento("calendario")?.querySelector(".dia.seleccionado")?.dataset.fecha; renderizarDetalleDia(fecha || null); }
function actividadesFecha(fecha) {
  return [
    ...reuniones.filter(x => x.fecha === fecha).map(x => ({ categoria:"reunion", datos:x })),
    ...grupos.filter(x => x.fecha === fecha).map(x => ({ categoria:"grupo", datos:x })),
    ...eventos.filter(x => x.fecha === fecha).map(x => ({ categoria:"evento", datos:x })),
    ...cumpleanos.filter(x => x.fecha?.slice(5) === fecha.slice(5)).map(x => ({ categoria:"cumple", datos:x }))
  ];
}
function renderizarCalendario() {
  const contenedor = elemento("calendario"); if (!contenedor) return;
  contenedor.replaceChildren();
  const encabezados = document.createElement("div"); encabezados.className = "dias-semana";
  DIAS.forEach(dia => { const celda = document.createElement("div"); celda.className = "dia-semana"; celda.textContent = dia; encabezados.appendChild(celda); });
  contenedor.appendChild(encabezados);
  const cuadricula = document.createElement("div"); cuadricula.className = "dias-mes";
  const anio = fechaSeleccionada.getFullYear(), mes = fechaSeleccionada.getMonth();
  const inicio = obtenerDiaSemana(new Date(anio, mes, 1)), total = new Date(anio, mes + 1, 0).getDate();
  const seleccionada = elemento("calendario")?.querySelector(".dia.seleccionado")?.dataset.fecha || fechaISO(fechaSeleccionada);
  for (let i=0; i<inicio; i++) { const vacio = document.createElement("div"); vacio.className = "dia dia-vacio"; vacio.setAttribute("aria-hidden","true"); cuadricula.appendChild(vacio); }
  for (let numero=1; numero<=total; numero++) {
    const fecha = fechaISO(new Date(anio, mes, numero));
    const celda = document.createElement("button"); celda.type = "button"; celda.className = "dia"; celda.dataset.fecha = fecha;
    celda.setAttribute("aria-label", `${numero} de ${MESES[mes]} de ${anio}`);
    if (fecha === seleccionada) celda.classList.add("seleccionado");
    const n = document.createElement("span"); n.className = "numero-dia"; n.textContent = String(numero); celda.appendChild(n);
    const marcas = document.createElement("span"); marcas.className = "marcas-dia";
reuniones.filter(x=>x.fecha===fecha).forEach(x=>agregarMarca(marcas,"marca-reunion",x.cancelada?"Reunión (cancelada)":"Reunión"));
grupos.filter(x=>x.fecha===fecha).forEach(()=>agregarMarca(marcas,"marca-grupo","Grupo"));
    if (cumpleanos.some(x=>x.fecha?.slice(5)===fecha.slice(5))) agregarMarca(marcas,"marca-cumple","Cumpleaños");
eventos.filter(x=>x.fecha===fecha).forEach(()=>agregarMarca(marcas,"marca-evento","Evento"));
    celda.appendChild(marcas);
    celda.addEventListener("click",()=>{ contenedor.querySelectorAll(".dia.seleccionado").forEach(x=>x.classList.remove("seleccionado")); celda.classList.add("seleccionado"); renderizarDetalleDia(fecha); });
    cuadricula.appendChild(celda);
  }
  contenedor.appendChild(cuadricula);
}
function agregarMarca(contenedor, clase, titulo) { const m=document.createElement("span"); m.className=clase; m.title=titulo; m.setAttribute("aria-label",titulo); contenedor.appendChild(m); }
function renderizarDetalleDia(fecha) {
  const titulo=elemento("tituloDetalle"), detalle=elemento("detalleDia"); if(!detalle) return; detalle.replaceChildren();
  if(!fecha) { if(titulo) titulo.textContent="Selecciona una fecha"; const p=document.createElement("p"); p.className="texto-secundario"; p.textContent="Selecciona un día para consultar sus actividades."; detalle.appendChild(p); return; }
  if(titulo) titulo.textContent=formatoFecha(fecha);
  const items=actividadesFecha(fecha);
  if(!items.length) { const p=document.createElement("p"); p.className="texto-secundario"; p.textContent="No hay actividades registradas para este día."; detalle.appendChild(p); return; }
  items.forEach(({categoria,datos})=>{
    const tarjeta=document.createElement("article"); tarjeta.className=`detalle-actividad detalle-${categoria}`;
    const h=document.createElement("h4"), p=document.createElement("p");
    if(categoria==="reunion") { h.textContent=datos.cancelada?"Reunión — Cancelada":"Reunión"; p.textContent=datos.cancelada?"Esta reunión está cancelada.":`Predicador: ${datos.predicador||"Por asignar"} · Refacción: ${datos.refaccion||"Por asignar"}`; }
    if(categoria==="grupo") { h.textContent=datos.titulo||"Grupo"; p.textContent="Actividad de grupo"; }
    if(categoria==="evento") { h.textContent=datos.titulo||"Evento"; p.textContent="Evento programado"; }
    if(categoria==="cumple") { h.textContent=datos.nombre; p.textContent="Cumpleaños"; }
    tarjeta.append(h,p); detalle.appendChild(tarjeta);
  });
}
function renderizarCumpleanos() {
  const contenedor=elemento("cumpleanosMes"); if(!contenedor) return; contenedor.replaceChildren();
  const mes=fechaSeleccionada.getMonth();
  const lista=cumpleanos.filter(x=>x.fecha && new Date(`${x.fecha}T12:00:00`).getMonth()===mes).sort((a,b)=>Number(a.fecha.slice(8,10))-Number(b.fecha.slice(8,10)) || a.nombre.localeCompare(b.nombre,"es"));
  if(!lista.length) { const p=document.createElement("p"); p.className="texto-secundario"; p.textContent="No hay cumpleaños registrados este mes."; contenedor.appendChild(p); return; }
  lista.forEach(x=>{ const fila=document.createElement("article"); fila.className="cumple"; const fecha=document.createElement("span"); fecha.className="cumple-fecha"; fecha.textContent=x.fecha.slice(8,10); const nombre=document.createElement("span"); nombre.className="cumple-nombre"; nombre.textContent=x.nombre; fila.append(fecha,nombre); contenedor.appendChild(fila); });
}
function limpiarAdmin(tituloTexto) { const c=elemento("contenidoAdministracion"); if(!c) return null; c.replaceChildren(); const h=document.createElement("h3"); h.textContent=tituloTexto; c.appendChild(h); return c; }
function campoHTML(id,label,type="text",extra="") { return `<div class="campo"><label for="${id}">${label}</label><input id="${id}" type="${type}" ${extra} required></div>`; }
function crearListaAdmin(contenedor, items, descripcion, editar, borrar) {
  const lista=document.createElement("div"); lista.className="lista-administracion";
  items.forEach(item=>{ const fila=document.createElement("div"); fila.className="fila-administracion"; const info=document.createElement("div"); info.innerHTML=descripcion(item); const acciones=document.createElement("div"); acciones.className="acciones-lider"; [["Editar","boton boton-secundario",()=>editar(item)],["Eliminar","boton boton-borde",()=>borrar(item)]].forEach(([texto,clase,fn])=>{ const b=document.createElement("button"); b.type="button"; b.className=clase; b.textContent=texto; b.addEventListener("click",fn); acciones.appendChild(b); }); fila.append(info,acciones); lista.appendChild(fila); }); contenedor.appendChild(lista);
}
function fechaLimitesMes() { return {min:fechaISO(new Date(fechaSeleccionada.getFullYear(),fechaSeleccionada.getMonth(),1)),max:fechaISO(new Date(fechaSeleccionada.getFullYear(),fechaSeleccionada.getMonth()+1,0))}; }
function mostrarGestionCumpleanos() {
  const c=limpiarAdmin("Administrar cumpleaños"); if(!c)return;
  const form=document.createElement("form"); form.className="formulario"; form.innerHTML=campoHTML("cumpleNombre","Nombre completo","text",'maxlength="120"')+campoHTML("cumpleFecha","Fecha de nacimiento","date")+`<div class="campo"><label for="cumpleTelefono">Teléfono (opcional)</label><input id="cumpleTelefono" type="tel" maxlength="25"></div><button class="boton boton-principal" type="submit">Agregar cumpleaños</button>`;
form.addEventListener("submit",e=>{e.preventDefault();const nombre=elemento("cumpleNombre").value.trim(),fecha=elemento("cumpleFecha").value;if(!nombre||!fecha)return;cumpleanos.push({id:idNuevo(),nombre,fecha,telefono:elemento("cumpleTelefono").value.trim()});guardarLocalStorage();renderizarTodo();mostrarGestionCumpleanos();mostrarAviso("avisoGeneral","Cumpleaños agregado.","exito");}); c.appendChild(form);
crearListaAdmin(c,cumpleanos.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)),x=>`<strong>${escaparHTML(x.nombre)}</strong><p>${escaparHTML(formatoFecha(x.fecha))}</p>`,x=>{const nombre=prompt("Nombre completo:",x.nombre);if(nombre===null)return;const fecha=prompt("Fecha (AAAA-MM-DD):",x.fecha);if(fecha===null)return;if(!nombre.trim()||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fecha)){mostrarAviso("avisoGeneral","Revisa el nombre y la fecha.","error");return;}x.nombre=nombre.trim();x.fecha=fecha;guardarLocalStorage();renderizarTodo();mostrarGestionCumpleanos();},x=>{if(!confirm(`¿Eliminar el cumpleaños de ${x.nombre}?`))return;cumpleanos=cumpleanos.filter(p=>p.id!==x.id);guardarLocalStorage();renderizarTodo();mostrarGestionCumpleanos();});
}
function mostrarGestionReuniones() {
  const c=limpiarAdmin("Administrar reuniones"); if(!c)return; const lim=fechaLimitesMes();
  const form=document.createElement("form"); form.className="formulario"; form.innerHTML=campoHTML("reunionFecha","Fecha de reunión","date",`min="${lim.min}" max="${lim.max}"`)+`<div class="campo"><label for="reunionPredicador">Predicador (opcional)</label><input id="reunionPredicador" maxlength="120"></div><div class="campo"><label for="reunionRefaccion">Responsable de refacción (opcional)</label><input id="reunionRefaccion" maxlength="120"></div><div class="campo campo-checkbox"><label><input id="reunionCancelada" type="checkbox"> No habrá reunión</label></div><button class="boton boton-principal" type="submit">Agregar reunión</button>`;
form.addEventListener("submit",e=>{e.preventDefault();const fecha=elemento("reunionFecha").value;if(!fecha.startsWith(lim.min.slice(0,7)))return mostrarAviso("avisoGeneral","La reunión debe pertenecer al mes seleccionado.","error");reuniones.push({id:idNuevo(),fecha,predicador:elemento("reunionPredicador").value.trim(),refaccion:elemento("reunionRefaccion").value.trim(),cancelada:elemento("reunionCancelada").checked});guardarLocalStorage();renderizarTodo();mostrarGestionReuniones();mostrarAviso("avisoGeneral","Reunión guardada.","exito");}); c.appendChild(form);
crearListaAdmin(c,reuniones.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)),x=>`<strong>${escaparHTML(formatoFecha(x.fecha))} — Reunión</strong><p>${x.cancelada?"Reunión cancelada":`Predicador: ${escaparHTML(x.predicador||"Por asignar")}`}</p>${x.cancelada?"":`<p>Refacción: ${escaparHTML(x.refaccion||"Por asignar")}</p>`}`,x=>{const fecha=prompt("Fecha (AAAA-MM-DD):",x.fecha);if(fecha===null)return;const pred=prompt("Predicador:",x.predicador||"");if(pred===null)return;const ref=prompt("Responsable de refacción:",x.refaccion||"");if(ref===null)return;x.fecha=fecha;x.predicador=pred.trim();x.refaccion=ref.trim();x.cancelada=confirm("¿Marcar la reunión como cancelada? Aceptar = sí.");guardarLocalStorage();renderizarTodo();mostrarGestionReuniones();},x=>{if(!confirm(`¿Eliminar la reunión del ${formatoFecha(x.fecha)}?`))return;reuniones=reuniones.filter(r=>r.id!==x.id);guardarLocalStorage();renderizarTodo();mostrarGestionReuniones();});
}
function mostrarGestionGrupos() {
  const c=limpiarAdmin("Administrar grupos"); if(!c)return; const lim=fechaLimitesMes();
  const form=document.createElement("form"); form.className="formulario"; form.innerHTML=campoHTML("grupoTitulo","Nombre de la actividad de grupo","text",'maxlength="160"')+campoHTML("grupoFecha","Fecha","date",`min="${lim.min}" max="${lim.max}"`)+`<button class="boton boton-principal" type="submit">Agregar grupo</button>`;
form.addEventListener("submit",e=>{e.preventDefault();const titulo=elemento("grupoTitulo").value.trim(),fecha=elemento("grupoFecha").value;if(!titulo||!fecha)return;if(!fecha.startsWith(lim.min.slice(0,7)))return mostrarAviso("avisoGeneral","El grupo debe pertenecer al mes seleccionado.","error");grupos.push({id:idNuevo(),titulo,fecha});guardarLocalStorage();renderizarTodo();mostrarGestionGrupos();mostrarAviso("avisoGeneral","Grupo guardado.","exito");}); c.appendChild(form);
crearListaAdmin(c,grupos.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)),x=>`<strong>${escaparHTML(x.titulo)}</strong><p>${escaparHTML(formatoFecha(x.fecha))}</p>`,x=>{const titulo=prompt("Nombre del grupo:",x.titulo);if(titulo===null)return;const fecha=prompt("Fecha (AAAA-MM-DD):",x.fecha);if(fecha===null)return;if(!titulo.trim()||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fecha))return mostrarAviso("avisoGeneral","Revisa el nombre y la fecha.","error");x.titulo=titulo.trim();x.fecha=fecha;guardarLocalStorage();renderizarTodo();mostrarGestionGrupos();},x=>{if(!confirm(`¿Eliminar el grupo "${x.titulo}"?`))return;grupos=grupos.filter(g=>g.id!==x.id);guardarLocalStorage();renderizarTodo();mostrarGestionGrupos();});
}
function mostrarGestionEventos() {

  const c=limpiarAdmin("Administrar eventos"); if(!c)return; const lim=fechaLimitesMes();
  const form=document.createElement("form"); form.className="formulario"; form.innerHTML=campoHTML("eventoTitulo","Nombre del evento","text",'maxlength="160"')+campoHTML("eventoFecha","Fecha","date",`min="${lim.min}" max="${lim.max}"`)+`<button class="boton boton-principal" type="submit">Agregar evento</button>`;
form.addEventListener("submit",e=>{e.preventDefault();const titulo=elemento("eventoTitulo").value.trim(),fecha=elemento("eventoFecha").value;if(!titulo||!fecha)return;if(!fecha.startsWith(lim.min.slice(0,7)))return mostrarAviso("avisoGeneral","El evento debe pertenecer al mes seleccionado.","error");eventos.push({id:idNuevo(),titulo,fecha});guardarLocalStorage();renderizarTodo();mostrarGestionEventos();mostrarAviso("avisoGeneral","Evento guardado.","exito");}); c.appendChild(form);
crearListaAdmin(c,eventos.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)),x=>`<strong>${escaparHTML(x.titulo)}</strong><p>${escaparHTML(formatoFecha(x.fecha))}</p>`,x=>{const titulo=prompt("Nombre del evento:",x.titulo);if(titulo===null)return;const fecha=prompt("Fecha (AAAA-MM-DD):",x.fecha);if(fecha===null)return;if(!titulo.trim()||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(fecha))return mostrarAviso("avisoGeneral","El nombre y la fecha son obligatorios.","error");x.titulo=titulo.trim();x.fecha=fecha;guardarLocalStorage();renderizarTodo();mostrarGestionEventos();},x=>{if(!confirm(`¿Eliminar el evento "${x.titulo}"?`))return;eventos=eventos.filter(e=>e.id!==x.id);guardarLocalStorage();renderizarTodo();mostrarGestionEventos();});
}
function exportarCumpleanosCSV() {
  const filas=[["Nombre","Fecha de nacimiento","Teléfono"],...cumpleanos.map(x=>[x.nombre,x.fecha,x.telefono||""])];
  const csv=filas.map(f=>f.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
  descargarArchivo(`\uFEFF${csv}`,`cumpleanos_${fechaSeleccionada.getFullYear()}_${String(fechaSeleccionada.getMonth()+1).padStart(2,"0")}.csv`,"text/csv;charset=utf-8;");
}
function descargarArchivo(contenido,nombre,tipo) { const blob=new Blob([contenido],{type:tipo}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=nombre;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function mostrarAvisoDocumentos() {
  const c=limpiarAdmin("Respaldo de datos"); if(!c)return;
  const p=document.createElement("p");p.className="texto-secundario";p.textContent="Puedes descargar una copia de seguridad de todos los datos locales. Guarda el archivo en un lugar seguro.";
  const exportar=document.createElement("button");exportar.type="button";exportar.className="boton boton-principal";exportar.textContent="Descargar respaldo JSON";
  exportar.addEventListener("click",()=>descargarArchivo(JSON.stringify({reuniones,grupos,cumpleanos,eventos,planesMes},null,2),`hope-calendar-respaldo-${fechaISO(new Date())}.json`,"application/json"));
  const etiqueta=document.createElement("label");etiqueta.className="campo";etiqueta.textContent="Restaurar respaldo JSON";
  const input=document.createElement("input");input.type="file";input.accept="application/json,.json";
  input.addEventListener("change",async()=>{
    const archivo=input.files?.[0];if(!archivo)return;
    try {
      const datos=JSON.parse(await archivo.text());
      if(!Array.isArray(datos.reuniones)||!Array.isArray(datos.cumpleanos)||!Array.isArray(datos.eventos)||!Array.isArray(datos.grupos))throw new Error("El archivo no tiene el formato esperado.");
      if(!confirm("Restaurar reemplazará los datos locales actuales. ¿Continuar?"))return;
reuniones=datos.reuniones;grupos=datos.grupos;cumpleanos=datos.cumpleanos;eventos=datos.eventos;planesMes=Array.isArray(datos.planesMes)?datos.planesMes:[];
guardarLocalStorage();renderizarTodo();mostrarAviso("avisoGeneral","Respaldo restaurado correctamente.","exito");
    } catch(error) {
      mostrarAviso("avisoGeneral",`No se pudo restaurar el archivo: ${error.message}`,"error");
    }
  });
etiqueta.appendChild(input);c.append(p,exportar,etiqueta);
}
function imprimirCalendario() {
  const zona=elemento("zonaImpresion");if(!zona){console.error("No se encontró #zonaImpresion.");return;}
  const anio=fechaSeleccionada.getFullYear(),mes=fechaSeleccionada.getMonth(),nombreMes=`${MESES[mes]} ${anio}`,prefijo=`${anio}-${String(mes+1).padStart(2,"0")}`;
  const reunionesMes=reuniones.filter(x=>x.fecha?.startsWith(prefijo)).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const gruposMes=grupos.filter(x=>x.fecha?.startsWith(prefijo)).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const eventosMes=eventos.filter(x=>x.fecha?.startsWith(prefijo)).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const cumpleMes=cumpleanos.filter(x=>x.fecha?.slice(5,7)===String(mes+1).padStart(2,"0")).sort((a,b)=>a.fecha.slice(5,10).localeCompare(b.fecha.slice(5,10))||a.nombre.localeCompare(b.nombre,"es"));
  const plan=planesMes.find(x=>Number(x.year)===anio&&Number(x.month)===mes+1)||{};
  const inicio=obtenerDiaSemana(new Date(anio,mes,1)),total=new Date(anio,mes+1,0).getDate(),celdas=[];
  for(let i=0;i<inicio;i++)celdas.push('<div class="reporte-celda reporte-celda-vacia" aria-hidden="true"></div>');
  for(let dia=1;dia<=total;dia++){
    const fecha=fechaISO(new Date(anio,mes,dia));
    const marcas=[
      ...reunionesMes.filter(x=>x.fecha===fecha).map(x=>`<div class="reporte-marca reporte-marca-reunion">Reunión${x.cancelada?" — Cancelada":""}</div>`),
      ...gruposMes.filter(x=>x.fecha===fecha).map(x=>`<div class="reporte-marca reporte-marca-grupo">${escaparHTML(x.titulo)}</div>`),
      ...eventosMes.filter(x=>x.fecha===fecha).map(x=>`<div class="reporte-marca reporte-marca-evento">${escaparHTML(x.titulo)}</div>`),
      ...cumpleMes.filter(x=>x.fecha.slice(5,10)===fecha.slice(5)).map(x=>`<div class="reporte-marca reporte-marca-cumple">Cumpleaños: ${escaparHTML(x.nombre)}</div>`)
    ].join("");
    celdas.push(`<div class="reporte-celda"><span class="reporte-numero-dia">${dia}</span><div class="reporte-marcas">${marcas}</div></div>`);
  }
  while(celdas.length%7!==0)celdas.push('<div class="reporte-celda reporte-celda-vacia" aria-hidden="true"></div>');
  const actividades=[
    ...reunionesMes.map(x=>({fecha:x.fecha,tipo:"reunion",datos:x})),
    ...gruposMes.map(x=>({fecha:x.fecha,tipo:"grupo",datos:x})),
    ...eventosMes.map(x=>({fecha:x.fecha,tipo:"evento",datos:x}))
  ].sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.tipo.localeCompare(b.tipo));
  const htmlActividades=actividades.length?actividades.map(x=>{
    const d=x.datos;let titulo="",detalle="";
    if(x.tipo==="reunion"){titulo=`Reunión${d.cancelada?" — Cancelada":""}`;detalle=d.cancelada?"Esta reunión está cancelada.":`<p><strong>Predicador:</strong> ${escaparHTML(d.predicador||"Por asignar")}</p><p><strong>Responsable de refacción:</strong> ${escaparHTML(d.refaccion||"Por asignar")}</p>`;}
    if(x.tipo==="grupo"){titulo=d.titulo||"Grupo";detalle="Actividad de grupo";}
    if(x.tipo==="evento"){titulo=d.titulo||"Evento";detalle="";}
    return `<article class="reporte-actividad"><div class="reporte-fecha">${escaparHTML(formatoFecha(x.fecha))}</div><div class="reporte-actividad-contenido"><h3>${escaparHTML(titulo)}</h3>${detalle}</div></article>`;
  }).join(""):'<p class="reporte-vacio">No hay actividades registradas para este mes.</p>';
  const htmlCumple=cumpleMes.length?`<ul class="reporte-lista-cumpleanos">${cumpleMes.map(x=>`<li><span class="reporte-cumple-fecha">${escaparHTML(new Date(`${anio}-${String(mes+1).padStart(2,"0")}-${x.fecha.slice(8,10)}T12:00:00`).toLocaleDateString("es-GT",{day:"numeric",month:"long"}))}</span><span>${escaparHTML(x.nombre)}</span></li>`).join("")}</ul>`:'<p class="reporte-vacio">No hay cumpleaños registrados para este mes.</p>';
  zona.innerHTML=`<div class="reporte-mensual"><header class="reporte-encabezado"><div class="reporte-marca-institucional"><img class="reporte-logo" src="recursos/logo.PNG" alt="Logo de Hope Group" onerror="this.style.display='none'"><div><h1>Hope Group</h1><p class="reporte-subtitulo">Calendario y organización</p></div></div><h2>Calendario mensual — ${escaparHTML(nombreMes)}</h2>${plan.theme?`<p><strong>Tema del mes:</strong> ${escaparHTML(plan.theme)}</p>`:""}${plan.bible_verse?`<p><strong>Versículo:</strong> ${escaparHTML(plan.bible_verse)}</p>`:""}</header><section class="reporte-seccion reporte-seccion-calendario"><h2>Calendario del mes</h2><div class="reporte-calendario"><div class="reporte-dias-semana">${DIAS.map(x=>`<div>${x}</div>`).join("")}</div><div class="reporte-cuadricula">${celdas.join("")}</div></div><div class="reporte-leyenda"><span>Reunión</span><span>Grupo</span><span>Eventos</span><span>Cumpleaños</span></div></section><section class="reporte-seccion"><h2>Actividades del mes</h2><div class="reporte-lista-actividades">${htmlActividades}</div></section><section class="reporte-seccion"><h2>Cumpleañeros del mes</h2>${htmlCumple}</section><footer class="reporte-pie">Hope Group · Documento generado el ${escaparHTML(new Date().toLocaleDateString("es-GT"))}</footer></div>`;
zona.hidden=false;document.body.classList.add("imprimiendo-calendario");
  const limpiar=()=>{zona.hidden=true;document.body.classList.remove("imprimiendo-calendario");window.removeEventListener("afterprint",limpiar);};
  window.addEventListener("afterprint",limpiar,{once:true});
  const imgs=[...zona.querySelectorAll("img")];Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener("load",resolve,{once:true});img.addEventListener("error",resolve,{once:true});}))).then(()=>setTimeout(()=>window.print(),100));


