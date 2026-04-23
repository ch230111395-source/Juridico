const loginForm = document.getElementById("loginForm");
const usuarioInput = document.getElementById("usuario");
const contrasenaInput = document.getElementById("contrasena");
const DASHBOARD_TOAST_KEY = "projuridico.dashboardToast";
const LOGIN_TOAST_KEY = "projuridico.loginToast";
let toastContainer = null;

loginForm.addEventListener("submit", login);
mostrarToastPendiente();

function obtenerToastContainer() {
  if (toastContainer && document.body.contains(toastContainer)) return toastContainer;

  toastContainer = document.createElement("div");
  toastContainer.className = "toastContainer";
  toastContainer.setAttribute("aria-live", "polite");
  toastContainer.setAttribute("aria-atomic", "true");
  document.body.appendChild(toastContainer);
  return toastContainer;
}

function showToast(message, type = "info", duration = 3200) {
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

function mostrarToastPendiente() {
  try {
    const raw = sessionStorage.getItem(LOGIN_TOAST_KEY);
    if (!raw) return;
    sessionStorage.removeItem(LOGIN_TOAST_KEY);
    const payload = JSON.parse(raw);
    if (payload?.message) {
      showToast(payload.message, payload.type || "info");
    }
  } catch {
    sessionStorage.removeItem(LOGIN_TOAST_KEY);
  }
}

async function login(event) {
  event.preventDefault();

  const usuario = usuarioInput.value.trim();
  const contrasena = contrasenaInput.value.trim();

  if (!usuario || !contrasena) {
    showToast("Completa todos los campos.", "info");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        usuario,
        password: contrasena
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      showToast(data.mensaje || "No fue posible iniciar sesión.", "error");
      return;
    }

    if (data.success) {
      localStorage.setItem("usuario", JSON.stringify(data.usuario));
      sessionStorage.setItem(DASHBOARD_TOAST_KEY, JSON.stringify({
        message: data.mensaje || "Acceso concedido.",
        type: "success"
      }));
      window.location.href = "dashboard.html";
    } else {
      showToast(data.mensaje || "Usuario o contraseña incorrectos.", "error");
    }
  } catch (error) {
    console.error(error);
    showToast("Error al conectar con el servidor.", "error");
  }
}
