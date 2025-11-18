const fs = require('fs');
const path = require('path');
const https = require('https');
const readline = require('readline');
const os = require('os');
const shell = require('child_process').execSync;
const { exec } = require('child_process');

const CARPETA = path.join(process.cwd(), 'config');
const TOKEN_FILE = path.join(CARPETA, 'token.txt');
const DOMAINS_FILE = path.join(CARPETA, 'dominios.txt');
const IP_FILE = path.join(CARPETA, 'ip_actual.txt');
const HISTORY_FILE = path.join(CARPETA, 'ip_historial.txt');

// Ajustes consola
process.title = "Actualizador de IP DuckDNS";

var infoPrograma = `La finalidad de este programa es exclusivamente
para poder actualizar de forma automática tu IP
pública con el servicio que
proporciona DuckDNS.org

Este programa no es oficial, fue creado
por GioCodex.

GitHub: github.com/GioSJ47

Su funcionamiento es básico y directo al grano.
Permite registrar tus dominios con tu token
proporcionado por DuckDNS.

Mientras este programa esté ejecutado en su primera
opción se consultará periódicamente (cada un minuto)
tu IP pública y si esta cambió se encargará de
indicarle a DuckDNS la nueva IP para mantenerlo
siempre actualizado.

Este programa no tiene ni necesita soporte, así
como está funciona bien y solo.

`;


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Crear carpeta config si no existe
try {
  fs.mkdirSync(CARPETA, { recursive: true });
} catch (err) {
  console.error(`No se pudo crear la carpeta 'config': ${err.message}`);
  rl.close();
  process.exit(1);
}

// ---------- Funciones de red ----------
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function tiempoActual() {
  const t = new Date();

  let datos = [
    t.getMonth() + 1,
    t.getDate(),
    t.getHours(),
    t.getMinutes(),
    t.getSeconds()
  ];

  datos.forEach((dato, i) => {
    if (dato < 10) datos[i] = '0' + dato;
  });

  return `${t.getFullYear()}-${datos[0]}-${datos[1]} ${datos[2]}:${datos[3]}:${datos[4]}`;
}

async function getPublicIP() {
  try {
    const response = await httpsGet('https://api.ipify.org?format=json');
    return JSON.parse(response).ip.trim();
  } catch (err) {
    console.error('Error al obtener IP pública:', err.message);
    return null;
  }
}

async function updateDuckDNS(ip, domains, token) {
  const url = `https://www.duckdns.org/update?domains=${domains.join(',')}&token=${token}&ip=${ip}`;

  try {
    const response = await httpsGet(url);
    if (response.includes("OK")) {
      console.log(`[${tiempoActual()}] IP actualizada en DuckDNS: ${ip}`);
      saveIP(ip);
    } else {
      console.error('Fallo en la actualización:', response);
    }
  } catch (err) {
    console.error('Error al actualizar DuckDNS:', err.message);
  }
}

// ---------- Funciones de archivo ----------
function getLastIP() {
  try {
    return fs.readFileSync(IP_FILE, 'utf-8').trim();
  } catch {
    return null;
  }
}

function saveIP(ip) {
  fs.writeFileSync(IP_FILE, ip);

  let historial = [];
  if (fs.existsSync(HISTORY_FILE)) {
    historial = fs.readFileSync(HISTORY_FILE, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  }

  historial.push(`${Date.now()}=${ip}`);
  fs.writeFileSync(HISTORY_FILE, historial.join('\n'));
}

function getDomains() {
  if (!fs.existsSync(DOMAINS_FILE)) return [];
  return fs.readFileSync(DOMAINS_FILE, 'utf-8')
    .split('\n')
    .map(d => d.trim())
    .filter(Boolean);
}

function addDomain(domain) {
  domain = domain.trim();

  const domains = getDomains();
  if (!domains.includes(domain)) {
    domains.push(domain);
    fs.writeFileSync(DOMAINS_FILE, domains.join('\n'));
    console.log(`Dominio agregado: ${domain}`);
    return true;
  } else {
    console.log('El dominio ya existe.');
    return false;
  }
}

function fToken(token = false) {
  if (typeof token === 'string') {
    token = token.trim();
    if (token === '') return false;
    fs.writeFileSync(TOKEN_FILE, token);
    return token;
  }

  if (!token && fs.existsSync(TOKEN_FILE)) {
    const saved = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    return saved || false;
  }

  return false;
}

function removeDomain(domain) {
  let domains = getDomains();
  if (!domains.includes(domain)) {
    console.log('\nEl dominio no existe.');
    return;
  }

  domains = domains.filter(d => d !== domain);
  fs.writeFileSync(DOMAINS_FILE, domains.join('\n'));
  console.log(`\nDominio eliminado: ${domain}`);
}

// ---------- Lógica principal ----------
async function checkAndUpdate() {
  const currentIP = await getPublicIP();
  if (!currentIP) return;

  const lastIP = getLastIP();
  const domains = getDomains();
  const token = fToken();

  if (domains.length === 0) {
    limpiarConsola();
    console.log('No hay dominios configurados, use la opción 3 para agregar dominios.');
    showMenu();
    return;
  }

  if (!token) {
    limpiarConsola();
    console.log('No hay un token especificado, elija la opción 5 para especificarlo.');
    showMenu();
    return;
  }

  if (currentIP !== lastIP) {
    await updateDuckDNS(currentIP, domains, token);
  } else {
    console.log(`[${tiempoActual()}] IP sin cambios: ${currentIP}`);
  }
}

function limpiarConsola() {
  console.clear();
}

function showMenu() {
  console.log('\nSeleccione una opción:');
  console.log('  1. Iniciar Actualizador.');
  console.log('  2. Ver dominios.');
  console.log('  3. Agregar dominio.');
  console.log('  4. Quitar dominio.');
  console.log('  5. Agregar token.');
  console.log('  6. Info de este programa.');
  rl.question('\n> ', handleMenu);
}

function handleMenu(option) {
  switch (option.trim()) {
    case '1':
      limpiarConsola();
      console.log('Actualizador iniciado. Verificando IP cada minuto...\n');
      setInterval(checkAndUpdate, 60 * 1000);
      checkAndUpdate();
      break;

    case '2':
      limpiarConsola();
      const domains = getDomains();
      if (domains.length === 0) {
        console.log('No hay dominios configurados.');
      } else {
        console.log('Dominios actuales:');
        domains.forEach(d => console.log(`- ${d}`));
      }
      showMenu();
      break;

    case '3':
      limpiarConsola();
      rl.question('Ingrese el nombre del dominio (sin .duckdns.org): ', d => {
        limpiarConsola();
        addDomain(d);
        showMenu();
      });
      break;

    case '4':
      limpiarConsola();
      const allDomains = getDomains();
      if (allDomains.length === 0) {
        console.log('No hay dominios configurados.');
        showMenu();
        break;
      }

      console.log('Dominios actuales:');
      allDomains.forEach((d, i) => console.log(`${i + 1}. ${d}`));

      rl.question('\n> ', input => {
        const index = parseInt(input.trim()) - 1;
        if (isNaN(index) || index < 0 || index >= allDomains.length) {
          console.log('Número inválido.');
        } else {
          removeDomain(allDomains[index]);
        }
        showMenu();
      });
      break;

    case '5':
      limpiarConsola();
      rl.question('Ingrese el token: ', d => {
        limpiarConsola();
        fToken(d);
        showMenu();
      });
      break;

    case '6':
      limpiarConsola();
      console.log(infoPrograma);
      rl.question('Enter para volver al menu principal.', d => {
        showMenu();
      });
      break;

    default:
      console.log('Opción inválida.');
      showMenu();
  }
}

// Ajustar tamaño de consola e inicia menú
exec('mode con: cols=60 lines=24', (error, stdout, stderr) => {
  limpiarConsola();
  setTimeout(showMenu, 10);
});

// Si se cierra el ejecutable
process.on('exit', () => {
  
});
