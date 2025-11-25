```javascript
let pyodideReady = false;
let pyodide;

async function loadPyodideAndPackages() {
  pyodide = await loadPyodide();
  pyodideReady = true;
}
loadPyodideAndPackages();

async function runPythonCode() {
  if (!pyodideReady) {
    alert("Cargando intérprete Python...");
    return;
  }

  const pythonCode = `
import random

matriz = [[random.randint(0,9) for _ in range(32)] for _ in range(32)]

# Exportar como texto
texto = "".join([str(f"{fila}\n") for fila in matriz])

# Crear tabla HTML
html = "<table>" + "".join([
    "<tr>" + "".join([f"<td>{c}</td>" for c in fila]) + "</tr>" for fila in matriz
]) + "</table>"
  `;

  await pyodide.runPythonAsync(pythonCode);

  const texto = pyodide.globals.get("texto");
  const html = pyodide.globals.get("html");

  document.getElementById("texto-matriz").textContent = texto;
  document.getElementById("tabla-container").innerHTML = html;
}
```
