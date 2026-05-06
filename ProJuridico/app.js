const usuarioGuardado = localStorage.getItem("usuario");

if (!usuarioGuardado) {
  window.location.href = "index.html";
}

const usuarioSesion = JSON.parse(usuarioGuardado || "{}");
const sessionRol = (usuarioSesion.rol || "").toUpperCase();
const sessionUsuarioId = usuarioSesion.id ? String(usuarioSesion.id) : "";
const sessionUsername = usuarioSesion.username || "";
const sessionNombre = usuarioSesion.nombre || "";

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
const btnFiltroPrioridad = document.getElementById("btnFiltroPrioridad");
let ordenarPrioridadAltaBaja = false;

function authQueryParams() {
  return {
    rol: sessionRol,
    usuario_id: sessionUsuarioId,
    usuario: sessionUsername || sessionNombre
  };
}

// ── Búsqueda global ──
const inputBusqueda = document.getElementById("inputBusqueda");
let busquedaActual = "";
let debounceTimer = null;

if (inputBusqueda) {
  inputBusqueda.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const termino = inputBusqueda.value.trim();
      if (termino === busquedaActual) return;
      busquedaActual = termino;
      paginaActual = 1;
      renderTable(1);
    }, 400);
  });

  inputBusqueda.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      inputBusqueda.value = "";
      busquedaActual = "";
      paginaActual = 1;
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
    asignadoExtra: item.asignadoExtra || "",
    abogadoEncargadoId: item.abogadoEncargadoId || "",
    abogadoColaboradorId: item.abogadoColaboradorId || "",
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

function prioridadClass(prioridad) {
  const valor = String(prioridad || "").trim().toLowerCase();
  if (valor === "alta") return "priority-alta";
  if (valor === "media") return "priority-media";
  if (valor === "baja") return "priority-baja";
  return "priority-default";
}

function renderPrioridadBadge(prioridad) {
  const texto = prioridad || "Media";
  return `<span class="priorityBadge ${prioridadClass(texto)}">${escapeHtml(texto)}</span>`;
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
      "varios": "Varios", "exp_varios": "Varios"
    };
    return tipoMap[v] || capitalizar(val);
  };

  return {
    id: raw.id_display || (() => {
      const num = raw.id || raw._id || raw.caso_id || "";
      const tipo = (raw.tipo || raw.tipo_caso || "").toUpperCase().replace(/ES$/, "").replace(/S$/, "").trim();
      return tipo ? `${tipo}-${num}` : String(num);
    })(),
    fecha: raw.fecha || raw.created_at || "Sin fecha",
    nombre: raw.nombre || raw.asunto || raw.nombre_caso || "",
    tipo: mapTipo(raw.tipo || raw.tipo_caso || ""),
    tipoDb: normalizarTipoCasoDb(raw.tipo_db || raw.tipo || raw.tipo_caso),
    prioridad: mapPrioridad(raw.prioridad),
    estado: mapEstado(raw.estado || raw.estado_procesal),
    asignado: mapAsignado(raw.nombre_abogado || raw.asignado || raw.abogado_asignado || raw.abogado_encargado || ""),
    asignadoExtra: (raw.nombre_abogado_colaborador || raw.asignado_extra)
      ? mapAsignado(raw.nombre_abogado_colaborador || raw.asignado_extra)
      : "",
    abogadoEncargadoId: raw.abogado_encargado ? String(raw.abogado_encargado) : "",
    abogadoColaboradorId: raw.abogado_colaborador ? String(raw.abogado_colaborador) : "",
    _numId: String(raw.id || raw._id || raw.caso_id || ""),
    _raw: raw
  };
}

function cargarCasos() {
  renderTable(1);
}

// ========== CAMPOS POR TIPO ==========
const camposPorTipo = {
  amparo: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "fecha_emplazamiento", label: "Fecha de emplazamiento", type: "date" },
    { name: "abogado_encargado", label: "Abogado encargado", type: "select-abogados" },
    { name: "actor", label: "Actor", type: "text" },
    { name: "demandado", label: "Demandado", type: "text" },
    { name: "juzgado", label: "Juzgado", type: "text" }
  ],
  administrativo: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "abogado_encargado", label: "Abogado encargado", type: "select-abogados" },
    { name: "fecha_emplazamiento", label: "Fecha de emplazamiento", type: "date" },
    { name: "sala", label: "Sala", type: "text" },
    { name: "actor", label: "Actor", type: "text" }
  ],
  laboral: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "actor", label: "Actor", type: "text" },
    { name: "abogado_encargado", label: "Abogado encargado", type: "select-abogados" },
    { name: "fecha_emplazamiento", label: "Fecha de emplazamiento", type: "date" },
    { name: "mesa", label: "Mesa", type: "text" },
    { name: "numero", label: "Número", type: "text" }
  ],
  civil: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "abogado_encargado", label: "Abogado encargado", type: "select-abogados" },
    { name: "fecha_emplazamiento", label: "Fecha de inicio", type: "date" },
    { name: "juzgado", label: "Juzgado", type: "text" },
    { name: "actor", label: "Actor", type: "text" },
    { name: "demandado", label: "Demandado", type: "text" }
  ],
  mercantil: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "abogado_encargado", label: "Abogado encargado", type: "select-abogados" },
    { name: "fecha_emplazamiento", label: "Fecha", type: "date" },
    { name: "juzgado", label: "Juzgado", type: "text" },
    { name: "actor", label: "Actor", type: "text" }
  ],
  penal: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "abogado_encargado", label: "Abogado encargado", type: "select-abogados" },
    { name: "juzgado", label: "Juzgado", type: "text" },
    { name: "actor", label: "Actor", type: "text" },
    { name: "demandado", label: "Demandado", type: "text" }
  ],
  agrario: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "abogado_encargado", label: "Abogado encargado", type: "select-abogados" },
    { name: "fecha_emplazamiento", label: "Fecha de emplazamiento", type: "date" },
    { name: "actor", label: "Actor", type: "text" }
  ],
  varios: [
    { name: "expediente", label: "Expediente", type: "text" },
    { name: "estado_procesal", label: "Estado procesal", type: "select", options: [["en_proceso", "En Proceso"], ["sin_asignar", "Sin Asignar"], ["asignado", "Asignado"], ["finalizado", "Finalizado"], ["sin_actividad", "Sin Actividad"]] },
    { name: "asunto", label: "Asunto", type: "text" },
    { name: "abogado_encargado", label: "Abogado encargado", type: "select-abogados" },
    { name: "fecha_emplazamiento", label: "Fecha recibido", type: "date" }
  ]
};

async function renderCampos(campos, contenedor, idPrefix = "") {
  contenedor.innerHTML = "";

  let abogados = [];

  const necesitaAbogados = campos.some(c => c.type === "select-abogados");

  if (necesitaAbogados) {
    try {
      const res = await fetch("http://localhost:3000/api/usuarios");
      const data = await res.json();

      if (data.success) {
        abogados = data.usuarios.filter(
          u => u.rol?.toUpperCase() === "ABOGADO"
        );
      }
    } catch (error) {
      console.error("Error cargando abogados:", error);
    }
  }

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

    } else if (campo.type === "select-abogados") {
      el = document.createElement("select");

      const opcionDefault = document.createElement("option");
      opcionDefault.value = "";
      opcionDefault.textContent = "Seleccione abogado";
      el.appendChild(opcionDefault);

      abogados.forEach(abogado => {
        const option = document.createElement("option");
        option.value = abogado.id;
        option.textContent = abogado.nombre;
        el.appendChild(option);
      });

    } else {
      el = document.createElement("input");
      el.type = campo.type;
    }

    el.name = campo.name;

    if (idPrefix) {
      el.id = idPrefix + campo.name;
    }

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
        registrarActividad("Nuevo caso creado.", "CASO-" + result.id); // ← ACTIVIDAD
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
        registrarActividad("Nuevo usuario creado.", idFormato); // ← ACTIVIDAD
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
        registrarActividad("Nuevo caso creado.", "CASO-" + result.id); // ← ACTIVIDAD
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
    limite: LIMITE,
    pagina: pagina,
    tipo: tipo,
    busqueda: busquedaActual,
    ...authQueryParams()
  });
  if (ordenarPrioridadAltaBaja) params.set("orden", "prioridad_desc");
  const url = `http://localhost:3000/api/casos?${params}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (!data.success) return;
    casos = (data.casos || []).map(normalizarCaso);
    tbody.innerHTML = casos.map(caso => `
      <tr data-id="${caso._numId}" data-tipo="${caso.tipo}">
        <td><span class="tag">${escapeHtml(caso.fecha)}</span></td>
        <td>${escapeHtml(caso.nombre)}</td>
        <td class="muted">${escapeHtml(caso.tipo)}</td>
        <td>${renderPrioridadBadge(caso.prioridad)}</td>
        <td>${escapeHtml(caso.estado)}</td>
        <td class="muted">${escapeHtml([caso.asignado, caso.asignadoExtra].filter(Boolean).join(" + ") || "Sin asignar")}</td>
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
  tipoActualGlobal = item.tipo;
  if (!item) return;
  casoActivoId = item._numId || (item._raw ? (item._raw.id || item._raw._id || item._raw.caso_id) : item.id);
  casoActivoTipo = item.tipoDb || normalizarTipoCasoDb(item.tipo || item._raw?.tipo || item._raw?.tipo_caso);
  casoActivoAbogadoEncargadoId = item.abogadoEncargadoId || "";
  casoActivoAbogadoColaboradorId = item.abogadoColaboradorId || "";
  setActiveView("v_casos", { scroll: false });
  document.getElementById("drawerTitle").textContent = item.id;
  document.getElementById("drawerSubtitle").textContent = `· ${item.tipo}`;
  document.getElementById("d_tipo").textContent = item.tipo;
  document.getElementById("d_prioridad").innerHTML = renderPrioridadBadge(item.prioridad);
  document.getElementById("d_estado").textContent = item.estado;
  document.getElementById("d_asignado").textContent = item.asignado;
  const abogadoExtraEl = document.getElementById("d_abogado_extra");
  if (abogadoExtraEl) abogadoExtraEl.textContent = item.asignadoExtra || "Sin abogado extra";
  document.getElementById("campoReasignar").style.display = "none";
  document.getElementById("d_reasignar").innerHTML = "";

  const btnEditar = document.getElementById("drawerBtnEditar");
  const btnGuardar = document.getElementById("drawerBtnGuardarCambios");
  const btnArchivar = document.getElementById("drawerBtnArchivar");
  const btnReasignar = document.getElementById("drawerBtnReasignar");

  if (btnEditar && btnGuardar && btnArchivar && btnReasignar) {
    if (sessionRol === "ADMIN") {
      btnEditar.style.display = "inline-block";
      btnGuardar.style.display = "none";
      btnArchivar.style.display = "inline-block";
      btnArchivar.textContent = item.estado === "Archivado" ? "Desarchivar" : "Archivar";
      btnReasignar.style.display = item.estado === "Archivado" ? "none" : "inline-block";
      btnReasignar.disabled = Boolean(item.abogadoColaboradorId);
      btnReasignar.textContent = item.abogadoColaboradorId ? "Reasignado" : "Reasignar";
      btnReasignar.classList.remove("primary");
      btnReasignar.onclick = activarReasignacionCaso;
    } else {
      btnEditar.style.display = "none";
      btnGuardar.style.display = "none";
      btnArchivar.style.display = "none";
      btnReasignar.style.display = "none";
    }
  }

  guardarCasoActivo({
    id: item.id,
    tipo: item.tipo,
    tipoDb: casoActivoTipo,
    prioridad: item.prioridad,
    estado: item.estado,
    asignado: item.asignado,
    asignadoExtra: item.asignadoExtra,
    abogadoEncargadoId: item.abogadoEncargadoId,
    abogadoColaboradorId: item.abogadoColaboradorId,
    _numId: casoActivoId
  });

  if (inputNuevaNota) inputNuevaNota.value = "";

  cargarNotas(casoActivoId);
  cargarDocumentos(casoActivoId);
  iniciarEventosUpload();

  mask.classList.add("show");
}

const btnEditarCaso = document.getElementById("drawerBtnEditar");
const btnGuardarCambios = document.getElementById("drawerBtnGuardarCambios");
const btnReasignarCaso = document.getElementById("drawerBtnReasignar");

async function activarEdicionCaso() {
  if (sessionRol !== "ADMIN") {
    showToast("No tienes permisos para editar.", "error");
    return;
  }

  const tipoActual = document.getElementById("d_tipo").textContent.trim();
  const prioridadActual = document.getElementById("d_prioridad").textContent.trim();
  const estadoActual = document.getElementById("d_estado").textContent.trim();

  if (estadoActual === "Archivado") {
    showToast("Este caso está archivado y no se puede editar.", "info");
    return;
  }
  const asignadoActual = document.getElementById("d_asignado").textContent.trim();

  const res = await fetch("http://localhost:3000/api/usuarios");
  const data = await res.json();

  const abogados = data.success
    ? data.usuarios.filter(u => u.rol?.toUpperCase() === "ABOGADO" && Number(u.activo) === 1)
    : [];

  document.getElementById("d_tipo").innerHTML = `
    <select id="edit_tipo">
      <option value="amparos" ${tipoActual === "Amparo" ? "selected" : ""}>Amparo</option>
      <option value="administrativos" ${tipoActual === "Administrativo" ? "selected" : ""}>Administrativo</option>
      <option value="laborales" ${tipoActual === "Laboral" ? "selected" : ""}>Laboral</option>
      <option value="civiles" ${tipoActual === "Civil" ? "selected" : ""}>Civil</option>
      <option value="mercantiles" ${tipoActual === "Mercantil" ? "selected" : ""}>Mercantil</option>
      <option value="penales" ${tipoActual === "Penal" ? "selected" : ""}>Penal</option>
      <option value="agrarios" ${tipoActual === "Agrario" ? "selected" : ""}>Agrario</option>
      <option value="exp_varios" ${tipoActual === "Varios" ? "selected" : ""}>Varios</option>
    </select>
  `;

  document.getElementById("d_prioridad").innerHTML = `
    <select id="edit_prioridad">
      <option value="Alta" ${prioridadActual === "Alta" ? "selected" : ""}>Alta</option>
      <option value="Media" ${prioridadActual === "Media" ? "selected" : ""}>Media</option>
      <option value="Baja" ${prioridadActual === "Baja" ? "selected" : ""}>Baja</option>
    </select>
  `;

  document.getElementById("d_estado").innerHTML = `
    <select id="edit_estado">
      <option value="en_proceso" ${estadoActual === "En proceso" ? "selected" : ""}>En proceso</option>
      <option value="sin_asignar" ${estadoActual === "Sin asignar" ? "selected" : ""}>Sin asignar</option>
      <option value="asignado" ${estadoActual === "Asignado" ? "selected" : ""}>Asignado</option>
      <option value="finalizado" ${estadoActual === "Finalizado" ? "selected" : ""}>Finalizado</option>
      <option value="sin_actividad" ${estadoActual === "Sin actividad" ? "selected" : ""}>Sin actividad</option>
    </select>
  `;

  document.getElementById("d_asignado").textContent = asignadoActual;

  document.getElementById("campoReasignar").style.display = "block";
  document.getElementById("d_reasignar").innerHTML = `
    <select id="edit_abogado">
      <option value="">Sin asignar</option>
      ${abogados.map(a => `
        <option value="${a.id}" ${a.nombre === asignadoActual ? "selected" : ""}>
          ${a.nombre}
        </option>
      `).join("")}
    </select>
  `;

  btnEditarCaso.style.display = "none";
  btnGuardarCambios.style.display = "inline-block";
  if (btnReasignarCaso) btnReasignarCaso.style.display = "none";
}

async function guardarCambiosCaso() {
  if (sessionRol !== "ADMIN") {
    showToast("No tienes permisos para guardar cambios.", "error");
    return;
  }

  if (!casoActivoId || !casoActivoTipo) {
    showToast("No hay caso seleccionado.", "error");
    return;
  }

  const prioridad = document.getElementById("edit_prioridad")?.value;
  const estado_procesal = document.getElementById("edit_estado")?.value;
  const abogado_encargado = document.getElementById("edit_abogado")?.value;

  try {
    const res = await fetch(
      `http://localhost:3000/api/casos/${casoActivoTipo}/${casoActivoId}/editar`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prioridad,
          estado_procesal,
          abogado_encargado,
          rol: sessionRol
        })
      }
    );

    const data = await res.json();

    if (data.success) {
      registrarActividad("Caso editado.", document.getElementById("drawerTitle")?.textContent || ""); // ← ACTIVIDAD
      showToast("Caso actualizado correctamente.", "success");
      await cargarCasos();
      closeDrawer();
    } else {
      showToast(data.mensaje || "No se pudieron guardar los cambios.", "error");
    }
  } catch (error) {
    console.error("Error guardando cambios:", error);
    showToast("Error al conectar con el servidor.", "error");
  }
}

async function activarReasignacionCaso() {
  if (sessionRol !== "ADMIN") {
    showToast("No tienes permisos para reasignar.", "error");
    return;
  }

  if (!casoActivoId || !casoActivoTipo) {
    showToast("No hay caso seleccionado.", "error");
    return;
  }

  if (casoActivoAbogadoColaboradorId) {
    showToast("Este caso ya tiene un abogado extra.", "info");
    return;
  }

  if (!casoActivoAbogadoEncargadoId) {
    showToast("Primero asigna un abogado encargado.", "info");
    return;
  }

  const campo = document.getElementById("campoReasignar");
  const contenedor = document.getElementById("d_reasignar");
  if (!campo || !contenedor || !btnReasignarCaso) return;

  try {
    const res = await fetch("http://localhost:3000/api/usuarios");
    const data = await res.json();
    const abogados = data.success
      ? data.usuarios.filter(u =>
        u.rol?.toUpperCase() === "ABOGADO" &&
        Number(u.activo) === 1 &&
        String(u.id) !== String(casoActivoAbogadoEncargadoId)
      )
      : [];

    if (!abogados.length) {
      showToast("No hay abogados disponibles para reasignar.", "info");
      return;
    }

    campo.style.display = "block";
    contenedor.innerHTML = `
      <select id="selectReasignarAbogado">
        <option value="">Seleccione abogado</option>
        ${abogados.map(a => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.nombre || a.username)}</option>`).join("")}
      </select>
    `;

    btnReasignarCaso.textContent = "Guardar reasignación";
    btnReasignarCaso.classList.add("primary");
    btnReasignarCaso.onclick = guardarReasignacionCaso;
  } catch (error) {
    console.error("Error cargando abogados:", error);
    showToast("No se pudieron cargar los abogados.", "error");
  }
}

async function guardarReasignacionCaso() {
  const select = document.getElementById("selectReasignarAbogado");
  const abogado_colaborador = select?.value;
  if (!abogado_colaborador) {
    showToast("Selecciona un abogado.", "info");
    return;
  }

  try {
    const res = await fetch(
      `http://localhost:3000/api/casos/${casoActivoTipo}/${casoActivoId}/reasignar`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abogado_colaborador,
          rol: sessionRol
        })
      }
    );

    const data = await res.json();
    if (data.success) {
      registrarActividad("Caso reasignado.", document.getElementById("drawerTitle")?.textContent || ""); // ← ACTIVIDAD
      showToast("Caso reasignado correctamente.", "success");
      await cargarCasos();
      closeDrawer();
    } else {
      showToast(data.mensaje || "No se pudo reasignar el caso.", "error");
    }
  } catch (error) {
    console.error("Error reasignando caso:", error);
    showToast("Error al conectar con el servidor.", "error");
  }
}

const btnArchivarCaso = document.getElementById("drawerBtnArchivar");

async function archivarCaso() {
  if (sessionRol !== "ADMIN") {
    showToast("No tienes permisos para modificar archivo.", "error");
    return;
  }

  if (!casoActivoId || !casoActivoTipo) {
    showToast("No hay caso seleccionado.", "error");
    return;
  }

  const estadoActual = document.getElementById("d_estado")?.textContent.trim();
  const estaArchivado = estadoActual === "Archivado";

  const confirmar = await showConfirmDialog({
    title: estaArchivado ? "Desarchivar caso" : "Archivar caso",
    message: estaArchivado
      ? "¿Deseas desarchivar este caso?"
      : "¿Deseas archivar este caso?",
    confirmText: estaArchivado ? "Desarchivar" : "Archivar",
    cancelText: "Cancelar",
    variant: estaArchivado ? "primary" : "danger"
  });

  if (!confirmar) return;

  const accion = estaArchivado ? "desarchivar" : "archivar";

  try {
    const res = await fetch(
      `http://localhost:3000/api/casos/${casoActivoTipo}/${casoActivoId}/${accion}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol: sessionRol })
      }
    );

    const data = await res.json();

    if (data.success) {
      registrarActividad( // ← ACTIVIDAD
        estaArchivado ? "Caso desarchivado." : "Caso archivado.",
        document.getElementById("drawerTitle")?.textContent || ""
      );
      showToast(
        estaArchivado ? "Caso desarchivado correctamente." : "Caso archivado correctamente.",
        "success"
      );
      await cargarCasos();
      closeDrawer();
    } else {
      showToast(data.mensaje || "No se pudo completar la acción.", "error");
    }
  } catch (error) {
    console.error("Error modificando archivo:", error);
    showToast("Error al conectar con el servidor.", "error");
  }
}

if (btnArchivarCaso) {
  btnArchivarCaso.addEventListener("click", archivarCaso);
}

if (btnEditarCaso) {
  btnEditarCaso.addEventListener("click", activarEdicionCaso);
}

if (btnGuardarCambios) {
  btnGuardarCambios.addEventListener("click", guardarCambiosCaso);
}

function closeDrawer() {
  casoActivoId = null;
  casoActivoTipo = null;
  casoActivoAbogadoEncargadoId = "";
  casoActivoAbogadoColaboradorId = "";
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

if (btnFiltroPrioridad) {
  btnFiltroPrioridad.addEventListener("click", () => {
    ordenarPrioridadAltaBaja = !ordenarPrioridadAltaBaja;
    btnFiltroPrioridad.classList.toggle("active", ordenarPrioridadAltaBaja);
    btnFiltroPrioridad.textContent = ordenarPrioridadAltaBaja ? "Prioridad alta-baja" : "Prioridad";
    paginaActual = 1;
    renderTable(1);
  });
}

if (closeBtn) {
  closeBtn.addEventListener("click", closeDrawer);
}

const drawerPanel = document.querySelector('.drawer');
if (drawerPanel) {
  drawerPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

if (mask) {
  mask.addEventListener("click", closeDrawer);
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
    return;
  }
  const userDrawerMaskEl = document.getElementById("userDrawerMask");
  if (userDrawerMaskEl && userDrawerMaskEl.classList.contains("show")) {
    closeUserDrawer();
    return;
  }
  closeDrawer();
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
    // ← ACTIVIDAD: registrar cierre de sesión antes de limpiar localStorage
    const nombreSesion = usuarioSesion?.nombre || usuarioSesion?.username || "Usuario";
    registrarActividad(`Cierre de sesión: ${nombreSesion}.`, "");
    localStorage.removeItem("usuario");
    window.location.href = "index.html";
  });
}

// ========== NOTAS DEL CASO ==========
let casoActivoId = null;
let casoActivoTipo = null;
let tipoActualGlobal = null;
let casoActivoAbogadoEncargadoId = "";
let casoActivoAbogadoColaboradorId = "";

const btnGuardarNota = document.getElementById("btnGuardarNota");
const btnLimpiarNota = document.getElementById("btnLimpiarNota");
const inputNuevaNota = document.getElementById("inputNuevaNota");
const listaNotas = document.getElementById("listaNotas");

function obtenerNotaId(nota) {
  return nota?.id || nota?.nota_id || nota?._id || nota?.notaId || "";
}

function puedeEliminarNotas() {
  return ["ADMIN", "SECRETARIA"].includes(sessionRol);
}

function normalizarTextoComparacion(value) {
  return String(value || "").trim().toLowerCase();
}

function esPropietarioNota(nota) {
  const autor = normalizarTextoComparacion(nota?.usuario);
  const usuariosSesion = [sessionUsername, sessionNombre].map(normalizarTextoComparacion).filter(Boolean);
  return Boolean(autor && usuariosSesion.includes(autor));
}

function buscarNotaCard(notaId) {
  return Array.from(listaNotas?.querySelectorAll(".noteCard") || [])
    .find(card => String(card.dataset.noteId) === String(notaId));
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
    const textoPlano = n.texto || n.nota || n.contenido || "";
    const contenido = formatearTextoHtml(textoPlano);
    const acciones = [
      notaId && esPropietarioNota(n)
        ? `<button type="button" class="btn noteEditBtn" data-note-action="edit" data-note-id="${escapeHtml(notaId)}">Editar</button>`
        : "",
      notaId && puedeEliminarNotas()
        ? `<button type="button" class="btn noteDeleteBtn" data-note-action="delete" data-note-id="${escapeHtml(notaId)}">Eliminar</button>`
        : ""
    ].filter(Boolean).join("");

    return `
      <div class="nota-item card noteCard" data-note-id="${escapeHtml(notaId)}" data-note-text="${escapeHtml(textoPlano)}" data-note-owner="${escapeHtml(n.usuario || "")}" style="box-shadow:none; padding: 12px 14px;">
        <div class="noteMetaRow">
          <div class="small muted">${meta || "Sistema"}</div>
          <div class="noteActions">${acciones}</div>
        </div>
        <div class="noteText" style="margin-top:4px;">${contenido}</div>
      </div>
    `;
  }).join("");

  listaNotas.querySelectorAll("[data-note-action='delete']").forEach(button => {
    button.addEventListener("click", () => {
      eliminarNota(button.dataset.noteId);
    });
  });

  listaNotas.querySelectorAll("[data-note-action='edit']").forEach(button => {
    button.addEventListener("click", () => {
      activarEdicionNota(button.dataset.noteId);
    });
  });
}

function activarEdicionNota(notaId) {
  const card = buscarNotaCard(notaId);
  if (!card) return;
  const textoActual = card.dataset.noteText || "";
  const noteText = card.querySelector(".noteText");
  const actions = card.querySelector(".noteActions");
  if (!noteText || !actions) return;

  noteText.innerHTML = `
    <textarea class="in textarea noteEditInput" style="resize:vertical;">${escapeHtml(textoActual)}</textarea>
  `;
  actions.innerHTML = `
    <button type="button" class="btn primary noteSaveBtn" data-note-action="save" data-note-id="${escapeHtml(notaId)}">Guardar</button>
    <button type="button" class="btn noteCancelBtn" data-note-action="cancel" data-note-id="${escapeHtml(notaId)}">Cancelar</button>
  `;

  actions.querySelector("[data-note-action='save']").addEventListener("click", () => guardarEdicionNota(notaId));
  actions.querySelector("[data-note-action='cancel']").addEventListener("click", () => cargarNotas(casoActivoId));
  const input = noteText.querySelector(".noteEditInput");
  if (input) input.focus();
}

async function guardarEdicionNota(notaId) {
  const card = buscarNotaCard(notaId);
  const input = card?.querySelector(".noteEditInput");
  const texto = input?.value.trim();
  if (!texto) {
    showToast("La nota no puede quedar vacía.", "info");
    return;
  }

  try {
    const res = await fetch(
      `http://localhost:3000/api/casos/${encodeURIComponent(casoActivoId)}/notas/${encodeURIComponent(notaId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto,
          tipo_caso: casoActivoTipo,
          rol: sessionRol,
          usuario_id: sessionUsuarioId,
          usuario: sessionUsername || sessionNombre
        })
      }
    );
    const data = await obtenerJsonSeguro(res);

    if (res.ok && (!data || data.success !== false)) {
      showToast("Nota actualizada correctamente.", "success");
      cargarNotas(casoActivoId);
      return;
    }

    showToast(data?.mensaje || "No se pudo actualizar la nota.", "error");
  } catch {
    showToast("Error al conectar con el servidor.", "error");
  }
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

  const params = new URLSearchParams({ tipo_caso: casoActivoTipo, ...authQueryParams() });
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
    const params = new URLSearchParams({ tipo_caso: casoActivoTipo, ...authQueryParams() });
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
      const res = await fetch(`http://localhost:3000/api/casos/${casoActivoId}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto,
          usuario: sessionUsername || sessionNombre || "Sistema",
          tipo_caso: casoActivoTipo,
          rol: sessionRol,
          usuario_id: sessionUsuarioId
        })
      });

      if (res.ok) {
        inputNuevaNota.value = "";
        cargarNotas(casoActivoId);
        registrarActividad("Se agregó una nota.", document.getElementById("drawerTitle")?.textContent || ""); // ← ACTIVIDAD
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

// ========== ACTIVIDAD RECIENTE ==========
const ACTIVIDAD_KEY = "projuridico.actividad";
const MAX_ACTIVIDAD = 20;

function registrarActividad(mensaje, tag) {
  const actividades = obtenerActividades();
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const fecha = ahora.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  actividades.unshift({ mensaje, tag: tag || "", hora, fecha, timestamp: ahora.getTime() });
  if (actividades.length > MAX_ACTIVIDAD) actividades.pop();
  localStorage.setItem(ACTIVIDAD_KEY, JSON.stringify(actividades));
  renderActividad();
}

function obtenerActividades() {
  try { return JSON.parse(localStorage.getItem(ACTIVIDAD_KEY) || "[]"); }
  catch { return []; }
}

function renderActividad() {
  const contenedor = document.querySelector("#v_dashboard .card:nth-child(2) .bd .row");
  if (!contenedor) return;
  const actividades = obtenerActividades();
  if (!actividades.length) {
    contenedor.innerHTML = `<div class="small muted">Sin actividad registrada.</div>`;
    return;
  }
  const hoy = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
  contenedor.innerHTML = actividades.map(a => {
    const etiqueta = a.tag ? `<span class="tag">${escapeHtml(a.tag)}</span>` : "";
    const cuandoFecha = a.fecha === hoy ? "Hoy" : a.fecha;
    return `
      <div class="field">
        <div class="small">${escapeHtml(cuandoFecha)} ${escapeHtml(a.hora)}${a.tag ? " · " : ""}${etiqueta}</div>
        <div style="margin-top: 6px;">${escapeHtml(a.mensaje)}</div>
      </div>`;
  }).join("");
}

// ========== INICIO ==========
cargarCasos();
cargarUsuarios();
renderActividad(); // ← carga el historial guardado al abrir la app

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
                    overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(doc.nombre_original)}">
          ${escapeHtml(doc.nombre_original)}
        </div>
        <div class="small muted">
          ${formatBytes(doc.tamaño)} · ${escapeHtml(doc.subido_por || "Sistema")} · ${escapeHtml(doc.fecha || "")}
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
    const params = new URLSearchParams(authQueryParams());
    const res = await fetch(`http://localhost:3000/api/documentos/descargar/${docId}?${params}`);
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
    const params = new URLSearchParams(authQueryParams());
    const res = await fetch(`http://localhost:3000/api/documentos/${docId}?${params}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      registrarActividad("Documento eliminado.", document.getElementById("drawerTitle")?.textContent || ""); // ← ACTIVIDAD
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
    const params = new URLSearchParams({ tipo_caso: casoActivoTipo, ...authQueryParams() });
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
  let subidos = 0;
  let errores = 0;
  for (const archivo of archivos) {
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("subido_por", sessionUsername || sessionNombre || "Usuario");
    fd.append("tipo_caso", casoActivoTipo);
    fd.append("rol", sessionRol);
    fd.append("usuario_id", sessionUsuarioId);
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


  if (subidos > 0) {
    registrarActividad(
      errores === 0
        ? `${subidos} archivo agregado.`
        : `${subidos - errores} archivo(s) adjuntado(s) (algunos fallaron).`,
      document.getElementById("drawerTitle")?.textContent || ""
    );
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

async function cargarUsuarios() {
  const tbody = document.getElementById("usuariosTbody");
  if (!tbody) return;

  try {
    const res = await fetch("http://localhost:3000/api/usuarios");
    const data = await res.json();

    if (!data.success || !data.usuarios.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted"
        style="text-align:center; padding:24px;">Sin usuarios registrados.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    data.usuarios.forEach(u => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(u.nombre || "—")}</td>
        <td class="muted">${escapeHtml(u.rol || "—")}</td>
        <td class="muted">${escapeHtml(u.email || "—")}</td>
        <td>${u.activo ? "Activo" : "Inactivo"}</td>
      `;

      tr.addEventListener("dblclick", () => {
        openUserDrawer(u);
      });

      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Error cargando usuarios:", err);
    const tbody2 = document.getElementById("usuariosTbody");
    if (tbody2) {
      tbody2.innerHTML = `<tr><td colspan="4" class="muted"
        style="text-align:center; padding:24px;">Error al cargar usuarios.</td></tr>`;
    }
  }
}

// ========== DRAWER DE USUARIO ==========
let usuarioActivoId = null;
let usuarioActivoData = null;

const userDrawerMask = document.getElementById("userDrawerMask");
const btnCerrarUserDrawer = document.getElementById("btnCerrarUserDrawer");
const userDrawerBtnEditar = document.getElementById("userDrawerBtnEditar");
const userDrawerBtnGuardar = document.getElementById("userDrawerBtnGuardar");
const userDrawerBtnCancelarEdicion = document.getElementById("userDrawerBtnCancelarEdicion");

function mostrarUsuarioEnDrawer(u) {
  document.getElementById("userDrawerTitle").textContent = u.nombre || "Sin nombre";
  document.getElementById("userDrawerSubtitle").textContent = `· ${u.rol || ""}`;
  document.getElementById("ud_nombre").textContent = u.nombre || "—";
  document.getElementById("ud_username").textContent = u.username || "—";
  document.getElementById("ud_email").textContent = u.email || "—";
  document.getElementById("ud_rol").textContent = u.rol || "—";
  document.getElementById("ud_activo").textContent = u.activo ? "Activo" : "Inactivo";
  document.getElementById("ud_passwordField").style.display = "none";
  const ud_pw = document.getElementById("ud_password");
  if (ud_pw) ud_pw.value = "";
}

function openUserDrawer(usuario) {
  if (!usuario || !userDrawerMask) return;
  usuarioActivoId = usuario.id;
  usuarioActivoData = { ...usuario };

  mostrarUsuarioEnDrawer(usuario);

  if (userDrawerBtnEditar) {
    userDrawerBtnEditar.style.display = sessionRol === "ADMIN" ? "inline-block" : "none";
  }
  if (userDrawerBtnGuardar) userDrawerBtnGuardar.style.display = "none";
  if (userDrawerBtnCancelarEdicion) userDrawerBtnCancelarEdicion.style.display = "none";

  userDrawerMask.classList.add("show");
}

function closeUserDrawer() {
  usuarioActivoId = null;
  usuarioActivoData = null;
  if (userDrawerMask) userDrawerMask.classList.remove("show");
}

function activarEdicionUsuario() {
  if (sessionRol !== "ADMIN") {
    showToast("No tienes permisos para editar.", "error");
    return;
  }
  const u = usuarioActivoData;
  if (!u) return;

  document.getElementById("ud_nombre").innerHTML =
    `<input type="text" id="edit_u_nombre" value="${escapeHtml(u.nombre || "")}" placeholder="Nombre completo" style="width:100%;">`;

  document.getElementById("ud_username").innerHTML =
    `<input type="text" id="edit_u_username" value="${escapeHtml(u.username || "")}" placeholder="Usuario" style="width:100%;">`;

  document.getElementById("ud_email").innerHTML =
    `<input type="email" id="edit_u_email" value="${escapeHtml(u.email || "")}" placeholder="Correo electrónico" style="width:100%;">`;

  document.getElementById("ud_rol").innerHTML = `
    <select id="edit_u_rol" style="width:100%;">
      <option value="ADMIN" ${u.rol === "ADMIN" ? "selected" : ""}>Administrador</option>
      <option value="ABOGADO" ${u.rol === "ABOGADO" ? "selected" : ""}>Abogado</option>
      <option value="SECRETARIA" ${u.rol === "SECRETARIA" ? "selected" : ""}>Secretaria</option>
    </select>
  `;

  document.getElementById("ud_activo").innerHTML = `
    <select id="edit_u_activo" style="width:100%;">
      <option value="1" ${u.activo ? "selected" : ""}>Activo</option>
      <option value="0" ${!u.activo ? "selected" : ""}>Inactivo</option>
    </select>
  `;

  document.getElementById("ud_passwordField").style.display = "block";
  const ud_pw = document.getElementById("ud_password");
  if (ud_pw) ud_pw.value = "";

  if (userDrawerBtnEditar) userDrawerBtnEditar.style.display = "none";
  if (userDrawerBtnGuardar) userDrawerBtnGuardar.style.display = "inline-block";
  if (userDrawerBtnCancelarEdicion) userDrawerBtnCancelarEdicion.style.display = "inline-block";
}

function cancelarEdicionUsuario() {
  if (!usuarioActivoData) return;
  mostrarUsuarioEnDrawer(usuarioActivoData);
  if (userDrawerBtnEditar) userDrawerBtnEditar.style.display = sessionRol === "ADMIN" ? "inline-block" : "none";
  if (userDrawerBtnGuardar) userDrawerBtnGuardar.style.display = "none";
  if (userDrawerBtnCancelarEdicion) userDrawerBtnCancelarEdicion.style.display = "none";
}

async function guardarCambiosUsuario() {
  if (sessionRol !== "ADMIN") {
    showToast("No tienes permisos para guardar cambios.", "error");
    return;
  }
  if (!usuarioActivoId) {
    showToast("No hay usuario seleccionado.", "error");
    return;
  }

  const nombre = document.getElementById("edit_u_nombre")?.value.trim();
  const username = document.getElementById("edit_u_username")?.value.trim();
  const email = document.getElementById("edit_u_email")?.value.trim();
  const rol = document.getElementById("edit_u_rol")?.value;
  const activo = document.getElementById("edit_u_activo")?.value;
  const password = document.getElementById("ud_password")?.value;

  if (!nombre || !username) {
    showToast("Nombre y usuario son obligatorios.", "error");
    return;
  }

  const payload = { nombre, username, email, rol, activo: Number(activo) };
  if (password) payload.password = password;

  if (userDrawerBtnGuardar) {
    userDrawerBtnGuardar.disabled = true;
    userDrawerBtnGuardar.textContent = "Guardando...";
  }

  try {
    const res = await fetch(`http://localhost:3000/api/usuarios/${usuarioActivoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok && data.success) {
      registrarActividad("Usuario editado.", `USR-${String(usuarioActivoId).padStart(4, "0")}`); // ← ACTIVIDAD
      showToast("Usuario actualizado correctamente.", "success");
      usuarioActivoData = { ...usuarioActivoData, ...payload };
      mostrarUsuarioEnDrawer(usuarioActivoData);
      if (userDrawerBtnEditar) userDrawerBtnEditar.style.display = "inline-block";
      if (userDrawerBtnGuardar) userDrawerBtnGuardar.style.display = "none";
      if (userDrawerBtnCancelarEdicion) userDrawerBtnCancelarEdicion.style.display = "none";
      cargarUsuarios();
    } else {
      showToast(data.mensaje || "No se pudo guardar los cambios.", "error");
    }
  } catch {
    showToast("Error al conectar con el servidor.", "error");
  } finally {
    if (userDrawerBtnGuardar) {
      userDrawerBtnGuardar.disabled = false;
      userDrawerBtnGuardar.textContent = "Guardar cambios";
    }
  }
}

// Eventos del drawer de usuario
if (btnCerrarUserDrawer) {
  btnCerrarUserDrawer.addEventListener("click", closeUserDrawer);
}

if (userDrawerBtnEditar) {
  userDrawerBtnEditar.addEventListener("click", activarEdicionUsuario);
}

if (userDrawerBtnGuardar) {
  userDrawerBtnGuardar.addEventListener("click", guardarCambiosUsuario);
}

if (userDrawerBtnCancelarEdicion) {
  userDrawerBtnCancelarEdicion.addEventListener("click", cancelarEdicionUsuario);
}

if (userDrawerMask) {
  const userDrawerPanel = userDrawerMask.querySelector(".drawer");
  if (userDrawerPanel) {
    userDrawerPanel.addEventListener("click", e => e.stopPropagation());
  }
  userDrawerMask.addEventListener("click", closeUserDrawer);
}

restaurarEstadoUI();
mostrarToastPendiente(STORAGE_KEYS.dashboardToast);

// ========== RECORDATORIOS ==========

// Carga abogados en el select del form
async function cargarAbogadosSelect() {
  const select = document.getElementById("rec_destinatario");
  if (!select) return;

  try {
    const res = await fetch("http://localhost:3000/api/usuarios");
    const data = await res.json();
    if (!data.success) return;

    // Admin y Secretaria pueden mandar a cualquiera
    // Abogado solo puede mandarse a sí mismo
    const destinatarios = sessionRol === 'ADMIN' || sessionRol === 'SECRETARIA'
      ? data.usuarios
      : data.usuarios.filter(u => String(u.id) === sessionUsuarioId);

    select.innerHTML = destinatarios.map(u =>
      `<option value="${u.id}">${u.nombre || u.username} (${u.rol})</option>`
    ).join("");
  } catch (err) {
    console.error("Error cargando abogados:", err);
  }
}

async function cargarRecordatorios() {
  const tbody = document.getElementById("recordatoriosTbody");
  if (!tbody) return;

  try {
    const res = await fetch(
      `http://localhost:3000/api/recordatorios?usuario_id=${sessionUsuarioId}&rol=${sessionRol}`
    );
    const data = await res.json();

    if (!data.success || !data.recordatorios.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="muted" 
        style="text-align:center; padding:24px;">Sin recordatorios.</td></tr>`;
      return;
    }

  const hoy = new Date().toLocaleDateString('en-CA'); // formato YYYY-MM-DD en zona local

    tbody.innerHTML = data.recordatorios.map(r => {
      const vencido = r.fecha_aviso && r.fecha_aviso.slice(0, 10) < hoy && !r.visto;
      const esHoy = r.fecha_aviso && r.fecha_aviso.slice(0, 10) === hoy;
      const caso = r.caso_tipo && r.caso_id
        ? `<span class="tag">${r.caso_tipo.toUpperCase()}-${r.caso_id}</span>`
        : `<span class="muted">—</span>`;
      const estado = r.visto
        ? `<span class="pill">Visto</span>`
        : vencido
          ? `<span class="pill" style="background:#fee2e2;color:#dc2626;">Vencido</span>`
          : esHoy
            ? `<span class="pill" style="background:#fef9c3;color:#ca8a04;">Hoy</span>`
            : `<span class="pill" style="background:#f0fdf4;color:#16a34a;">Pendiente</span>`;

      // Muestra quién lo creó si eres el destinatario
      const creador = r.nombre_creador
        ? `<div class="small muted" style="margin-top:2px;">De: ${r.nombre_creador}</div>`
        : "";

      return `
        <tr>
          <td class="muted">${r.fecha_aviso ? r.fecha_aviso.slice(0, 10) : "—"}</td>
          <td>${r.titulo}${creador}</td>
          <td>${caso}</td>
          <td>${estado}</td>
          <td>
            ${!r.visto ? `<button class="btn" onclick="marcarVisto(${r.id})">✓</button>` : ""}
            <button class="btn" onclick="eliminarRecordatorio(${r.id})" 
              style="margin-left:4px;">✕</button>
          </td>
        </tr>
      `;
    }).join("");

  } catch (err) {
    console.error("Error cargando recordatorios:", err);
  }
}

async function marcarVisto(id) {
  await fetch(`http://localhost:3000/api/recordatorios/${id}/visto`, { method: "PATCH" });
  cargarRecordatorios();
}

async function eliminarRecordatorio(id) {
  const confirmado = await showConfirmDialog({
    title: "Eliminar recordatorio",
    message: "¿Estás seguro de que deseas eliminar este recordatorio?",
    confirmText: "Eliminar",
    cancelText: "Cancelar",
    variant: "danger"
  });
  if (!confirmado) return;
  await fetch(`http://localhost:3000/api/recordatorios/${id}`, { method: "DELETE" });
  showToast("Recordatorio eliminado.", "success");
  cargarRecordatorios();
}
async function verificarRecordatorios() {
  try {
    const res = await fetch(
      `http://localhost:3000/api/recordatorios/hoy?usuario_id=${sessionUsuarioId}&rol=${sessionRol}`
    );
    const data = await res.json();
    if (!data.success || !data.recordatorios.length) return;
    data.recordatorios.forEach((rec, i) => {
      setTimeout(() => mostrarToastRecordatorio(rec), i * 1500);
    });
  } catch (err) {
    console.error("Error verificando recordatorios:", err);
  }
}

function mostrarToastRecordatorio(rec) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    background: var(--bg2, #fff); border: 1px solid var(--line, #e0e0e0);
    border-left: 4px solid #f59e0b;
    border-radius: 8px; padding: 14px 18px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    min-width: 280px; max-width: 360px;
    z-index: 9999; cursor: pointer;
    animation: slideIn 0.3s ease;
  `;
  toast.innerHTML = `
    <div style="font-size:11px;color:#f59e0b;font-weight:600;margin-bottom:4px;">
      🔔 RECORDATORIO ${rec.caso_tipo ? `· ${rec.caso_tipo.toUpperCase()}-${rec.caso_id}` : ""}
    </div>
    <div style="font-size:14px;font-weight:600;margin-bottom:2px;">${rec.titulo}</div>
    ${rec.descripcion ? `<div style="font-size:12px;opacity:0.7;">${rec.descripcion}</div>` : ""}
    <div style="font-size:11px;opacity:0.5;margin-top:6px;">Clic para marcar como visto</div>
  `;
  // DESPUÉS:
  toast.addEventListener("click", async () => {
    if (!rec.automatico) {
      await fetch(`http://localhost:3000/api/recordatorios/${rec.id}/visto`, { method: "PATCH" });
      cargarRecordatorios();
    }
    toast.style.animation = "fadeOut 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.style.animation = "fadeOut 0.3s ease forwards";
      setTimeout(() => toast.remove(), 300);
    }
  }, 8000);
}

// Variable en memoria — se resetea con cada carga de página
const _toastsAutoMostrados = new Set();

async function verificarRecordatoriosAutomaticos() {
  try {
    const res = await fetch(
      `http://localhost:3000/api/recordatorios/automaticos?usuario_id=${sessionUsuarioId}&rol=${sessionRol}&username=${sessionUsername}`
    );
    const data = await res.json();

    console.log("usuario_id enviado:", sessionUsuarioId);
    console.log("casos recibidos:", data.casos);
    data.casos.forEach(c => console.log("abogado_encargado:", c.abogado_encargado, "tipo:", typeof c.abogado_encargado));

    if (!data.success || !data.casos.length) return;

    data.casos.forEach((caso, i) => {
      const key = `${caso.caso_tipo}-${caso.id}`;
      if (_toastsAutoMostrados.has(key)) return;

      setTimeout(() => {
        mostrarToastRecordatorio({
          id: null,
          caso_tipo: caso.caso_tipo,
          caso_id: caso.id,
          titulo: `Vencimiento hoy: ${caso.asunto || caso.expediente || "Sin nombre"}`,
          descripcion: `Expediente: ${caso.expediente || "—"}`,
          automatico: true
        });
        _toastsAutoMostrados.add(key);
      }, i * 1500);
    });

  } catch (err) {
    console.error("Error verificando recordatorios automáticos:", err);
  }
}

// Form
const formRecordatorio = document.getElementById("formRecordatorio");
if (formRecordatorio) {
  formRecordatorio.addEventListener("submit", async (e) => {
    e.preventDefault();
    const datos = {
      titulo: document.getElementById("rec_titulo").value.trim(),
      fecha_aviso: document.getElementById("rec_fecha").value,
      caso_tipo: document.getElementById("rec_caso_tipo").value || null,
      caso_id: document.getElementById("rec_caso_id").value || null,
      descripcion: document.getElementById("rec_descripcion").value.trim(),
      usuario_id: sessionUsuarioId,
      destinatario_id: document.getElementById("rec_destinatario").value || sessionUsuarioId
    };
    if (!datos.titulo || !datos.fecha_aviso) {
      alert("Título y fecha son obligatorios."); return;
    }
    try {
      const res = await fetch("http://localhost:3000/api/recordatorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos)
      });
      const result = await res.json();
      if (result.success) {
        alert("✅ Recordatorio guardado.");
        formRecordatorio.reset();
        cargarRecordatorios();
      } else {
        alert("❌ " + result.mensaje);
      }
    } catch (err) {
      alert("❌ No se pudo conectar con el servidor.");
    }
  });
}

const btnLimpiarRecordatorio = document.getElementById("btnLimpiarRecordatorio");
if (btnLimpiarRecordatorio) {
  btnLimpiarRecordatorio.addEventListener("click", () => formRecordatorio.reset());
}

const btnNuevoRecordatorio = document.getElementById("btnNuevoRecordatorio");
if (btnNuevoRecordatorio) {
  btnNuevoRecordatorio.addEventListener("click", () => {
    document.getElementById("recordatorioDetails").open = true;
    document.getElementById("recordatorioDetails").scrollIntoView({ behavior: "smooth" });
  });
}

cargarAbogadosSelect();
cargarRecordatorios();
verificarRecordatorios();
verificarRecordatoriosAutomaticos();
setInterval(verificarRecordatorios, 5 * 60 * 1000);
setInterval(verificarRecordatoriosAutomaticos, 5 * 60 * 1000);