const usuarioGuardado = localStorage.getItem("usuario");

if (!usuarioGuardado) {
  window.location.href = "index.html";
}

// ← AGREGADO: rol de sesión global
const usuarioSesion = JSON.parse(usuarioGuardado || "{}");
const sessionRol = usuarioSesion.rol || "";

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
function normalizarCaso(raw) {
  const capitalizar = str => str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : "";

  const mapPrioridad = val => {
    if (!val) return "Media";
    const v = val.toLowerCase();
    if (v === "alta" || v === "high") return "Alta";
    if (v === "media" || v === "medium") return "Media";
    if (v === "baja" || v === "low") return "Baja";
    return capitalizar(val);
  };

  const mapEstado = val => {
    if (!val) return "Pendiente";
    const v = val.toLowerCase().replace(/_/g, " ").trim();
    if (v === "en proceso") return "En proceso";
    if (v === "pendiente") return "Pendiente";
    if (v === "revision" || v === "revisión") return "Revisión";
    if (v === "cerrado" || v === "closed") return "Cerrado";
    if (v === "sin asignar") return "Sin asignar";
    if (v === "activo" || v === "active") return "Activo";
    return val.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const mapAsignado = val => {
    if (!val) return "Sin asignar";
    const v = val.toLowerCase().replace(/_/g, " ").trim();
    if (v === "sin asignar" || v === "por asignar" || v === "por reasignar" || v === "sin asignar") {
      return val.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
    return val;
  };

  const mapTipo = val => {
    if (!val) return "";
    const v = val.toLowerCase().trim();
    const tipoMap = {
      "penales": "Penal", "penal": "Penal",
      "mercantiles": "Mercantil", "mercantil": "Mercantil",
      "amparos": "Amparo", "amparo": "Amparo",
      "laborales": "Laboral", "laboral": "Laboral",
      "civiles": "Civil", "civil": "Civil",
      "administrativos": "Administrativo", "administrativo": "Administrativo",
      "agrarios": "Agrario", "agrario": "Agrario",
      "varios": "Varios"
    };
    return tipoMap[v] || capitalizar(val);
  };

  return {
    id: (() => {
      const num = raw.id || raw._id || raw.caso_id || "";
      const tipo = (raw.tipo || raw.tipo_caso || "").toUpperCase().replace(/ES$/, "").replace(/S$/, "").trim();
      return tipo ? `${tipo}-${num}` : String(num);
    })(),
    nombre: raw.nombre || raw.asunto || raw.nombre_caso || "",
    tipo: mapTipo(raw.tipo || raw.tipo_caso || ""),
    prioridad: mapPrioridad(raw.prioridad),
    estado: mapEstado(raw.estado),
    asignado: mapAsignado(raw.asignado || raw.abogado_asignado || ""),
    _raw: raw
  };
}

function cargarCasos() {
  renderTable(1);
  if (tipoSelect) {
    tipoSelect.addEventListener("change", () => {
      paginaActual = 1;
      renderTable(1);
      applyPreset(tipoSelect.value);
    });
  }
}

// ========== CAMPOS POR TIPO ==========
const camposPorTipo = {
  amparo: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "fecha_emplazamiento", label: "Fecha de emplazamiento", type: "date" },
    { name: "abogado_encargado", label: "Abogado encargado", type: "text" },
    { name: "actor", label: "Actor", type: "text" },
    { name: "demandado", label: "Demandado", type: "text" },
    { name: "juzgado", label: "Juzgado", type: "text" }
  ],
  administrativo: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "fecha_emplazamiento", label: "Fecha de emplazamiento", type: "date" },
    { name: "sala", label: "Sala", type: "text" },
    { name: "actor", label: "Actor", type: "text" }
  ],
  laboral: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "actor", label: "Actor", type: "text" },
    { name: "fecha_emplazamiento", label: "Fecha de emplazamiento", type: "date" },
    { name: "mesa", label: "Mesa", type: "text" },
    { name: "numero", label: "Número", type: "text" }
  ],
  civil: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "fecha_emplazamiento", label: "Fecha de inicio", type: "date" },
    { name: "juzgado", label: "Juzgado", type: "text" },
    { name: "actor", label: "Actor", type: "text" },
    { name: "demandado", label: "Demandado", type: "text" }
  ],
  mercantil: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "fecha_emplazamiento", label: "Fecha", type: "date" },
    { name: "juzgado", label: "Juzgado", type: "text" },
    { name: "actor", label: "Actor", type: "text" }
  ],
  penal: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "juzgado", label: "Juzgado", type: "text" },
    { name: "actor", label: "Actor", type: "text" },
    { name: "demandado", label: "Demandado", type: "text" }
  ],
  agrario: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "fecha_emplazamiento", label: "Fecha de emplazamiento", type: "date" },
    { name: "actor", label: "Actor", type: "text" }
  ],
  varios: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "fecha_emplazamiento", label: "Fecha recibido", type: "date" }
  ]
};

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
    if (e.target === modalMask) cerrarModalNuevoCaso();
  });
}

if (formNuevoCaso) {
  formNuevoCaso.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tipo = tipoSelectModal.value;
    const formData = new FormData(formNuevoCaso);
    const datos = Object.fromEntries(formData);
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
        alert("Error: " + (result.mensaje || "No se pudo guardar el caso"));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("No se pudo conectar con el servidor. ¿Está corriendo en puerto 3000?");
    }
  });
}

// ========== FORMULARIO INLINE (pestaña Casos) ==========
function mostrarCampos() {
  const tipoEl = document.getElementById("tipo_caso");
  const contenedor = document.getElementById("campos_relevantes");
  if (!tipoEl || !contenedor) return;
  renderCampos(camposPorTipo[tipoEl.value] || [], contenedor);
}

document.addEventListener("DOMContentLoaded", () => {
  mostrarCampos();
});

const btnCancelarForm = document.getElementById("btnCancelarForm");
if (btnCancelarForm) {
  btnCancelarForm.addEventListener("click", () => {
    const details = document.getElementById("detallesNuevoCaso");
    if (details) details.open = false;
  });
}

const formInline = document.getElementById("formNuevoCaso");
if (formInline) {
  formInline.addEventListener("submit", async (e) => {
    e.preventDefault();
    const tipo = document.getElementById("tipo_caso").value;
    const formData = new FormData(formInline);
    const datos = Object.fromEntries(formData);
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
        alert("Error: " + (result.mensaje || "No se pudo guardar el caso"));
      }
    } catch (err) {
      console.error(err);
      alert("No se pudo conectar con el servidor. ¿Está corriendo en puerto 3000?");
    }
  });
}

// ========== NAVEGACIÓN ==========
buttons.forEach(button => {
  button.addEventListener("click", () => {
    const vista = button.dataset.view;

    buttons.forEach(item => item.classList.remove("active"));
    button.classList.add("active");

    views.forEach(view => {
      view.classList.toggle("active", view.id === vista);
    });

    // ← AGREGADO: cargar usuarios al navegar a esa sección
    if (vista === "v_usuarios") cargarUsuarios();

    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

let paginaActual = 1;
const LIMITE = 5;

async function renderTable(pagina = 1) {
  if (!tbody) return;
  const tipo = tipoSelect ? tipoSelect.value : "Todos";
  const url = `http://localhost:3000/api/casos?limite=${LIMITE}&pagina=${pagina}&tipo=${tipo}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) return;
    tbody.innerHTML = data.casos.map(caso => `
      <tr data-id="${caso.id}" data-tipo="${caso.tipo}">
        <td><span class="tag">${caso.id_display}</span></td>
        <td>${caso.nombre}</td>
        <td class="muted">${caso.tipo}</td>
        <td>${caso.prioridad}</td>
        <td>${caso.estado}</td>
        <td class="muted">${caso.asignado}</td>
      </tr>
    `).join("");
    tbody.querySelectorAll("tr").forEach(row => {
      row.addEventListener("dblclick", () => {
        openDrawer({ id: row.dataset.id, tipo: row.dataset.tipo });
      });
    });
    renderPaginacion(pagina, data.casos.length);
  } catch (err) {
    console.error("Error cargando casos:", err);
  }
}

function renderPaginacion(pagina, cantidadActual) {
  let paginacion = document.getElementById("paginacion");
  if (!paginacion) {
    paginacion = document.createElement("div");
    paginacion.id = "paginacion";
    paginacion.style.cssText = "display:flex; gap:8px; align-items:center; margin-top:12px; justify-content:flex-end;";
    tbody.parentElement.parentElement.appendChild(paginacion);
  }
  const hayAnterior = pagina > 1;
  const haySiguiente = cantidadActual === LIMITE;
  paginacion.innerHTML = `
    <button class="btn" id="btnAnterior" ${!hayAnterior ? "disabled" : ""}>← Anterior</button>
    <span class="muted" style="font-size:13px;">Página ${pagina}</span>
    <button class="btn" id="btnSiguiente" ${!haySiguiente ? "disabled" : ""}>Siguiente →</button>
  `;
  if (hayAnterior) {
    document.getElementById("btnAnterior").addEventListener("click", () => {
      paginaActual--;
      renderTable(paginaActual);
    });
  }
  if (haySiguiente) {
    document.getElementById("btnSiguiente").addEventListener("click", () => {
      paginaActual++;
      renderTable(paginaActual);
    });
  }
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
  casoActivoId = item._raw ? (item._raw.id || item._raw._id || item._raw.caso_id) : item.id;
  document.getElementById("drawerTitle").textContent = item.id;
  document.getElementById("drawerSubtitle").textContent = `· ${item.tipo}`;
  document.getElementById("d_tipo").textContent = item.tipo;
  document.getElementById("d_prioridad").textContent = item.prioridad;
  document.getElementById("d_estado").textContent = item.estado;
  document.getElementById("d_asignado").textContent = item.asignado;
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
    paginaActual = 1;
    renderTable(1);
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

// ← AGREGADO: llamada inicial
cargarCasos();
cargarUsuarios();

// ========== DOCUMENTOS DEL CASO ==========
let listaDocumentos = document.getElementById("listaDocumentos");
let zonaUpload = document.getElementById("zonaUpload");
let inputArchivo = document.getElementById("inputArchivo");
let btnSeleccionarArch = document.getElementById("btnSeleccionarArchivo");
let uploadProgress = document.getElementById("uploadProgress");
let uploadBar = document.getElementById("uploadBar");
let uploadStatus = document.getElementById("uploadStatus");

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function iconoArchivo(nombre) {
  const ext = (nombre || "").split(".").pop().toLowerCase();
  return ({ pdf: "📄", doc: "📝", docx: "📝", jpg: "🖼️", jpeg: "🖼️", png: "🖼️", xlsx: "📊", xls: "📊" })[ext] || "📎";
}

function renderDocumentos(docs) {
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
                    overflow:hidden; text-overflow:ellipsis;" title="${doc.nombre_original}">
          ${doc.nombre_original}
        </div>
        <div class="small muted">
          ${formatBytes(doc.tamaño)} · ${doc.subido_por || "Sistema"} · ${doc.fecha || ""}
        </div>
      </div>
      <button class="btn" style="padding:6px 12px; font-size:12px;"
              onclick="descargarDocumento(${doc.id}, '${doc.nombre_original.replace(/'/g, "\\'")}')">
        ⬇ Descargar
      </button>
      <button class="btn" style="padding:6px 12px; font-size:12px; color:#dc2626; border-color:#fecaca;"
              onclick="eliminarDocumento(${doc.id})">
        🗑
      </button>
    </div>
  `).join("");
}

async function descargarDocumento(docId, nombre) {
  try {
    const res = await fetch(`http://localhost:3000/api/documentos/descargar/${docId}`);
    if (!res.ok) { alert("No se pudo descargar el archivo."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    alert("Error al descargar el archivo.");
  }
}

async function eliminarDocumento(docId) {
  if (!confirm("¿Eliminar este documento? Esta acción no se puede deshacer.")) return;
  try {
    const res = await fetch(`http://localhost:3000/api/documentos/${docId}`, { method: "DELETE" });
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
    const res = await fetch(`http://localhost:3000/api/documentos/${casoId}`);
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
  uploadBar = document.getElementById("uploadBar");
  uploadStatus = document.getElementById("uploadStatus");
  if (uploadProgress) uploadProgress.style.display = "block";
  if (uploadBar) uploadBar.style.width = "0%";
  if (uploadStatus) uploadStatus.textContent = `Subiendo 0 de ${archivos.length}...`;
  const usr = JSON.parse(localStorage.getItem("usuario") || "{}");
  let subidos = 0;
  for (const archivo of archivos) {
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("subido_por", usr.username || usr.nombre || "Usuario");
    try {
      const res = await fetch(`http://localhost:3000/api/documentos/${casoActivoId}`, {
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
    if (uploadBar) uploadBar.style.width = pct + "%";
    if (uploadStatus) uploadStatus.textContent = `Subiendo ${subidos} de ${archivos.length}...`;
  }
  setTimeout(() => {
    if (uploadProgress) uploadProgress.style.display = "none";
  }, 800);
  inputArchivo = document.getElementById("inputArchivo");
  if (inputArchivo) inputArchivo.value = "";
  cargarDocumentos(casoActivoId);
}

function iniciarEventosUpload() {
  zonaUpload = document.getElementById("zonaUpload");
  inputArchivo = document.getElementById("inputArchivo");
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
    zonaUpload.ondragover = e => {
      e.preventDefault();
      zonaUpload.style.borderColor = "var(--primary)";
      zonaUpload.style.background = "var(--chip)";
    };
    zonaUpload.ondragleave = () => {
      zonaUpload.style.borderColor = "var(--line)";
      zonaUpload.style.background = "";
    };
    zonaUpload.ondrop = e => {
      e.preventDefault();
      zonaUpload.style.borderColor = "var(--line)";
      zonaUpload.style.background = "";
      if (e.dataTransfer.files.length > 0) subirArchivos(e.dataTransfer.files);
    };
  }
}

// ========== USUARIOS ==========
let openPermisosId = null;

async function cargarUsuarios() {
  const tbody = document.getElementById("usuariosTbody");
  if (!tbody) return;

  try {
    const res = await fetch("http://localhost:3000/api/usuarios");
    const data = await res.json();

    if (!data.success || !data.usuarios.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted" 
        style="text-align:center; padding:24px;">Sin usuarios registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    data.usuarios.forEach(u => {
      const idFormato = `USR-${String(u.id).padStart(4, "0")}`;
      const isOpen = openPermisosId === u.id;

      const tr = document.createElement("tr");
      if (isOpen) tr.classList.add("selected");
      tr.innerHTML = `
        <td><span class="tag">${idFormato}</span></td>
        <td>${u.nombre || "—"}</td>
        <td class="muted">${u.rol || "—"}</td>
        <td class="muted">${u.email || "—"}</td>
        <td>${u.activo ? "Activo" : "Inactivo"}</td>
      `;

      tr.addEventListener("dblclick", () => {
        openPermisosId = isOpen ? null : u.id;
        cargarUsuarios();
      });

      tbody.appendChild(tr);

      if (isOpen) {
        const esAdmin = sessionRol === "ADMIN";
        const modulos = {
          Casos:          ["Ver", "Crear", "Editar", "Eliminar"],
          Documentos:     ["Ver", "Crear", "Editar", "Eliminar"],
          Usuarios:       ["Ver", "Crear", "Editar", "Eliminar"],
          Administración: ["Ver", "Configurar"]
        };

        const panelTr = document.createElement("tr");
        panelTr.innerHTML = `
          <td colspan="5" style="padding: 0;">
            <div style="padding: 14px 20px; background: var(--bg2, #f8f8f8); 
                        border-bottom: 1px solid #eee;">
              <div style="font-size:13px; font-weight:600; margin-bottom:10px;">
                Permisos de ${u.nombre} 
                <span class="pill" style="margin-left:6px;">${u.rol}</span>
                ${!esAdmin ? '<span class="muted" style="font-size:11px; margin-left:6px;">(solo lectura)</span>' : ""}
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap:10px;">
                ${Object.entries(modulos).map(([mod, acciones]) => `
                  <div style="background:#fff; border:1px solid #eee; border-radius:8px; padding:10px;">
                    <div style="font-size:11px; font-weight:600; color:#888; margin-bottom:7px;">${mod}</div>
                    ${acciones.map(acc => `
                      <label style="display:flex; align-items:center; gap:6px; font-size:12px; 
                                    margin-bottom:4px; ${!esAdmin ? "color:#999;" : "cursor:pointer;"}">
                        <input type="checkbox" data-mod="${mod}" data-acc="${acc}"
                          ${!esAdmin ? "disabled" : ""}>
                        ${acc}
                      </label>
                    `).join("")}
                  </div>
                `).join("")}
              </div>
              ${esAdmin ? `
                <div style="display:flex; justify-content:flex-end; margin-top:12px;">
                  <button class="btn primary" id="btnGuardarPermisos">Guardar permisos</button>
                </div>
              ` : ""}
            </div>
          </td>
        `;

        tbody.appendChild(panelTr);

        if (esAdmin) {
          panelTr.querySelector("#btnGuardarPermisos").addEventListener("click", async () => {
            const checks = panelTr.querySelectorAll("input[type=checkbox]:checked");
            const permisos = {};
            checks.forEach(c => {
              if (!permisos[c.dataset.mod]) permisos[c.dataset.mod] = [];
              permisos[c.dataset.mod].push(c.dataset.acc);
            });
            try {
              const res = await fetch(`http://localhost:3000/api/usuarios/${u.id}/permisos`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permisos })
              });
              const result = await res.json();
              if (result.success) alert("✅ Permisos guardados.");
              else alert("❌ " + result.mensaje);
            } catch {
              alert("❌ No se pudo conectar con el servidor.");
            }
          });
        }
      }
    });

  } catch (err) {
    console.error("Error cargando usuarios:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="muted" 
      style="text-align:center; padding:24px;">Error al cargar usuarios.</td></tr>`;
  }
}