// script.js — integración Pyodide + UI
let pyodide = null;
let pyReady = false;

const logEl = id => document.getElementById(id);
const msgRegistrar = logEl("msg-registrar");
const msgOps = logEl("msg-ops");
const outputLog = logEl("output-log");
const tablaContainer = logEl("tabla-container");
const textoMatriz = logEl("texto-matriz");

// Carga Pyodide y define las funciones Python
async function initPyodide() {
  outputLog.textContent = "Cargando Pyodide...";
  pyodide = await loadPyodide();
  outputLog.textContent = "Pyodide cargado — inicializando funciones Python...";
  // Código Python que define todas las funciones necesarias (inventario, registro, A, FEFO, riesgo, export)
  const pythonCode = `
import random, time
# Inventario global: 32x32 de diccionarios
def crear_inventario():
    inv = []
    for i in range(32):
        fila = []
        for j in range(32):
            fila.append({"tipo":"", "ubicacion":"", "lote":"", "vencimiento":"", "condiciones":""})
        inv.append(fila)
    return inv

inventario = crear_inventario()
A = None

def fecha_valida(f):
    if not isinstance(f, str): return False
    if len(f) != 10: return False
    if f[4] != "-" or f[7] != "-": return False
    for c in f:
        if c != "-" and (c < "0" or c > "9"):
            return False
    return True

def dias_hasta(fecha):
    hoy = "20250101"
    f = fecha[0:4] + fecha[5:7] + fecha[8:10]
    H = 0
    F = 0
    for c in hoy: H = H*10 + (ord(c)-48)
    for c in f: F = F*10 + (ord(c)-48)
    return F - H

# matrices auxiliares
def zeros_matrix():
    return [[0.0 for _ in range(32)] for __ in range(32)]

def add_matrices(A,B):
    return [[A[i][j] + B[i][j] for j in range(32)] for i in range(32)]

def scalar_multiply_matrix(k,A):
    return [[k * A[i][j] for j in range(32)] for i in range(32)]

def texto_a_num(t):
    s = 0
    for c in t: s += ord(c)
    return (s % 5) + 1

def condiciones_a_num(c):
    s = 0
    for x in c: s += ord(x)
    return (s % 3) + 1

# registrar celda
def py_guardar_celda(i, j, tipo, ubic, lote, venc, cond):
    global inventario
    if not (0 <= i <= 31 and 0 <= j <= 31):
        return {"ok":False, "msg":"Fila/col fuera de rango."}
    if tipo == "" or ubic == "" or lote == "" or cond == "" or not fecha_valida(venc):
        return {"ok":False, "msg":"Datos inválidos o incompletos."}
    inventario[i][j] = {"tipo": tipo, "ubicacion": ubic, "lote": lote, "vencimiento": venc, "condiciones": cond}
    return {"ok":True, "msg":f"Guardado en [{i},{j}]"}

# rellenar aleatorio
def py_rellenar_aleatorio(n):
    global inventario
    tipos = ["Analgesico","Antibiotico","Antiinflamatorio","Vacuna","Suero"]
    from datetime import date, timedelta
    hoy = date.today()
    for k in range(n):
        i = random.randint(0,31)
        j = random.randint(0,31)
        t = random.choice(tipos)
        ubic = f"R{i}C{j}"
        lote = f"L{random.randint(100,999)}"
        dias = random.randint(-30,365)
        f = hoy + timedelta(days=dias)
        venc = f"{f.year}-{f.month:02d}-{f.day:02d}"
        cond = "Temperatura 20C; Humedad 50%"
        inventario[i][j] = {"tipo":t,"ubicacion":ubic,"lote":lote,"vencimiento":venc,"condiciones":cond}
    return {"ok":True, "msg":f"{n} registros creados."}

# construir matriz numerica A = 3U + 2C + T
def py_construir_matriz():
    global A, inventario
    hay = any(inventario[i][j]["tipo"] != "" for i in range(32) for j in range(32))
    if not hay:
        return {"ok":False, "msg":"No hay registros en el almacén."}
    # incompletos?
    for i in range(32):
        for j in range(32):
            cel = inventario[i][j]
            if cel["tipo"] != "":
                if cel["ubicacion"]=="" or cel["lote"]=="" or cel["vencimiento"]=="" or cel["condiciones"]=="":
                    return {"ok":False, "msg":"Datos incompletos en el inventario."}
    U = zeros_matrix(); C = zeros_matrix(); T = zeros_matrix()
    for i in range(32):
        for j in range(32):
            cel = inventario[i][j]
            if cel["tipo"] != "":
                urg = dias_hasta(cel["vencimiento"])
                if urg < 0: urg = 0
                U[i][j] = float(urg)
                C[i][j] = condiciones_a_num(cel["condiciones"])
                T[i][j] = texto_a_num(cel["tipo"])
    A = add_matrices(scalar_multiply_matrix(3.0,U), add_matrices(scalar_multiply_matrix(2.0,C), T))
    return {"ok":True, "msg":"Matriz A construida."}

# mostrar matriz inventario (texto) y tabla HTML
def py_exportar_matriz_texto():
    global inventario
    lines = []
    for i in range(32):
        row = []
        for j in range(32):
            cel = inventario[i][j]
            if cel["tipo"] == "":
                row.append("VAC")
            else:
                # representación corta: Tipo(Lote,venc)
                row.append(f\"{cel['tipo'][:6]}({cel['lote']},{cel['vencimiento']})\")
        lines.append(\"|\".join(row))
    texto = \"\\n\".join(lines)
    return {"ok":True, "text":texto}

def py_matriz_A_html_table():
    global inventario, A
    # si A no existe, devolver inventario textual en tabla
    if A is None:
        # mostrar inventario tipo corto
        rows = []
        for i in range(32):
            cols = []
            for j in range(32):
                cel = inventario[i][j]
                if cel["tipo"] == "":
                    cols.append("<td>VAC</td>")
                else:
                    cols.append(f"<td>{cel['tipo'][:8]}</td>")
            rows.append("<tr>" + "".join(cols) + "</tr>")
        html = "<table>" + "".join(rows) + "</table>"
        return {"ok":True, "html":html}
    else:
        rows = []
        for i in range(32):
            cols = []
            for j in range(32):
                cols.append(f"<td>{int(A[i][j])}</td>")
            rows.append("<tr>" + "".join(cols) + "</tr>")
        html = "<table>" + "".join(rows) + "</table>"
        return {"ok":True, "html":html}

# FEFO por tipo
def py_fefo_tipo(tipo):
    global inventario
    v=[]; pos=[]
    for i in range(32):
        for j in range(32):
            cel = inventario[i][j]
            if cel["tipo"] == tipo:
                d = dias_hasta(cel["vencimiento"])
                v.append(d); pos.append((i,j))
    if len(v)==0:
        return {"ok":False,"msg":"No hay registros de ese tipo."}
    # burbuja
    n=len(v)
    for a in range(n-1):
        for b in range(n-1-a):
            if v[b] > v[b+1]:
                v[b],v[b+1]=v[b+1],v[b]
                pos[b],pos[b+1]=pos[b+1],pos[b]
    res=[{"dias":int(v[k]), "pos":list(pos[k])} for k in range(n)]
    return {"ok":True,"result":res}

# comparar tiempos por tipo
def py_comparar_tiempos(tipo):
    global inventario, A
    if A is None:
        return {"ok":False,"msg":"Primero construya la matriz A."}
    t0=time.time()
    count=0
    for i in range(32):
        for j in range(32):
            if inventario[i][j]["tipo"]==tipo: count+=1
    t1=time.time(); tn=t1-t0
    if count==0:
        return {"ok":False,"msg":"No hay registros de ese tipo."}
    t2=time.time()
    s=0.0
    for i in range(32):
        for j in range(32):
            if inventario[i][j]["tipo"]==tipo:
                s += A[i][j]
    t3=time.time(); tm=t3-t2
    red = ((tn-tm)/tn)*100.0 if tn>0 else 0.0
    return {"ok":True,"tn":tn,"tm":tm,"reduction":red}

# proyección de riesgo por tipo
def py_proyeccion_riesgo(tipo, umbral):
    global inventario, A
    if A is None:
        return {"ok":False,"msg":"Primero construya la matriz A."}
    B=zeros_matrix(); total=0; crit=0
    for i in range(32):
        for j in range(32):
            if inventario[i][j]["tipo"]==tipo:
                total += 1
                if A[i][j] >= umbral:
                    B[i][j] = 1.0
                else:
                    B[i][j] = 0.0
    if total==0:
        return {"ok":False,"msg":"No hay registros de ese tipo."}
    Af = add_matrices(scalar_multiply_matrix(0.7, A), scalar_multiply_matrix(0.3, B))
    for i in range(32):
        for j in range(32):
            if inventario[i][j]["tipo"]==tipo:
                if Af[i][j] >= umbral:
                    crit += 1
    pct = (crit/total)*100.0
    return {"ok":True,"pct":pct}

# exportar A a CSV (string)
def py_export_A_csv():
    global A
    if A is None:
        return {"ok":False,"msg":"A no está construida."}
    lines=[]
    for i in range(32):
        row = [str(int(A[i][j])) for j in range(32)]
        lines.append(",".join(row))
    csv = "\\n".join(lines)
    return {"ok":True,"csv":csv}
`;
  await pyodide.runPythonAsync(pythonCode);
  outputLog.textContent = "Funciones Python listas.";
  pyReady = true;
}

// helpers JS <-> Python
async function callPy(func, args=[]) {
  if (!pyReady) {
    outputLog.textContent = "Python no listo aún.";
    return null;
  }
  try {
    // construimos una llamada segura en Python con argumentos literales
    const pyArgs = JSON.stringify(args);
    const code = `
__f = globals().get("${func}")
if __f is None:
    {"ok":False,"msg":"Función no encontrada: ${func}"}
else:
    __f(*${pyArgs})
`;
    const res = await pyodide.runPythonAsync(code);
    // convertir resultado a JS si es PyProxy
    try { return res.toJs(); } catch(e) { return res; }
  } catch (err) {
    outputLog.textContent = "Error al ejecutar Python: " + err;
    console.error(err);
    return null;
  }
}

// UI actions
document.getElementById("btn-registrar").onclick = async () => {
  const i = parseInt(document.getElementById("inp-fila").value);
  const j = parseInt(document.getElementById("inp-col").value);
  const tipo = document.getElementById("inp-tipo").value;
  const ubic = document.getElementById("inp-ubic").value;
  const lote = document.getElementById("inp-lote").value;
  const venc = document.getElementById("inp-venc").value;
  const cond = document.getElementById("inp-cond").value;
  msgRegistrar.textContent = "Guardando...";
  const res = await callPy("py_guardar_celda", [i,j,tipo,ubic,lote,venc,cond]);
  if (res && res.ok) {
    msgRegistrar.textContent = res.msg;
    outputLog.textContent = res.msg;
  } else {
    msgRegistrar.textContent = res ? res.msg : "Error";
    outputLog.textContent = res ? res.msg : "Error";
  }
  // limpiar A cache en Python (para forzar reconstrucción si hay cambios)
  await pyodide.runPythonAsync("A = None");
};

document.getElementById("btn-rellenar").onclick = async () => {
  msgRegistrar.textContent = "Rellenando 50 registros...";
  const res = await callPy("py_rellenar_aleatorio", [50]);
  msgRegistrar.textContent = res && res.ok ? res.msg : "Error al rellenar";
  outputLog.textContent = res && res.ok ? res.msg : "Error al rellenar";
  await pyodide.runPythonAsync("A = None");
};

document.getElementById("btn-construir").onclick = async () => {
  msgOps.textContent = "Construyendo matriz A...";
  const res = await callPy("py_construir_matriz", []);
  msgOps.textContent = res && res.ok ? res.msg : (res && res.msg ? res.msg : "Error");
  outputLog.textContent = res && res.ok ? res.msg : (res && res.msg ? res.msg : "Error");
};

document.getElementById("btn-mostrar").onclick = async () => {
  msgOps.textContent = "Generando vista de matriz...";
  const res = await callPy("py_matriz_A_html_table", []);
  if (res && res.ok) {
    tablaContainer.innerHTML = res.html;
    const tex = await callPy("py_exportar_matriz_texto", []);
    textoMatriz.textContent = tex && tex.ok ? tex.text : "Error al obtener texto";
    msgOps.textContent = "Matriz mostrada.";
    outputLog.textContent = "Matriz renderizada.";
  } else {
    tablaContainer.innerHTML = "<em>No hay matriz para mostrar.</em>";
    msgOps.textContent = res ? res.msg : "Error";
    outputLog.textContent = res ? res.msg : "Error";
  }
};

document.getElementById("btn-fefo").onclick = async () => {
  const tipo = document.getElementById("tipo-analizar").value;
  if (!tipo) { msgOps.textContent = "Ingrese tipo para FEFO."; return; }
  msgOps.textContent = "Calculando FEFO...";
  const res = await callPy("py_fefo_tipo", [tipo]);
  if (res && res.ok) {
    outputLog.textContent = JSON.stringify(res.result, null, 2);
    msgOps.textContent = "FEFO calculado.";
  } else {
    msgOps.textContent = res ? res.msg : "Error FEFO";
    outputLog.textContent = res ? res.msg : "Error FEFO";
  }
};

document.getElementById("btn-compare").onclick = async () => {
  const tipo = document.getElementById("tipo-analizar").value;
  if (!tipo) { msgOps.textContent = "Ingrese tipo para comparar."; return; }
  msgOps.textContent = "Comparando tiempos...";
  const res = await callPy("py_comparar_tiempos", [tipo]);
  if (res && res.ok) {
    outputLog.textContent = "Tiempo naive: " + res.tn.toFixed(6) + "s\\nTiempo matricial: " + res.tm.toFixed(6) + "s\\nReducción: " + res.reduction.toFixed(2) + "%";
    msgOps.textContent = "Comparación completada.";
  } else {
    msgOps.textContent = res ? res.msg : "Error comparación";
    outputLog.textContent = res ? res.msg : "Error comparación";
  }
};

document.getElementById("btn-riesgo").onclick = async () => {
  const tipo = document.getElementById("tipo-analizar").value;
  if (!tipo) { msgOps.textContent = "Ingrese tipo para riesgo."; return; }
  const um = prompt("Ingrese umbral (ej. 10):", "10");
  if (um === null) { msgOps.textContent = "Cancelado."; return; }
  const umn = parseFloat(um);
  if (isNaN(umn)) { msgOps.textContent = "Umbral inválido."; return; }
  msgOps.textContent = "Calculando proyección de riesgo...";
  const res = await callPy("py_proyeccion_riesgo", [tipo, umn]);
  if (res && res.ok) {
    outputLog.textContent = "Porcentaje en riesgo: " + res.pct.toFixed(2) + "%";
    msgOps.textContent = "Proyección completada.";
  } else {
    msgOps.textContent = res ? res.msg : "Error proyección";
    outputLog.textContent = res ? res.msg : "Error proyección";
  }
};

document.getElementById("btn-export").onclick = async () => {
  msgOps.textContent = "Preparando CSV...";
  const res = await callPy("py_export_A_csv", []);
  if (res && res.ok) {
    // crear blob y descargar
    const csv = res.csv;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "matriz_A.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    msgOps.textContent = "CSV descargado.";
    outputLog.textContent = "CSV listo.";
  } else {
    msgOps.textContent = res ? res.msg : "Error exportar";
    outputLog.textContent = res ? res.msg : "Error exportar";
  }
};

// iniciar
initPyodide();
