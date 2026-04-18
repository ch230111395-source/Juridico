const usuarioGuardado = localStorage.getItem("usuario");

if (!usuarioGuardado) {
  window.location.href = "index.html";
}

const buttons = document.querySelectorAll(".nav button[data-view]");
const views = document.querySelectorAll(".view");
const tipoSelect = document.getElementById("tipoCasoSelect");
const tbody = document.getElementById("casosTbody");
const mask = document.getElementById("drawerMask");
const closeBtn = document.getElementById("btnCerrarDrawer");
const btnUsuarioForm = document.getElementById("btnUsuarioForm");
const usuarioDetails = document.getElementById("usuarioDetails");
const btnRolForm = document.getElementById("btnRolForm");
const permDetails = document.getElementById("permDetails");
const btnLogout = document.getElementById("btnLogout");

// ========== VARIABLES PARA MODAL ==========
const btnNuevoGlobal = document.getElementById("btnNuevoGlobal");
const modalNuevoCaso = document.getElementById("modalNuevoCaso");
const modalMask = document.getElementById("modalMask");
const formNuevoCaso = document.getElementById("formNuevoCasoModal");
const btnCancelarModal = document.getElementById("btnCancelarModal");
const btnCloseModal = document.getElementById("btnCloseModal");
const tipoSelectModal = document.getElementById("tipoSelectModal");
const camposRelevantesModal = document.getElementById("camposRelevantesModal");

const presets = {
  Mercantil: { prioridad: "Alta", estado: "En proceso", asignado: "Abg. A" },
  Amparo: { prioridad: "Media", estado: "Pendiente", asignado: "Abg. B" },
  Laboral: { prioridad: "Alta", estado: "Revisión", asignado: "Por reasignar" },
  Civil: { prioridad: "Media", estado: "En proceso", asignado: "Abg. C" },
  Penal: { prioridad: "Alta", estado: "Pendiente", asignado: "Abg. D" },
  Administrativo: { prioridad: "Media", estado: "En proceso", asignado: "Abg. E" },
  Agrario: { prioridad: "Media", estado: "Pendiente", asignado: "Abg. F" },
  Todos: { prioridad: "(auto)", estado: "(auto)", asignado: "(auto)" }
};

let casos = [];

// Normaliza los datos que vienen de la BD al formato visual esperado
function normalizarCaso(raw) {
  // Capitaliza primera letra (ej: "mercantil" → "Mercantil")
  const capitalizar = str => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  // Mapeo de prioridades: convierte valores de BD a formato visual
  const mapPrioridad = val => {
    if (!val) return "Media";
    const v = val.toLowerCase();
    if (v === "alta" || v === "high") return "Alta";
    if (v === "media" || v === "medium") return "Media";
    if (v === "baja" || v === "low") return "Baja";
    return capitalizar(val);
  };

  // Mapeo de estados: convierte snake_case o variantes a formato visual
  const mapEstado = val => {
    if (!val) return "Pendiente";
    // Normalizar: minúsculas y sin guiones bajos para comparar
    const v = val.toLowerCase().replace(/_/g, " ").trim();
    if (v === "en proceso")  return "En proceso";
    if (v === "pendiente")   return "Pendiente";
    if (v === "revision" || v === "revisión") return "Revisión";
    if (v === "cerrado" || v === "closed")    return "Cerrado";
    if (v === "sin asignar") return "Sin asignar";
    if (v === "activo" || v === "active")     return "Activo";
    // Cualquier otro: reemplaza _ por espacio y capitaliza cada palabra
    return val.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  // Mapeo de asignado: convierte snake_case a texto legible
  const mapAsignado = val => {
    if (!val) return "Sin asignar";
    const v = val.toLowerCase().replace(/_/g, " ").trim();
    if (v === "sin asignar" || v === "por asignar" || v === "por reasignar" || v === "sin asignar") {
      return val.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
    return val;
  };

  // Mapeo de tipo: normaliza plural/singular y capitaliza
  // "penales" → "Penal", "mercantil" → "Mercantil", etc.
  const mapTipo = val => {
    if (!val) return "";
    const v = val.toLowerCase().trim();
    const tipoMap = {
      "penales":        "Penal",
      "penal":          "Penal",
      "mercantiles":    "Mercantil",
      "mercantil":      "Mercantil",
      "amparos":        "Amparo",
      "amparo":         "Amparo",
      "laborales":      "Laboral",
      "laboral":        "Laboral",
      "civiles":        "Civil",
      "civil":          "Civil",
      "administrativos":"Administrativo",
      "administrativo": "Administrativo",
      "agrarios":       "Agrario",
      "agrario":        "Agrario",
      "varios":         "Varios"
    };
    return tipoMap[v] || capitalizar(val);
  };

  return {
    // Reconstruye el ID visual: "PENAL-3" a partir del tipo y el id numérico de MySQL
    id: (() => {
      const num  = raw.id || raw._id || raw.caso_id || "";
      const tipo = (raw.tipo || raw.tipo_caso || "").toUpperCase().replace(/ES$/, "").replace(/S$/, "").trim();
      return tipo ? `${tipo}-${num}` : String(num);
    })(),
    nombre:   raw.nombre || raw.asunto || raw.nombre_caso || "",
    tipo:     mapTipo(raw.tipo || raw.tipo_caso || ""),
    prioridad: mapPrioridad(raw.prioridad),
    estado:   mapEstado(raw.estado),
    asignado: mapAsignado(raw.asignado || raw.abogado_asignado || ""),
    // Guardamos el raw completo por si el drawer necesita más campos
    _raw: raw
  };
}

async function cargarCasos() {
  try {
    const response = await fetch("http://localhost:3000/api/casos");
    if (!response.ok) throw new Error("Error al obtener casos");
    const data = await response.json();
    // La API puede devolver el array directo o envuelto en { casos: [...] } o { data: [...] }
    const lista = Array.isArray(data) ? data : (data.casos || data.data || []);
    casos = lista.map(normalizarCaso);
  } catch (err) {
    console.error("No se pudieron cargar los casos:", err);
    casos = [];
  }
  renderTable();
  if (tipoSelect) applyPreset(tipoSelect.value);
}

// ========== CAMPOS POR TIPO ==========
// Nombres de campos y valores exactos del backend (tomados del dashboard original)
const camposPorTipo = {
  amparo: [
    { name: "expediente",        label: "Expediente",              type: "text"   },
    { name: "estado_procesal",   label: "Estado procesal",         type: "select",
      options: [["en_proceso","En Proceso"],["sin_asignar","Sin Asignar"],["asignado","Asignado"],["finalizado","Finalizado"],["sin_actividad","Sin Actividad"]] },
    { name: "asunto",            label: "Asunto",                  type: "text"   },
    { name: "fecha_emplazamiento",label:"Fecha de emplazamiento",  type: "date"   },
    { name: "abogado_encargado", label: "Abogado encargado",       type: "text"   },
    { name: "actor",             label: "Actor",                   type: "text"   },
    { name: "demandado",         label: "Demandado",               type: "text"   },
    { name: "juzgado",           label: "Juzgado",                 type: "text"   }
  ],
  administrativo: [
    { name: "expediente",        label: "Expediente",              type: "text"   },
    { name: "estado_procesal",   label: "Estado procesal",         type: "select",
      options: [["en_proceso","En Proceso"],["sin_asignar","Sin Asignar"],["asignado","Asignado"],["finalizado","Finalizado"],["sin_actividad","Sin Actividad"]] },
    { name: "asunto",            label: "Asunto",                  type: "text"   },
    { name: "fecha_emplazamiento",label:"Fecha de emplazamiento",  type: "date"   },
    { name: "sala",              label: "Sala",                    type: "text"   },
    { name: "actor",             label: "Actor",                   type: "text"   }
  ],
  laboral: [
    { name: "expediente",        label: "Expediente",              type: "text"   },
    { name: "estado_procesal",   label: "Estado procesal",         type: "select",
      options: [["en_proceso","En Proceso"],["sin_asignar","Sin Asignar"],["asignado","Asignado"],["finalizado","Finalizado"],["sin_actividad","Sin Actividad"]] },
    { name: "actor",             label: "Actor",                   type: "text"   },
    { name: "fecha_emplazamiento",label:"Fecha de emplazamiento",  type: "date"   },
    { name: "mesa",              label: "Mesa",                    type: "text"   },
    { name: "numero",            label: "Número",                  type: "text"   }
  ],
  civil: [
    { name: "expediente",        label: "Expediente",              type: "text"   },
    { name: "estado_procesal",   label: "Estado procesal",         type: "select",
      options: [["en_proceso","En Proceso"],["sin_asignar","Sin Asignar"],["asignado","Asignado"],["finalizado","Finalizado"],["sin_actividad","Sin Actividad"]] },
    { name: "asunto",            label: "Asunto",                  type: "text"   },
    { name: "fecha_emplazamiento",label:"Fecha de inicio",         type: "date"   },
    { name: "juzgado",           label: "Juzgado",                 type: "text"   },
    { name: "actor",             label: "Actor",                   type: "text"   },
    { name: "demandado",         label: "Demandado",               type: "text"   }
  ],
  mercantil: [
    { name: "expediente",        label: "Expediente",              type: "text"   },
    { name: "estado_procesal",   label: "Estado procesal",         type: "select",
      options: [["en_proceso","En Proceso"],["sin_asignar","Sin Asignar"],["asignado","Asignado"],["finalizado","Finalizado"],["sin_actividad","Sin Actividad"]] },
    { name: "asunto",            label: "Asunto",                  type: "text"   },
    { name: "fecha_emplazamiento",label:"Fecha",                   type: "date"   },
    { name: "juzgado",           label: "Juzgado",                 type: "text"   },
    { name: "actor",             label: "Actor",                   type: "text"   }
  ],
  penal: [
    { name: "expediente",        label: "Expediente",              type: "text"   },
    { name: "estado_procesal",   label: "Estado procesal",         type: "select",
      options: [["en_proceso","En Proceso"],["sin_asignar","Sin Asignar"],["asignado","Asignado"],["finalizado","Finalizado"],["sin_actividad","Sin Actividad"]] },
    { name: "asunto",            label: "Asunto",                  type: "text"   },
    { name: "juzgado",           label: "Juzgado",                 type: "text"   },
    { name: "actor",             label: "Actor",                   type: "text"   },
    { name: "demandado",         label: "Demandado",               type: "text"   }
  ],
  agrario: [
    { name: "expediente",        label: "Expediente",              type: "text"   },
    { name: "estado_procesal",   label: "Estado procesal",         type: "select",
      options: [["en_proceso","En Proceso"],["sin_asignar","Sin Asignar"],["asignado","Asignado"],["finalizado","Finalizado"],["sin_actividad","Sin Actividad"]] },
    { name: "asunto",            label: "Asunto",                  type: "text"   },
    { name: "fecha_emplazamiento",label:"Fecha de emplazamiento",  type: "date"   },
    { name: "actor",             label: "Actor",                   type: "text"   }
  ],
  varios: [
    { name: "expediente",        label: "Expediente",              type: "text"   },
    { name: "estado_procesal",   label: "Estado procesal",         type: "select",
      options: [["en_proceso","En Proceso"],["sin_asignar","Sin Asignar"],["asignado","Asignado"],["finalizado","Finalizado"],["sin_actividad","Sin Actividad"]] },
    { name: "asunto",            label: "Asunto",                  type: "text"   },
    { name: "fecha_emplazamiento",label:"Fecha recibido",          type: "date"   }
  ]
};

// Renderiza campos en cualquier contenedor, usando name= como atributo
function renderCampos(campos, contenedor, idPrefix = "") {
  contenedor.innerHTML = "";
  campos.forEach(campo => {
    const div = document.createElement("div");
    div.className = "field";

    const label = document.createElement("label");
    label.textContent = campo.label;

    let el;
    if (campo.type === "select") {
      el = document.createElement("select");
      campo.options.forEach(([val, txt]) => {
        const o = document.createElement("option");
        o.value = val;
        o.textContent = txt;
        el.appendChild(o);
      });
    } else {
      el = document.createElement("input");
      el.type = campo.type;
    }
    el.name = campo.name;
    if (idPrefix) el.id = idPrefix + campo.name;

    div.appendChild(label);
    div.appendChild(el);
    contenedor.appendChild(div);
  });
}

// ========== FUNCIONES PARA MODAL ==========

function abrirModalNuevoCaso() {
  if (!modalMask || !modalNuevoCaso) return;
  modalMask.classList.add("show");
  modalNuevoCaso.classList.add("show");
  mostrarCamposModal("amparo");
}

function cerrarModalNuevoCaso() {
  if (!modalMask || !modalNuevoCaso) return;
  modalMask.classList.remove("show");
  modalNuevoCaso.classList.remove("show");
  if (formNuevoCaso) formNuevoCaso.reset();
  if (camposRelevantesModal) camposRelevantesModal.innerHTML = "";
}

function mostrarCamposModal(tipo) {
  if (!camposRelevantesModal) return;
  renderCampos(camposPorTipo[tipo] || [], camposRelevantesModal);
}

// ========== EVENTOS PARA MODAL ==========

if (btnNuevoGlobal) {
  btnNuevoGlobal.addEventListener("click", abrirModalNuevoCaso);
}

if (tipoSelectModal) {
  tipoSelectModal.addEventListener("change", (e) => {
    mostrarCamposModal(e.target.value);
  });
}

if (btnCancelarModal) {
  btnCancelarModal.addEventListener("click", cerrarModalNuevoCaso);
}

if (btnCloseModal) {
  btnCloseModal.addEventListener("click", cerrarModalNuevoCaso);
}

if (modalMask) {
  modalMask.addEventListener("click", (e) => {
    if (e.target === modalMask) {
      cerrarModalNuevoCaso();
    }
  });
}

// keydown unificado abajo

if (formNuevoCaso) {
  formNuevoCaso.addEventListener("submit", async (e) => {
    e.preventDefault();

    const tipo = tipoSelectModal.value;
    const formData = new FormData(formNuevoCaso);
    const datos = Object.fromEntries(formData);

    // Payload con nombres exactos que espera el backend
    const nuevoCase = { tipo_caso: tipo, ...datos };

    try {
      const res = await fetch("http://localhost:3000/api/nuevocaso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoCase)
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ Caso guardado con ID: " + result.id);
        cerrarModalNuevoCaso();
        cargarCasos();
      } else {
        alert("❌ Error: " + (result.mensaje || "No se pudo guardar el caso"));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("❌ No se pudo conectar con el servidor. ¿Está corriendo en puerto 3000?");
    }
  });
}


// ========== FORMULARIO INLINE (pestaña Casos) ==========
// Mismos campos que el modal pero para el <details> de la vista de casos

function mostrarCampos() {
  const tipoEl = document.getElementById("tipo_caso");
  const contenedor = document.getElementById("campos_relevantes");
  if (!tipoEl || !contenedor) return;
  renderCampos(camposPorTipo[tipoEl.value] || [], contenedor);
}

// Inicializar campos del formulario inline al cargar
document.addEventListener("DOMContentLoaded", () => {
  mostrarCampos();
});

// Botón cancelar del formulario inline
const btnCancelarForm = document.getElementById("btnCancelarForm");
if (btnCancelarForm) {
  btnCancelarForm.addEventListener("click", () => {
    const details = document.getElementById("detallesNuevoCaso");
    if (details) details.open = false;
  });
}

// Submit del formulario inline
const formInline = document.getElementById("formNuevoCaso");
if (formInline) {
  formInline.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tipo = document.getElementById("tipo_caso").value;
    const formData = new FormData(formInline);
    const datos = Object.fromEntries(formData);
    // Payload con nombres exactos que espera el backend
    const nuevoCase = { tipo_caso: tipo, ...datos };

    try {
      const res = await fetch("http://localhost:3000/api/nuevocaso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoCase)
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ Caso guardado con ID: " + result.id);
        formInline.reset();
        mostrarCampos();
        const details = document.getElementById("detallesNuevoCaso");
        if (details) details.open = false;
        cargarCasos();
      } else {
        alert("❌ Error: " + (result.mensaje || "No se pudo guardar el caso"));
      }
    } catch (err) {
      console.error(err);
      alert("❌ No se pudo conectar con el servidor. ¿Está corriendo en puerto 3000?");
    }
  });
}

// ========== EVENTOS ORIGINALES ==========

buttons.forEach(button => {
  button.addEventListener("click", () => {
    const vista = button.dataset.view;

    buttons.forEach(item => item.classList.remove("active"));
    button.classList.add("active");

    views.forEach(view => {
      view.classList.toggle("active", view.id === vista);
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

function renderTable() {
  if (!tipoSelect || !tbody) return;

  const tipo = tipoSelect.value;
  const rows = casos.filter(caso => tipo === "Todos" || caso.tipo === tipo);

  // Clases de color para prioridad (igual al diseño original)
  const prioClase = {
    "Alta":  "tag tag--alta",
    "Media": "tag tag--media",
    "Baja":  "tag tag--baja"
  };

  tbody.innerHTML = rows.map(caso => `
    <tr data-id="${caso.id}">
      <td><span class="tag">${caso.id}</span></td>
      <td>${caso.nombre}</td>
      <td class="muted">${caso.tipo}</td>
      <td><span class="${prioClase[caso.prioridad] || "tag"}">${caso.prioridad}</span></td>
      <td>${caso.estado}</td>
      <td class="muted">${caso.asignado}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(row => {
    row.addEventListener("dblclick", () => {
      const item = casos.find(caso => String(caso.id) === String(row.dataset.id));
      openDrawer(item);
    });
  });
}

function applyPreset(tipo) {
  const preset = presets[tipo] || presets.Todos;

  const elTipo = document.getElementById("pref_tipo");
  const elPrioridad = document.getElementById("pref_prioridad");
  const elEstado = document.getElementById("pref_estado");
  const elAsignado = document.getElementById("pref_asignado");
  if (!elTipo || !elPrioridad || !elEstado || !elAsignado) return;
  elTipo.textContent = tipo === "Todos" ? "(selecciona un tipo)" : tipo;
  elPrioridad.textContent = preset.prioridad;
  elEstado.textContent = preset.estado;
  elAsignado.textContent = preset.asignado;
}

function openDrawer(item) {
  if (!item) return;

  // Guardar el id numérico real para las llamadas a la API de notas
  casoActivoId = item._raw ? (item._raw.id || item._raw._id || item._raw.caso_id) : item.id;

  document.getElementById("drawerTitle").textContent = item.id;
  document.getElementById("drawerSubtitle").textContent = `· ${item.tipo}`;
  document.getElementById("d_tipo").textContent = item.tipo;
  document.getElementById("d_prioridad").textContent = item.prioridad;
  document.getElementById("d_estado").textContent = item.estado;
  document.getElementById("d_asignado").textContent = item.asignado;

  // Limpiar nota anterior y cargar notas del caso
  if (inputNuevaNota) inputNuevaNota.value = "";
  cargarNotas(casoActivoId);
  cargarDocumentos(casoActivoId);
  iniciarEventosUpload();

  mask.classList.add("show");
}

function closeDrawer() {
  mask.classList.remove("show");
}

if (tipoSelect) {
  tipoSelect.addEventListener("change", () => {
    renderTable();
    applyPreset(tipoSelect.value);
  });
}

if (closeBtn) {
  closeBtn.addEventListener("click", closeDrawer);
}

if (mask) {
  mask.addEventListener("click", event => {
    if (event.target === mask) closeDrawer();
  });
}

window.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  // Cierra primero el modal si está abierto, sino el drawer
  if (modalMask && modalMask.classList.contains("show")) {
    cerrarModalNuevoCaso();
  } else {
    closeDrawer();
  }
});

if (btnUsuarioForm && usuarioDetails) {
  btnUsuarioForm.addEventListener("click", () => {
    usuarioDetails.open = true;
    usuarioDetails.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (btnRolForm && permDetails) {
  btnRolForm.addEventListener("click", () => {
    permDetails.open = true;
    permDetails.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (btnLogout) {
  btnLogout.addEventListener("click", () => {
    const confirmar = confirm("¿Deseas cerrar sesión?");
    if (!confirmar) return;
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

// ========== NOTAS DEL CASO ==========

let casoActivoId = null;

const btnGuardarNota = document.getElementById("btnGuardarNota");
const btnLimpiarNota = document.getElementById("btnLimpiarNota");
const inputNuevaNota = document.getElementById("inputNuevaNota");
const listaNotas = document.getElementById("listaNotas");

function renderNotas(notas) {
  if (!listaNotas) return;
  if (!notas || notas.length === 0) {
    listaNotas.innerHTML = '<div class="small muted">Sin notas registradas.</div>';
    return;
  }
  listaNotas.innerHTML = notas.map(n => `
    <div class="nota-item card" style="box-shadow:none; padding: 12px 14px;">
      <div class="small muted">${n.fecha || ""} · ${n.usuario || "Sistema"}</div>
      <div style="margin-top:4px;">${n.texto || n.nota || n.contenido || ""}</div>
    </div>
  `).join("");
}

async function cargarNotas(casoId) {
  if (!listaNotas) return;
  listaNotas.innerHTML = '<div class="small muted">Cargando notas...</div>';
  try {
    const res = await fetch(`http://localhost:3000/api/casos/${casoId}/notas`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const notas = Array.isArray(data) ? data : (data.notas || data.data || []);
    renderNotas(notas);
  } catch {
    listaNotas.innerHTML = '<div class="small muted">No se pudieron cargar las notas.</div>';
  }
}

if (btnGuardarNota) {
  btnGuardarNota.addEventListener("click", async () => {
    if (!casoActivoId || !inputNuevaNota) return;
    const texto = inputNuevaNota.value.trim();
    if (!texto) return;

    try {
      const res = await fetch(`http://localhost:3000/api/casos/${casoActivoId}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto })
      });
      if (res.ok) {
        inputNuevaNota.value = "";
        cargarNotas(casoActivoId);
      } else {
        alert("Error al guardar la nota");
      }
    } catch {
      alert("Error al conectar con el servidor");
    }
  });
}

if (btnLimpiarNota) {
  btnLimpiarNota.addEventListener("click", () => {
    if (inputNuevaNota) inputNuevaNota.value = "";
  });
}

// Carga los casos desde la API y luego renderiza la tabla
cargarCasos();

// ========== DOCUMENTOS DEL CASO ==========

let listaDocumentos    = document.getElementById("listaDocumentos");
let zonaUpload         = document.getElementById("zonaUpload");
let inputArchivo       = document.getElementById("inputArchivo");
let btnSeleccionarArch = document.getElementById("btnSeleccionarArchivo");
let uploadProgress     = document.getElementById("uploadProgress");
let uploadBar          = document.getElementById("uploadBar");
let uploadStatus       = document.getElementById("uploadStatus");

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function iconoArchivo(nombre) {
  const ext = (nombre || "").split(".").pop().toLowerCase();
  return ({ pdf:"📄", doc:"📝", docx:"📝", jpg:"🖼️", jpeg:"🖼️",
            png:"🖼️", xlsx:"📊", xls:"📊" })[ext] || "📎";
}

function renderDocumentos(docs) {
  // Re-obtener por si el drawer se reconstruyó en el DOM
  listaDocumentos = document.getElementById("listaDocumentos");
  if (!listaDocumentos) return;

  if (!docs || docs.length === 0) {
    listaDocumentos.innerHTML = '<div class="small muted">Sin documentos adjuntos.</div>';
    return;
  }

  listaDocumentos.innerHTML = docs.map(doc => `
    <div style="display:flex; align-items:center; gap:10px; padding:10px 12px;
                border:1px solid var(--line); border-radius:10px; background:var(--panel);">
      <span style="font-size:20px;">${iconoArchivo(doc.nombre_original)}</span>
      <div style="flex:1; min-width:0;">
        <div style="font-size:13px; font-weight:600; white-space:nowrap;
                    overflow:hidden; text-overflow:ellipsis;"
             title="${doc.nombre_original}">
          ${doc.nombre_original}
        </div>
        <div class="small muted">
          ${formatBytes(doc.tamaño)} · ${doc.subido_por || "Sistema"} · ${doc.fecha || ""}
        </div>
      </div>
      <button class="btn"
              style="padding:6px 12px; font-size:12px;"
              onclick="descargarDocumento(${doc.id}, '${doc.nombre_original.replace(/'/g,"\'")}')">
        ⬇ Descargar
      </button>
      <button class="btn"
              style="padding:6px 12px; font-size:12px; color:#dc2626; border-color:#fecaca;"
              onclick="eliminarDocumento(${doc.id})">
        🗑
      </button>
    </div>
  `).join("");
}

// Descarga usando fetch → no navega y no cierra el drawer
async function descargarDocumento(docId, nombre) {
  try {
    const res  = await fetch(`http://localhost:3000/api/documentos/descargar/${docId}`);
    if (!res.ok) { alert("No se pudo descargar el archivo."); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    alert("Error al descargar el archivo.");
  }
}

// Elimina un documento previa confirmación
async function eliminarDocumento(docId) {
  if (!confirm("¿Eliminar este documento? Esta acción no se puede deshacer.")) return;
  try {
    const res  = await fetch(`http://localhost:3000/api/documentos/${docId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      cargarDocumentos(casoActivoId);
    } else {
      alert("Error al eliminar: " + (data.mensaje || ""));
    }
  } catch {
    alert("Error al conectar con el servidor.");
  }
}

async function cargarDocumentos(casoId) {
  listaDocumentos = document.getElementById("listaDocumentos");
  if (!listaDocumentos) return;
  listaDocumentos.innerHTML = '<div class="small muted">Cargando documentos...</div>';
  try {
    const res  = await fetch(`http://localhost:3000/api/documentos/${casoId}`);
    const data = await res.json();
    const docs = Array.isArray(data) ? data : (data.documentos || data.data || []);
    renderDocumentos(docs);
  } catch {
    listaDocumentos.innerHTML = '<div class="small muted">No se pudieron cargar los documentos.</div>';
  }
}

async function subirArchivos(archivos) {
  if (!archivos || archivos.length === 0 || !casoActivoId) return;

  uploadProgress = document.getElementById("uploadProgress");
  uploadBar      = document.getElementById("uploadBar");
  uploadStatus   = document.getElementById("uploadStatus");

  if (uploadProgress) uploadProgress.style.display = "block";
  if (uploadBar)      uploadBar.style.width = "0%";
  if (uploadStatus)   uploadStatus.textContent = `Subiendo 0 de ${archivos.length}...`;

  const usr = JSON.parse(localStorage.getItem("usuario") || "{}");
  let subidos = 0;

  for (const archivo of archivos) {
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("subido_por", usr.username || usr.nombre || "Usuario");

    try {
      const res  = await fetch(`http://localhost:3000/api/documentos/${casoActivoId}`, {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (!data.success) alert("Error al subir " + archivo.name + ": " + (data.mensaje || ""));
    } catch {
      alert("Error de conexión al subir " + archivo.name);
    }

    subidos++;
    const pct = Math.round((subidos / archivos.length) * 100);
    if (uploadBar)    uploadBar.style.width = pct + "%";
    if (uploadStatus) uploadStatus.textContent = `Subiendo ${subidos} de ${archivos.length}...`;
  }

  setTimeout(() => {
    if (uploadProgress) uploadProgress.style.display = "none";
  }, 800);
  inputArchivo = document.getElementById("inputArchivo");
  if (inputArchivo) inputArchivo.value = "";
  cargarDocumentos(casoActivoId);
}

// Inicializar eventos de la zona de upload
// (se llama también cada vez que se abre el drawer)
function iniciarEventosUpload() {
  zonaUpload         = document.getElementById("zonaUpload");
  inputArchivo       = document.getElementById("inputArchivo");
  btnSeleccionarArch = document.getElementById("btnSeleccionarArchivo");

  if (btnSeleccionarArch) {
    btnSeleccionarArch.onclick = () => { if (inputArchivo) inputArchivo.click(); };
  }
  if (inputArchivo) {
    inputArchivo.onchange = () => {
      if (inputArchivo.files.length > 0) subirArchivos(inputArchivo.files);
    };
  }
  if (zonaUpload) {
    zonaUpload.ondragover  = e => {
      e.preventDefault();
      zonaUpload.style.borderColor = "var(--primary)";
      zonaUpload.style.background  = "var(--chip)";
    };
    zonaUpload.ondragleave = () => {
      zonaUpload.style.borderColor = "var(--line)";
      zonaUpload.style.background  = "";
    };
    zonaUpload.ondrop = e => {
      e.preventDefault();
      zonaUpload.style.borderColor = "var(--line)";
      zonaUpload.style.background  = "";
      if (e.dataTransfer.files.length > 0) subirArchivos(e.dataTransfer.files);
    };
  }
}