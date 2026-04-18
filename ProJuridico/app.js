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
const camposPorTipo = {
  amparo: [
    { id: "numero_expediente", label: "Expediente", type: "text", required: true },
    { id: "estado_procesal", label: "Estado Procesal", type: "select", options: ["En Proceso","Sin Asignar","Asignado","Finalizado","Sin Actividad"], required: false },
    { id: "asunto", label: "Asunto", type: "text", required: false },
    { id: "abogado_encargado", label: "Abogado Encargado", type: "text", required: false },
    { id: "demandado", label: "Demandado", type: "text", required: false },
    { id: "juzgado", label: "Juzgado", type: "text", required: false },
    { id: "fecha_emplazamiento", label: "Fecha de Emplazamiento", type: "date", required: false }
  ],
  administrativo: [
    { id: "numero_expediente", label: "Expediente", type: "text", required: true },
    { id: "estado_procesal", label: "Estado Procesal", type: "select", options: ["En Proceso","Sin Asignar","Asignado","Finalizado","Sin Actividad"], required: false },
    { id: "asunto", label: "Asunto", type: "text", required: false },
    { id: "abogado_encargado", label: "Abogado Encargado", type: "text", required: false },
    { id: "autoridad_demandada", label: "Autoridad Demandada", type: "text", required: false },
    { id: "sala", label: "Sala", type: "text", required: false },
    { id: "fecha_emplazamiento", label: "Fecha de Emplazamiento", type: "date", required: false }
  ],
  laboral: [
    { id: "numero_expediente", label: "Expediente", type: "text", required: true },
    { id: "estado_procesal", label: "Estado Procesal", type: "select", options: ["En Proceso","Sin Asignar","Asignado","Finalizado","Sin Actividad"], required: false },
    { id: "asunto", label: "Asunto", type: "text", required: false },
    { id: "abogado_encargado", label: "Abogado Encargado", type: "text", required: false },
    { id: "actor", label: "Actor (Demandante)", type: "text", required: false },
    { id: "area_departamento", label: "Área/Departamento", type: "text", required: false },
    { id: "fecha_emplazamiento", label: "Fecha de Emplazamiento", type: "date", required: false }
  ],
  civil: [
    { id: "numero_expediente", label: "Expediente", type: "text", required: true },
    { id: "estado_procesal", label: "Estado Procesal", type: "select", options: ["En Proceso","Sin Asignar","Asignado","Finalizado","Sin Actividad"], required: false },
    { id: "asunto", label: "Asunto", type: "text", required: false },
    { id: "abogado_encargado", label: "Abogado Encargado", type: "text", required: false },
    { id: "demandado", label: "Demandado", type: "text", required: false },
    { id: "juzgado", label: "Juzgado", type: "text", required: false },
    { id: "fecha_inicio", label: "Fecha de Inicio", type: "date", required: false }
  ],
  mercantil: [
    { id: "numero_expediente", label: "Expediente", type: "text", required: true },
    { id: "estado_procesal", label: "Estado Procesal", type: "select", options: ["En Proceso","Sin Asignar","Asignado","Finalizado","Sin Actividad"], required: false },
    { id: "asunto", label: "Asunto", type: "text", required: false },
    { id: "abogado_encargado", label: "Abogado Encargado", type: "text", required: false },
    { id: "demandado", label: "Demandado", type: "text", required: false },
    { id: "juzgado", label: "Juzgado", type: "text", required: false },
    { id: "fecha_inicio", label: "Fecha de Inicio", type: "date", required: false }
  ],
  penal: [
    { id: "numero_expediente", label: "Expediente", type: "text", required: true },
    { id: "estado_procesal", label: "Estado Procesal", type: "select", options: ["En Proceso","Sin Asignar","Asignado","Finalizado","Sin Actividad"], required: false },
    { id: "asunto", label: "Delito/Asunto", type: "text", required: false },
    { id: "abogado_encargado", label: "Abogado Encargado", type: "text", required: false },
    { id: "demandado", label: "Imputado/Demandado", type: "text", required: false },
    { id: "juzgado", label: "Juzgado", type: "text", required: false },
    { id: "año", label: "Año", type: "number", required: false }
  ],
  agrario: [
    { id: "numero_expediente", label: "Expediente", type: "text", required: true },
    { id: "estado_procesal", label: "Estado Procesal", type: "select", options: ["En Proceso","Sin Asignar","Asignado","Finalizado","Sin Actividad"], required: false },
    { id: "asunto", label: "Asunto", type: "text", required: false },
    { id: "abogado_encargado", label: "Abogado Encargado", type: "text", required: false },
    { id: "demandado", label: "Demandado", type: "text", required: false },
    { id: "juzgado", label: "Juzgado", type: "text", required: false },
    { id: "fecha_emplazamiento", label: "Fecha de Emplazamiento", type: "date", required: false }
  ],
  varios: [
    { id: "numero_expediente", label: "Expediente", type: "text", required: true },
    { id: "estado_procesal", label: "Estado Procesal", type: "select", options: ["En Proceso","Sin Asignar","Asignado","Finalizado","Sin Actividad"], required: false },
    { id: "asunto", label: "Asunto General", type: "text", required: false },
    { id: "abogado_encargado", label: "Abogado Encargado", type: "text", required: false },
    { id: "actor", label: "Remitente/Actor", type: "text", required: false },
    { id: "fecha_recibido", label: "Fecha Recibido", type: "date", required: false }
  ]
};

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
  const campos = camposPorTipo[tipo] || [];
  camposRelevantesModal.innerHTML = "";

  campos.forEach(campo => {
    const fieldDiv = document.createElement("div");
    fieldDiv.className = "field";

    const label = document.createElement("label");
    label.htmlFor = campo.id;
    label.textContent = campo.label + (campo.required ? " *" : "");

    let input;
    if (campo.type === "textarea") {
      input = document.createElement("textarea");
      input.placeholder = `Ingresa ${campo.label.toLowerCase()}`;
    } else if (campo.type === "select") {
      input = document.createElement("select");
      (campo.options || []).forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else {
      input = document.createElement("input");
      input.type = campo.type;
      input.placeholder = `Ingresa ${campo.label.toLowerCase()}`;
    }

    input.id = campo.id;
    input.name = campo.id;
    input.required = campo.required;

    fieldDiv.appendChild(label);
    fieldDiv.appendChild(input);
    camposRelevantesModal.appendChild(fieldDiv);
  });
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

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cerrarModalNuevoCaso();
  }
});

if (formNuevoCaso) {
  formNuevoCaso.addEventListener("submit", async (e) => {
    e.preventDefault();

    const tipo = tipoSelectModal.value;
    const formData = new FormData(formNuevoCaso);
    const datos = Object.fromEntries(formData);

    const nuevoCase = {
      tipo: tipo,
      ...datos,
      prioridad: datos.prioridad || "Media",
      estado: datos.estado_procesal || "Pendiente",
      asignado: datos.abogado_encargado || "Sin asignar"
    };

    try {
      const response = await fetch("http://localhost:3000/api/casos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(nuevoCase)
      });

      const data = await response.json();

      if (response.ok) {
        alert("Caso creado exitosamente");
        cerrarModalNuevoCaso();
        cargarCasos(); // recarga datos frescos de la API
      } else {
        alert(data.mensaje || data.message || "Error al crear el caso");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error al conectar con el servidor");
    }
  });
}


// ========== FORMULARIO INLINE (pestaña Casos) ==========
// Mismos campos que el modal pero para el <details> de la vista de casos

function mostrarCampos() {
  const tipo = document.getElementById("tipo_caso");
  const contenedor = document.getElementById("campos_relevantes");
  if (!tipo || !contenedor) return;

  const campos = camposPorTipo[tipo.value] || [];
  contenedor.innerHTML = "";

  campos.forEach(campo => {
    const fieldDiv = document.createElement("div");
    fieldDiv.className = "field";

    const label = document.createElement("label");
    label.htmlFor = "inline_" + campo.id;
    label.textContent = campo.label + (campo.required ? " *" : "");

    let input;
    if (campo.type === "textarea") {
      input = document.createElement("textarea");
      input.placeholder = `Ingresa ${campo.label.toLowerCase()}`;
    } else if (campo.type === "select") {
      input = document.createElement("select");
      (campo.options || []).forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      });
    } else {
      input = document.createElement("input");
      input.type = campo.type;
      input.placeholder = `Ingresa ${campo.label.toLowerCase()}`;
    }

    input.id = "inline_" + campo.id;
    input.name = campo.id;
    input.required = campo.required;

    fieldDiv.appendChild(label);
    fieldDiv.appendChild(input);
    contenedor.appendChild(fieldDiv);
  });
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
    const nuevoCase = { tipo, ...datos, prioridad: datos.prioridad || "Media", estado: datos.estado_procesal || "Pendiente", asignado: datos.abogado_encargado || "Sin asignar" };

    try {
      const response = await fetch("http://localhost:3000/api/casos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoCase)
      });
      const data = await response.json();
      if (response.ok) {
        alert("Caso creado exitosamente");
        formInline.reset();
        mostrarCampos();
        const details = document.getElementById("detallesNuevoCaso");
        if (details) details.open = false;
        cargarCasos(); // recarga datos frescos de la API
      } else {
        alert(data.mensaje || data.message || "Error al crear el caso");
      }
    } catch (err) {
      console.error(err);
      alert("Error al conectar con el servidor");
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

window.addEventListener("keydown", event => {
  if (event.key === "Escape") closeDrawer();
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