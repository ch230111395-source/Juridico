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
  document.getElementById("pref_tipo").textContent = tipo === "Todos" ? "(selecciona un tipo)" : tipo;
  document.getElementById("pref_prioridad").textContent = preset.prioridad;
  document.getElementById("pref_estado").textContent = preset.estado;
  document.getElementById("pref_asignado").textContent = preset.asignado;
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