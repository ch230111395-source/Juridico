const loginForm = document.getElementById("loginForm");
const usuarioInput = document.getElementById("usuario");
const contrasenaInput = document.getElementById("contrasena");

loginForm.addEventListener("submit", login);

async function login(event) {
  event.preventDefault();

  const usuario = usuarioInput.value.trim();
  const contrasena = contrasenaInput.value.trim();

  if (!usuario || !contrasena) {
    alert("Completa todos los campos.");
    return;
  }

/*  if (usuario === "administrador" && contrasena === "1234") {
    const usuarioDemo = {
      username: "admin",
      rol: "ADMIN"
    };
                                                                      ---------Usuario de prueba
    localStorage.setItem("usuario", JSON.stringify(usuarioDemo));
    alert("Acceso concedido en modo de prueba.");
    window.location.href = "dashboard.html";
    return;
  } */

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
      alert(data.mensaje || "No fue posible iniciar sesión.");
      return;
    }

    if (data.success) {
      localStorage.setItem("usuario", JSON.stringify(data.usuario));
      alert(data.mensaje || "Acceso concedido.");
      window.location.href = "dashboard.html";
    } else {
      alert(data.mensaje || "Usuario o contraseña incorrectos.");
    }
  } catch (error) {
    console.error(error);
    alert("Error al conectar con el servidor.");
  }
}