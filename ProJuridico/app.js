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

// ========== NUEVO: MODAL PARA CREAR CASOS ==========
const btnNuevoGlobal = document.getElementById("btnNuevoGlobal");
const modalNuevoCaso = document.getElementById("modalNuevoCaso");
const modalMask = document.getElementById("modalMask");
const formNuevoCaso = document.getElementById("formNuevoCasoModal");
const btnCancelarModal = document.getElementById("btnCancelarModal");
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

const casos = [
  { id: "CASO-1042", nombre: "Juicio mercantil · Proveedor X", tipo: "Mercantil", prioridad: "Alta", estado: "En proceso", asignado: "Abg. A" },
  { id: "CASO-1029", nombre: "Amparo indirecto · Exp. 55/2026", tipo: "Amparo", prioridad: "Media", estado: "Pendiente", asignado: "Abg. B" },
  { id: "CASO-0998", nombre: "Laboral · Despido injustificado", tipo: "Laboral", prioridad: "Alta", estado: "Revisión", asignado: "Por reasignar" },
  { id: "CASO-0977", nombre: "Civil · Arrendamiento", tipo: "Civil", prioridad: "Media", estado: "En proceso", asignado: "Abg. C" },
  { id: "CASO-0901", nombre: "Penal · Denuncia", tipo: "Penal", prioridad: "Alta", estado: "Pendiente", asignado: "Abg. D" }
];

// ========== DEFINICIÓN DE CAMPOS POR TIPO ==========
const camposPorTipo = {
  amparo: [
    { id: "numero_expediente", label: "Número de Expediente", type: "text", required: true },
    { id: "fecha_emplazamiento", label: "Fecha de Emplazamiento", type: "date", required: true },
    { id: "juzgado", label: "Juzgado", type: "text", required: true },
    { id: "actor", label: "Actor", type: "text", required: true },
    { id: "demandado", label: "Demandado", type: "text", required: true },
    { id: "asunto", label: "Asunto", type: "textarea", required: true },
    { id: "autoridad_responsable", label: "Autoridad Responsable", type: "text", required: false },
    { id: "acto_reclamado", label: "Acto Reclamado", type: "textarea", required: false }
  ],
  administrativo: [
    { id: "numero_expediente", label: "Número de Expediente", type: "text", required: true },
    { id: "fecha_emplazamiento", label: "Fecha de Emplazamiento", type: "date", required: true },
    { id: "sala", label: "Sala", type: "text", required: true },
    { id: "actor", label: "Actor", type: "text", required: true },
    { id: "autoridad_demandada", label: "Autoridad Demandada", type: "text", required: true },
    { id: "asunto", label: "Asunto", type: "textarea", required: true },
    { id: "pretension", label: "Pretensión", type: "textarea", required: false }
  ],
  laboral: [
    { id: "numero_expediente", label: "Número de Expediente", type: "text", required: true },
    { id: "fecha_emplazamiento", label: "Fecha de Emplazamiento", type: "date", required: true },
    { id: "mesa", label: "Mesa", type: "text", required: true },
    { id: "administracion", label: "Administración", type: "text", required: true },
    { id: "actor", label: "Actor (Demandante)", type: "text", required: true },
    { id: "area_departamento", label: "Área/Departamento", type: "text", required: true },
    { id: "salario", label: "Salario en Litigio", type: "number", required: false },
    { id: "asunto", label: "Asunto", type: "textarea", required: true }
  ],
  civil: [
    { id: "numero_expediente", label: "Número de Expediente", type: "text", required: true },
    { id: "fecha_inicio", label: "Fecha de Inicio", type: "date", required: true },
    { id: "juzgado", label: "Juzgado", type: "text", required: true },
    { id: "actor", label: "Actor", type: "text", required: true },
    { id: "demandado", label: "Demandado", type: "text", required: true },
    { id: "asunto", label: "Asunto", type: "textarea", required: true },
    { id: "valor_litigio", label: "Valor en Litigio", type: "number", required: false }
  ],
  mercantil: [
    { id: "numero_expediente", label: "Número de Expediente", type: "text", required: true },
    { id: "fecha_inicio", label: "Fecha de Inicio", type: "date", required: true },
    { id: "juzgado", label: "Juzgado", type: "text", required: true },
    { id: "actor", label: "Actor", type: "text", required: true },
    { id: "demandado", label: "Demandado", type: "text", required: true },
    { id: "asunto", label: "Asunto", type: "textarea", required: true },
    { id: "valor_litigio", label: "Valor en Litigio", type: "number", required: false }
  ],
  penal: [
    { id: "numero_expediente", label: "Número de Expediente", type: "text", required: true },
    { id: "año", label: "Año", type: "number", required: true },
    { id: "juzgado", label: "Juzgado", type: "text", required: true },
    { id: "actor", label: "Ministerio Público / Actor", type: "text", required: true },
    { id: "demandado", label: "Imputado/Demandado", type: "text", required: true },
    { id: "asunto", label: "Delito/Asunto", type: "textarea", required: true }
  ],
  agrario: [
    { id: "numero_expediente", label: "Número de Expediente", type: "text", required: true },
    { id: "fecha_emplazamiento", label: "Fecha de Emplazamiento", type: "date", required: true },
    { id: "juzgado", label: "Juzgado", type: "text", required: true },
    { id: "actor", label: "Actor", type: "text", required: true },
    { id: "asunto", label: "Asunto", type: "textarea", required: true },
    { id: "superficie_hectareas", label: "Superficie (Hectáreas)", type: "number", required: false },
    { id: "ubicacion", label: "Ubicación", type: "textarea", required: false }
  ],
  varios: [
    { id: "numero_expediente", label: "Número de Expediente", type: "text", required: true },
    { id: "fecha_recibido", label: "Fecha Recibido", type: "date", required: true },
    { id: "actor", label: "Remitente/Actor", type: "text", required: true },
    { id: "asunto", label: "Asunto General", type: "textarea", required: true }
  ]
};

// ========== FUNCIONES PARA MODAL ==========

function abrirModalNuevoCaso() {
  modalMask.classList.add("show");
  modalNuevoCaso.classList.add("show");
  mostrarCamposModal("amparo"); // Tipo por defecto
}

function cerrarModalNuevoCaso() {
  modalMask.classList.remove("show");
  modalNuevoCaso.classList.remove("show");
  formNuevoCaso.reset();
  camposRelevantesModal.innerHTML = "";
}

function mostrarCamposModal(tipo) {
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
    } else {
      input = document.createElement("input");
      input.type = campo.type;
    }

    input.id = campo.id;
    input.name = campo.id;
    input.required = campo.required;
    input.placeholder = `Ingresa ${campo.label.toLowerCase()}`;

    fieldDiv.appendChild(label);
    fieldDiv.appendChild(input);
    camposRelevantesModal.appendChild(fieldDiv);
  });
}

// ========== EVENTO: BOTÓN NUEVO GLOBAL ==========
if (btnNuevoGlobal) {
  btnNuevoGlobal.addEventListener("click", abrirModalNuevoCaso);
}

// ========== EVENTO: CAMBIAR TIPO EN MODAL ==========
if (tipoSelectModal) {
  tipoSelectModal.addEventListener("change", (e) => {
    mostrarCamposModal(e.target.value);
  });
}

// ========== EVENTO: CANCELAR MODAL ==========
if (btnCancelarModal) {
  btnCancelarModal.addEventListener("click", cerrarModalNuevoCaso);
}

// ========== EVENTO: CERRAR MODAL AL CLICKEAR MASK ==========
if (modalMask) {
  modalMask.addEventListener("click", (e) => {
    if (e.target === modalMask) {
      cerrarModalNuevoCaso();
    }
  });
}

// ========== EVENTO: CERRAR MODAL CON ESC ==========
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    cerrarModalNuevoCaso();
  }
});

// ========== EVENTO: SUBMIT FORMULARIO MODAL ==========
if (formNuevoCaso) {
  formNuevoCaso.addEventListener("submit", async (e) => {
    e.preventDefault();

    const tipo = tipoSelectModal.value;
    const formData = new FormData(formNuevoCaso);
    const datos = Object.fromEntries(formData);

    // Crear objeto del caso
    const nuevoCase = {
      tipo: tipo,
      ...datos,
      prioridad: "Media", // Por defecto
      estado: "Pendiente", // Por defecto
      asignado: "Por asignar"
    };

    try {
      // Aquí va la llamada a la API para guardar
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
        renderTable(); // Recargar tabla
      } else {
        alert(data.message || "Error al crear el caso");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error al conectar con el servidor");
    }
  });
}

// ========== FUNCIONES ORIGINALES ==========

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

  tbody.innerHTML = rows.map(caso => `
    <tr data-id="${caso.id}">
      <td><span class="tag">${caso.id}</span></td>
      <td>${caso.nombre}</td>
      <td class="muted">${caso.tipo}</td>
      <td>${caso.prioridad}</td>
      <td>${caso.estado}</td>
      <td class="muted">${caso.asignado}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr").forEach(row => {
    row.addEventListener("dblclick", () => {
      const item = casos.find(caso => caso.id === row.dataset.id);
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

  document.getElementById("drawerTitle").textContent = item.id;
  document.getElementById("drawerSubtitle").textContent = `· ${item.tipo}`;
  document.getElementById("d_tipo").textContent = item.tipo;
  document.getElementById("d_prioridad").textContent = item.prioridad;
  document.getElementById("d_estado").textContent = item.estado;
  document.getElementById("d_asignado").textContent = item.asignado;

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

renderTable();
if (tipoSelect) {
  applyPreset(tipoSelect.value);
}