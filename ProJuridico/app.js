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

// ── Búsqueda global ──
const inputBusqueda = document.getElementById("inputBusqueda");
let busquedaActual  = "";
let debounceTimer   = null;

if (inputBusqueda) {
  inputBusqueda.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const termino = inputBusqueda.value.trim();
      // Solo busca si cambió el término
      if (termino === busquedaActual) return;
      busquedaActual = termino;
      paginaActual   = 1;
      renderTable(1);
    }, 400);
  });

  // Limpiar con Escape dentro del input
  inputBusqueda.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      inputBusqueda.value = "";
      busquedaActual = "";
      paginaActual   = 1;
      renderTable(1);
    }
  });
}

// ========== VARIABLES PARA MODAL ==========
const btnNuevoGlobal = document.getElementById("btnNuevoGlobal");
const modalNuevoCaso = document.getElementById("modalNuevoCaso");
const modalMask = document.getElementById("modalMask");
const formNuevoCaso = document.getElementById("formNuevoCasoModal");
const btnCancelarModal = document.getElementById("btnCancelarModal");
const btnCloseModal = document.getElementById("btnCloseModal");
const tipoSelectModal = document.getElementById("tipoSelectModal");
const camposRelevantesModal = document.getElementById("camposRelevantesModal");
const btnNuevoUsuario = document.getElementById("btnNuevoUsuario");
const modalUsuarioMask = document.getElementById("modalUsuarioMask");
const modalNuevoUsuario = document.getElementById("modalNuevoUsuario");
const formNuevoUsuario = document.getElementById("formNuevoUsuario");
const btnCancelarUsuarioModal = document.getElementById("btnCancelarUsuarioModal");
const btnCloseUsuarioModal = document.getElementById("btnCloseUsuarioModal");
const btnLimpiarUsuario = document.getElementById("btnLimpiarUsuario");
const btnGuardarUsuario = document.getElementById("btnGuardarUsuario");
const inputUsuarioId = document.getElementById("usuario_id");
const inputUsuarioNombre = document.getElementById("usuario_nombre");

const STORAGE_KEYS = {
  activeView: "projuridico.activeView",
  activeCase: "projuridico.activeCase",
  dashboardToast: "projuridico.dashboardToast",
  loginToast: "projuridico.loginToast"
};

function guardarVistaActiva(vista) {
  if (!vista) return;
  sessionStorage.setItem(STORAGE_KEYS.activeView, vista);
}

function obtenerVistaActiva() {
  return sessionStorage.getItem(STORAGE_KEYS.activeView);
}

function guardarCasoActivo(item) {
  if (!item?._numId) return;
  sessionStorage.setItem(STORAGE_KEYS.activeCase, JSON.stringify({
    id: item.id,
    tipo: item.tipo,
    tipoDb: item.tipoDb || "",
    prioridad: item.prioridad,
    estado: item.estado,
    asignado: item.asignado,
    _numId: String(item._numId)
  }));
}

function obtenerCasoActivoGuardado() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.activeCase);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function limpiarCasoActivoGuardado() {
  sessionStorage.removeItem(STORAGE_KEYS.activeCase);
}

function guardarToastPendiente(key, payload) {
  if (!key || !payload?.message) return;
  sessionStorage.setItem(key, JSON.stringify(payload));
}

function mostrarToastPendiente(key) {
  if (!key) return;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    const payload = JSON.parse(raw);
    if (payload?.message) {
      showToast(payload.message, payload.type || "info");
    }
  } catch {
    sessionStorage.removeItem(key);
  }
}

function setActiveView(vista, { scroll = true } = {}) {
  if (!vista) return;
  const existeVista = Array.from(views).some(view => view.id === vista);
  if (!existeVista) return;

  buttons.forEach(button => {
    button.classList.toggle("active", button.dataset.view === vista);
  });

  views.forEach(view => {
    view.classList.toggle("active", view.id === vista);
  });

  guardarVistaActiva(vista);

  if (vista === "v_usuarios") cargarUsuarios();
  if (scroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function normalizarTipoCasoDb(value) {
  const limpio = String(value || "").trim().toLowerCase();
  const mapa = {
    administrativo: "administrativos",
    administrativos: "administrativos",
    agrario: "agrarios",
    agrarios: "agrarios",
    amparo: "amparos",
    amparos: "amparos",
    civil: "civiles",
    civiles: "civiles",
    laboral: "laborales",
    laborales: "laborales",
    mercantil: "mercantiles",
    mercantiles: "mercantiles",
    penal: "penales",
    penales: "penales",
    varios: "exp_varios",
    "exp varios": "exp_varios",
    exp_varios: "exp_varios"
  };
  return mapa[limpio] || "";
}

let toastContainer = null;
let confirmDialogState = null;
let confirmDialogElements = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatearTextoHtml(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function inferirTipoToast(message) {
  const texto = String(message || "").toLowerCase();
  if (texto.includes("✅") || texto.includes("guardado") || texto.includes("éxito") || texto.includes("exito")) {
    return "success";
  }
  if (texto.includes("❌") || texto.includes("error") || texto.includes("no se pudo")) {
    return "error";
  }
  return "info";
}

function obtenerToastContainer() {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;

  toastContainer = document.createElement("div");
  toastContainer.className = "toastContainer";
  toastContainer.setAttribute("aria-live", "polite");
  toastContainer.setAttribute("aria-atomic", "true");
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function showToast(message, type = inferirTipoToast(message), duration = 3600) {
  if (!message) return;

  const iconos = {
    success: "✓",
    error: "!",
    info: "i"
  };

  const container = obtenerToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icono = document.createElement("span");
  icono.className = "toastIcon";
  icono.setAttribute("aria-hidden", "true");
  icono.textContent = iconos[type] || iconos.info;

  const texto = document.createElement("span");
  texto.className = "toastMessage";
  texto.textContent = String(message);

  const cerrar = document.createElement("button");
  cerrar.type = "button";
  cerrar.className = "toastClose";
  cerrar.setAttribute("aria-label", "Cerrar notificación");
  cerrar.textContent = "×";

  let timer = null;
  const dismiss = () => {
    if (!toast.isConnected) return;
    if (timer) window.clearTimeout(timer);
    toast.classList.remove("show");
    window.setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, 220);
  };

  cerrar.addEventListener("click", dismiss);
  toast.append(icono, texto, cerrar);
  container.appendChild(toast);

  window.requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  timer = window.setTimeout(dismiss, Math.max(duration, 1800));
}

window.showToast = showToast;
window.alert = message => showToast(message);

function obtenerConfirmDialog() {
  if (confirmDialogElements && document.body.contains(confirmDialogElements.mask)) {
    return confirmDialogElements;
  }

  const mask = document.createElement("div");
  mask.className = "confirmDialogMask";
  mask.innerHTML = `
    <div class="confirmDialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmDialogTitle" aria-describedby="confirmDialogMessage">
      <div class="confirmDialogHeader">
        <div class="confirmDialogEyebrow">Confirmación</div>
        <h3 class="confirmDialogTitle" id="confirmDialogTitle">Confirmar acción</h3>
      </div>
      <p class="confirmDialogMessage" id="confirmDialogMessage"></p>
      <div class="confirmDialogActions">
        <button type="button" class="btn" data-confirm-cancel>Cancelar</button>
        <button type="button" class="btn primary" data-confirm-accept>Aceptar</button>
      </div>
    </div>
  `;

  const dialog = mask.querySelector(".confirmDialog");
  const title = mask.querySelector("#confirmDialogTitle");
  const message = mask.querySelector("#confirmDialogMessage");
  const cancelBtn = mask.querySelector("[data-confirm-cancel]");
  const acceptBtn = mask.querySelector("[data-confirm-accept]");

  const cerrar = result => {
    if (!confirmDialogState) return;
    const { resolve } = confirmDialogState;
    confirmDialogState = null;
    mask.classList.remove("show");
    dialog.classList.remove("confirmDialogShow");
    resolve(Boolean(result));
  };

  cancelBtn.addEventListener("click", () => cerrar(false));
  acceptBtn.addEventListener("click", () => cerrar(true));
  mask.addEventListener("click", e => {
    if (e.target === mask) cerrar(false);
  });

  document.body.appendChild(mask);
  confirmDialogElements = { mask, dialog, title, message, cancelBtn, acceptBtn, cerrar };
  return confirmDialogElements;
}

function showConfirmDialog({
  title = "Confirmar acción",
  message = "",
  confirmText = "Aceptar",
  cancelText = "Cancelar",
  variant = "primary"
} = {}) {
  if (confirmDialogState?.resolve) {
    confirmDialogState.resolve(false);
  }

  const dialog = obtenerConfirmDialog();
  dialog.title.textContent = title;
  dialog.message.textContent = message;
  dialog.cancelBtn.textContent = cancelText;
  dialog.acceptBtn.textContent = confirmText;
  dialog.acceptBtn.classList.toggle("danger", variant === "danger");
  dialog.mask.classList.add("show");

  window.requestAnimationFrame(() => {
    dialog.dialog.classList.add("confirmDialogShow");
    dialog.acceptBtn.focus();
  });

  return new Promise(resolve => {
    confirmDialogState = { resolve };
  });
}

async function obtenerJsonSeguro(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

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
    id: raw.id_display || (() => {
      const num = raw.id || raw._id || raw.caso_id || "";
      const tipo = (raw.tipo || raw.tipo_caso || "").toUpperCase().replace(/ES$/, "").replace(/S$/, "").trim();
      return tipo ? `${tipo}-${num}` : String(num);
    })(),
    nombre: raw.nombre || raw.asunto || raw.nombre_caso || "",
    tipo: mapTipo(raw.tipo || raw.tipo_caso || ""),
    tipoDb: normalizarTipoCasoDb(raw.tipo_db || raw.tipo || raw.tipo_caso),
    prioridad: mapPrioridad(raw.prioridad),
    estado: mapEstado(raw.estado || raw.estado_procesal),
    asignado: mapAsignado(raw.asignado || raw.abogado_asignado || ""),
    _numId: String(raw.id || raw._id || raw.caso_id || ""),
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

function limpiarFormularioUsuario() {
  if (formNuevoUsuario) formNuevoUsuario.reset();
  if (inputUsuarioId) inputUsuarioId.value = "";
}

function abrirModalNuevoUsuario() {
  if (!modalUsuarioMask || !modalNuevoUsuario) return;
  limpiarFormularioUsuario();
  modalUsuarioMask.classList.add("show");
  modalNuevoUsuario.classList.add("show");
  window.requestAnimationFrame(() => inputUsuarioNombre?.focus());
}

function cerrarModalNuevoUsuario() {
  if (!modalUsuarioMask || !modalNuevoUsuario) return;
  modalUsuarioMask.classList.remove("show");
  modalNuevoUsuario.classList.remove("show");
  limpiarFormularioUsuario();
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
        showToast("Caso guardado con ID: " + result.id, "success");
        cerrarModalNuevoCaso();
        cargarCasos();
      } else {
        showToast("Error: " + (result.mensaje || "No se pudo guardar el caso"), "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showToast("No se pudo conectar con el servidor. ¿Está corriendo en puerto 3000?", "error");
    }
  });
}

if (btnNuevoUsuario) {
  btnNuevoUsuario.addEventListener("click", abrirModalNuevoUsuario);
}

if (btnCancelarUsuarioModal) {
  btnCancelarUsuarioModal.addEventListener("click", cerrarModalNuevoUsuario);
}

if (btnCloseUsuarioModal) {
  btnCloseUsuarioModal.addEventListener("click", cerrarModalNuevoUsuario);
}

if (btnLimpiarUsuario) {
  btnLimpiarUsuario.addEventListener("click", limpiarFormularioUsuario);
}

if (modalUsuarioMask) {
  modalUsuarioMask.addEventListener("click", (e) => {
    if (e.target === modalUsuarioMask) cerrarModalNuevoUsuario();
  });
}

if (formNuevoUsuario) {
  formNuevoUsuario.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = new FormData(formNuevoUsuario);
    const datos = Object.fromEntries(formData);
    const payload = {
      nombre: (datos.nombre || "").trim(),
      username: (datos.username || "").trim(),
      email: (datos.email || "").trim(),
      rol: datos.rol || "ABOGADO",
      password: datos.password || "",
      activo: Number(datos.activo ?? 1)
    };

    if (!payload.nombre || !payload.username || !payload.password) {
      showToast("Nombre, usuario y contraseña son obligatorios.", "error");
      return;
    }

    const textoOriginal = btnGuardarUsuario?.textContent || "Guardar usuario";
    if (btnGuardarUsuario) {
      btnGuardarUsuario.disabled = true;
      btnGuardarUsuario.textContent = "Guardando...";
    }

    try {
      const res = await fetch("http://localhost:3000/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (res.ok && result.success) {
        const idFormato = result.id ? `USR-${String(result.id).padStart(4, "0")}` : "";
        showToast(idFormato ? `Usuario creado con ID ${idFormato}.` : "Usuario creado correctamente.", "success");
        cerrarModalNuevoUsuario();
        cargarUsuarios();
      } else {
        showToast(result.mensaje || "No se pudo guardar el usuario.", "error");
      }
    } catch (error) {
      console.error("Error guardando usuario:", error);
      showToast("No se pudo conectar con el servidor.", "error");
    } finally {
      if (btnGuardarUsuario) {
        btnGuardarUsuario.disabled = false;
        btnGuardarUsuario.textContent = textoOriginal;
      }
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
        showToast("Caso guardado con ID: " + result.id, "success");
        formInline.reset();
        mostrarCampos();
        const details = document.getElementById("detallesNuevoCaso");
        if (details) details.open = false;
        cargarCasos();
      } else {
        showToast("Error: " + (result.mensaje || "No se pudo guardar el caso"), "error");
      }
    } catch (err) {
      console.error(err);
      showToast("No se pudo conectar con el servidor. ¿Está corriendo en puerto 3000?", "error");
    }
  });
}

// ========== NAVEGACIÓN ==========
buttons.forEach(button => {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.view);
  });
});

let paginaActual = 1;
const LIMITE = 5;

async function renderTable(pagina = 1) {
  if (!tbody) return;
  const tipo = tipoSelect ? tipoSelect.value : "Todos";
  const params = new URLSearchParams({
    limite:   LIMITE,
    pagina:   pagina,
    tipo:     tipo,
    busqueda: busquedaActual
  });
  const url = `http://localhost:3000/api/casos?${params}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) return;
    casos = (data.casos || []).map(normalizarCaso);
    tbody.innerHTML = casos.map(caso => `
      <tr data-id="${caso._numId}" data-tipo="${caso.tipo}">
        <td><span class="tag">${caso.id}</span></td>
        <td>${caso.nombre}</td>
        <td class="muted">${caso.tipo}</td>
        <td>${caso.prioridad}</td>
        <td>${caso.estado}</td>
        <td class="muted">${caso.asignado}</td>
      </tr>
    `).join("");
    tbody.querySelectorAll("tr").forEach((row, index) => {
      const casoCompleto = casos[index];
      if (!casoCompleto) return;

      row.addEventListener("dblclick", () => {
        openDrawer(casoCompleto);
      });
    });
    renderPaginacion(pagina, casos.length);
    resaltarTermino(busquedaActual);
  } catch (err) {
    console.error("Error cargando casos:", err);
  }
}

// Resalta el término buscado en la tabla
function resaltarTermino(termino) {
  if (!termino || !tbody) return;
  const regex = new RegExp(`(${termino.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  tbody.querySelectorAll("td:nth-child(2)").forEach(td => {
    td.innerHTML = td.textContent.replace(regex,
      '<mark style="background:#fef08a; border-radius:3px; padding:0 2px;">$1</mark>'
    );
  });
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
  casoActivoId = item._numId || (item._raw ? (item._raw.id || item._raw._id || item._raw.caso_id) : item.id);
  casoActivoTipo = item.tipoDb || normalizarTipoCasoDb(item.tipo || item._raw?.tipo || item._raw?.tipo_caso);
  setActiveView("v_casos", { scroll: false });
  document.getElementById("drawerTitle").textContent = item.id;
  document.getElementById("drawerSubtitle").textContent = `· ${item.tipo}`;
  document.getElementById("d_tipo").textContent = item.tipo;
  document.getElementById("d_prioridad").textContent = item.prioridad;
  document.getElementById("d_estado").textContent = item.estado;
  document.getElementById("d_asignado").textContent = item.asignado;
  guardarCasoActivo({
    id: item.id,
    tipo: item.tipo,
    tipoDb: casoActivoTipo,
    prioridad: item.prioridad,
    estado: item.estado,
    asignado: item.asignado,
    _numId: casoActivoId
  });
  if (inputNuevaNota) inputNuevaNota.value = "";
  cargarNotas(casoActivoId);
  cargarDocumentos(casoActivoId);
  iniciarEventosUpload();
  mask.classList.add("show");
}

function closeDrawer() {
  casoActivoId = null;
  casoActivoTipo = null;
  limpiarCasoActivoGuardado();
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

// Prevenir que clicks dentro del drawer cierren el drawer
const drawerPanel = document.querySelector('.drawer');
if (drawerPanel) {
  drawerPanel.addEventListener('click', (e) => {
    e.stopPropagation(); // Detener propagación de TODOS los clicks dentro del drawer
  });
}

if (mask) {
  mask.addEventListener("click", closeDrawer); // Ahora solo cierra si clickeas el fondo oscuro
}

window.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (confirmDialogState) {
    obtenerConfirmDialog().cerrar(false);
    return;
  }
  if (modalUsuarioMask && modalUsuarioMask.classList.contains("show")) {
    cerrarModalNuevoUsuario();
    return;
  }
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
  btnLogout.addEventListener("click", async () => {
    const confirmar = await showConfirmDialog({
      title: "Cerrar sesión",
      message: "¿Deseas cerrar sesión?",
      confirmText: "Cerrar sesión",
      cancelText: "Cancelar"
    });
    if (!confirmar) return;
    sessionStorage.removeItem(STORAGE_KEYS.activeView);
    limpiarCasoActivoGuardado();
    guardarToastPendiente(STORAGE_KEYS.loginToast, {
      message: "Sesión cerrada correctamente.",
      type: "info"
    });
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

// ========== NOTAS DEL CASO ==========
let casoActivoId = null;
let casoActivoTipo = null;
// Flag removido - usamos event.stopPropagation en el drawer directamente

const btnGuardarNota = document.getElementById("btnGuardarNota");
const btnLimpiarNota = document.getElementById("btnLimpiarNota");
const inputNuevaNota = document.getElementById("inputNuevaNota");
const listaNotas = document.getElementById("listaNotas");

function obtenerNotaId(nota) {
  return nota?.id || nota?.nota_id || nota?._id || nota?.notaId || "";
}

function renderNotas(notas) {
  if (!listaNotas) return;
  if (!notas || notas.length === 0) {
    listaNotas.innerHTML = '<div class="small muted">Sin notas registradas.</div>';
    return;
  }
  listaNotas.innerHTML = notas.map(n => {
    const notaId = obtenerNotaId(n);
    const meta = [n.fecha, n.usuario || "Sistema"].filter(Boolean).map(escapeHtml).join(" · ");
    const contenido = formatearTextoHtml(n.texto || n.nota || n.contenido || "");

    return `
      <div class="nota-item card noteCard" style="box-shadow:none; padding: 12px 14px;">
        <div class="noteMetaRow">
          <div class="small muted">${meta || "Sistema"}</div>
          ${notaId ? `<button type="button" class="btn noteDeleteBtn" data-note-id="${escapeHtml(notaId)}">Eliminar</button>` : ""}
        </div>
        <div class="noteText" style="margin-top:4px;">${contenido}</div>
      </div>
    `;
  }).join("");

  listaNotas.querySelectorAll("[data-note-id]").forEach(button => {
    button.addEventListener("click", () => {
      eliminarNota(button.dataset.noteId);
    });
  });
}

async function eliminarNota(notaId) {
  if (!casoActivoId || !casoActivoTipo || !notaId) {
    showToast("No se pudo identificar la nota a eliminar.", "error");
    return;
  }

  const confirmar = await showConfirmDialog({
    title: "Eliminar nota",
    message: "¿Eliminar esta nota? Esta acción no se puede deshacer.",
    confirmText: "Eliminar",
    cancelText: "Cancelar",
    variant: "danger"
  });

  if (!confirmar) return;

  const params = new URLSearchParams({ tipo_caso: casoActivoTipo });
  let mensajeError = "No se pudo eliminar la nota.";

  try {
    const res = await fetch(
      `http://localhost:3000/api/casos/${encodeURIComponent(casoActivoId)}/notas/${encodeURIComponent(notaId)}?${params}`,
      { method: "DELETE" }
    );
    const data = await obtenerJsonSeguro(res);

    if (res.ok && (!data || data.success !== false)) {
      cargarNotas(casoActivoId);
      showToast("Nota eliminada correctamente.", "success");
      return;
    }

    mensajeError = data?.mensaje || mensajeError;
  } catch {
    mensajeError = "Error al conectar con el servidor.";
  }

  showToast(mensajeError, "error");
}

async function cargarNotas(casoId) {
  if (!listaNotas) return;
  if (!casoActivoTipo) {
    listaNotas.innerHTML = '<div class="small muted">No se pudo identificar el tipo del caso.</div>';
    return;
  }
  listaNotas.innerHTML = '<div class="small muted">Cargando notas...</div>';
  try {
    const params = new URLSearchParams({ tipo_caso: casoActivoTipo });
    const res = await fetch(`http://localhost:3000/api/casos/${casoId}/notas?${params}`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    const notas = data.notas || [];
    renderNotas(notas);
  } catch {
    listaNotas.innerHTML = '<div class="small muted">No se pudieron cargar las notas.</div>';
  }
}

if (btnGuardarNota) {
  btnGuardarNota.addEventListener("click", async () => {
    if (!casoActivoId || !casoActivoTipo || !inputNuevaNota) return;
    const texto = inputNuevaNota.value.trim();
    if (!texto) return;
    try {


     const usr = JSON.parse(localStorage.getItem("usuario") || "{}");
    const res = await fetch(`http://localhost:3000/api/casos/${casoActivoId}/notas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
    texto, 
    usuario: usr.username || usr.nombre || "Sistema",
    tipo_caso: casoActivoTipo
  })
});

      if (res.ok) {
        inputNuevaNota.value = "";
        cargarNotas(casoActivoId);
        showToast("Nota guardada correctamente.", "success");
      } else {
        showToast("Error al guardar la nota", "error");
      }
    } catch {
      showToast("Error al conectar con el servidor", "error");
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
              type="button"
              onclick="event.stopPropagation(); descargarDocumento(${doc.id}, '${doc.nombre_original.replace(/'/g, "\\'")}')">
        ⬇ Descargar
      </button>
      <button class="btn" style="padding:6px 12px; font-size:12px; color:#dc2626; border-color:#fecaca;"
              type="button"
              onclick="event.stopPropagation(); eliminarDocumento(${doc.id})">
        🗑
      </button>
    </div>
  `).join("");
}

async function descargarDocumento(docId, nombre) {
  try {
    const res = await fetch(`http://localhost:3000/api/documentos/descargar/${docId}`);
    if (!res.ok) { showToast("No se pudo descargar el archivo.", "error"); return; }
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
    showToast("Error al descargar el archivo.", "error");
  }
}

async function eliminarDocumento(docId) {
  const confirmar = await showConfirmDialog({
    title: "Eliminar documento",
    message: "¿Eliminar este documento? Esta acción no se puede deshacer.",
    confirmText: "Eliminar",
    cancelText: "Cancelar",
    variant: "danger"
  });
  if (!confirmar) return;
  try {
    const res = await fetch(`http://localhost:3000/api/documentos/${docId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      cargarDocumentos(casoActivoId);
      showToast("Documento eliminado correctamente.", "success");
    } else {
      showToast("Error al eliminar: " + (data.mensaje || ""), "error");
    }
  } catch {
    showToast("Error al conectar con el servidor.", "error");
  }
}

async function cargarDocumentos(casoId) {
  listaDocumentos = document.getElementById("listaDocumentos");
  if (!listaDocumentos) return;
  if (!casoActivoTipo) {
    listaDocumentos.innerHTML = '<div class="small muted">No se pudo identificar el tipo del caso.</div>';
    return;
  }
  listaDocumentos.innerHTML = '<div class="small muted">Cargando documentos...</div>';
  try {
    const params = new URLSearchParams({ tipo_caso: casoActivoTipo });
    const res = await fetch(`http://localhost:3000/api/documentos/${casoId}?${params}`);
    const data = await res.json();
    const docs = Array.isArray(data) ? data : (data.documentos || data.data || []);
    renderDocumentos(docs);
  } catch {
    listaDocumentos.innerHTML = '<div class="small muted">No se pudieron cargar los documentos.</div>';
  }
}

async function subirArchivos(archivos) {
  if (!archivos || archivos.length === 0 || !casoActivoId || !casoActivoTipo) return;
  uploadProgress = document.getElementById("uploadProgress");
  uploadBar = document.getElementById("uploadBar");
  uploadStatus = document.getElementById("uploadStatus");
  if (uploadProgress) uploadProgress.style.display = "block";
  if (uploadBar) uploadBar.style.width = "0%";
  if (uploadStatus) uploadStatus.textContent = `Subiendo 0 de ${archivos.length}...`;
  const usr = JSON.parse(localStorage.getItem("usuario") || "{}");
  let subidos = 0;
  let errores = 0;
  for (const archivo of archivos) {
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("subido_por", usr.username || usr.nombre || "Usuario");
    fd.append("tipo_caso", casoActivoTipo);
    try {
      const res = await fetch(`http://localhost:3000/api/documentos/${casoActivoId}`, {
        method: "POST",
        body: fd
      });
      const data = await res.json();
      if (!data.success) {
        errores++;
        showToast("Error al subir " + archivo.name + ": " + (data.mensaje || ""), "error");
      }
    } catch {
      errores++;
      showToast("Error de conexión al subir " + archivo.name, "error");
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
  if (archivos.length > 0 && errores === 0) {
    showToast("Archivos subidos correctamente.", "success");
  } else if (subidos > errores) {
    showToast("Algunos archivos se subieron, pero hubo errores.", "info");
  }
}

function iniciarEventosUpload() {
  zonaUpload = document.getElementById("zonaUpload");
  inputArchivo = document.getElementById("inputArchivo");
  btnSeleccionarArch = document.getElementById("btnSeleccionarArchivo");
  if (btnSeleccionarArch) {
    btnSeleccionarArch.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      if (inputArchivo) inputArchivo.click();
    };
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
      e.stopPropagation();
      zonaUpload.style.borderColor = "var(--line)";
      zonaUpload.style.background = "";
      if (e.dataTransfer.files.length > 0) subirArchivos(e.dataTransfer.files);
    };
  }
}

function restaurarEstadoUI() {
  const vistaGuardada = obtenerVistaActiva();
  if (vistaGuardada) {
    setActiveView(vistaGuardada, { scroll: false });
  }

  const casoGuardado = obtenerCasoActivoGuardado();
  if (casoGuardado?._numId) {
    openDrawer(casoGuardado);
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
              if (result.success) showToast("Permisos guardados.", "success");
              else showToast(result.mensaje || "No se pudieron guardar los permisos.", "error");
            } catch {
              showToast("No se pudo conectar con el servidor.", "error");
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

restaurarEstadoUI();
mostrarToastPendiente(STORAGE_KEYS.dashboardToast);
