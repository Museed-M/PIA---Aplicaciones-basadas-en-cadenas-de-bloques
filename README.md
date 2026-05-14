# ⛓ TicketChain

> Marketplace descentralizado de boletos para eventos, con reventa controlada (anti-scalping) sobre blockchain local.

Proyecto Integrador de Aprendizaje (PIA) — Tecnologías Blockchain.

---

## 📖 ¿Qué hace este proyecto?

**TicketChain** es una DApp (aplicación descentralizada) donde:

- 🎟 **Organizadores** crean eventos y emiten boletos en la blockchain
- 💳 **Asistentes** compran boletos pagando en ETH (criptomoneda) desde su wallet
- ♻️ **Revendedores** pueden poner sus boletos en venta, pero **a un precio máximo definido por el organizador** (anti-scalping)
- 🔒 **El organizador** valida los boletos en la entrada del evento

Cada boleto vive en la blockchain, firmado criptográficamente, y no puede falsificarse ni revenderse a precios abusivos.

---

## ✨ Características

| Característica | Detalle |
|---|---|
| Wallet | Conexión con MetaMask (u otra wallet de software compatible con EVM) |
| Smart Contract | Solidity ^0.8.20 |
| Blockchain | Hardhat local (chain ID `31337`) |
| Frontend | HTML + JavaScript vanilla + ethers.js v6 (100% cliente, sin servidor) |
| Pagos | ETH nativo |
| Roles | `owner` → `organizers` → `ticketOwners`, validados con `require` |
| Anti-scalping | Precio máximo de reventa configurable por evento |
| Comisión de reventa | 5% al organizador del evento original |

---

## 🏗 Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      USUARIO + MetaMask                      │
└──────────────────────────┬──────────────────────────────────┘
                           │  firma transacciones
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND (HTML + JS + ethers.js)                │
│                  index.html · styles.css · app.js            │
└──────────────────────────┬──────────────────────────────────┘
                           │  JSON-RPC
                           ▼
┌─────────────────────────────────────────────────────────────┐
│             BLOCKCHAIN LOCAL (Hardhat Node)                  │
│              ↳ TicketMarketplace.sol desplegado              │
└─────────────────────────────────────────────────────────────┘
```

No hay servidor de aplicación. El frontend habla **directamente** con la blockchain. Esto cumple el requisito de **no incluir actividades centralizadas**.

---

## 📂 Estructura del proyecto

```
ticketchain/
├── contracts/
│   └── TicketMarketplace.sol     # Smart contract
├── scripts/
│   ├── deploy.js                 # Despliega el contrato
│   └── seed.js                   # Crea eventos de ejemplo
├── frontend/
│   ├── index.html                # Página principal
│   ├── styles.css                # Estilos
│   ├── app.js                    # Lógica + conexión a MetaMask
│   └── contract.js               # (autogenerado al desplegar)
├── hardhat.config.js             # Configuración de Hardhat
├── package.json                  # Dependencias
└── README.md
```

---

## 🚀 Cómo correr el proyecto

### Requisitos previos

- [Node.js](https://nodejs.org) v18 o superior
- [MetaMask](https://metamask.io) instalado en el navegador
- Un editor de código (VS Code recomendado)

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/ticketchain.git
cd ticketchain
```

> O descarga el ZIP desde el botón verde **Code → Download ZIP** si no tienes Git.

### 2. Instalar dependencias

```bash
npm install
```

### 3. Levantar la blockchain local

En una terminal (déjala abierta):

```bash
npx hardhat node
```

Esto inicia una blockchain en `http://127.0.0.1:8545` y te da 20 cuentas de prueba con 10,000 ETH cada una. **Copia las private keys de las primeras 3 cuentas**, las vas a necesitar.

### 4. Desplegar el contrato

En **otra terminal**:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

> Opcional: crea eventos de ejemplo con `npx hardhat run scripts/seed.js --network localhost`

### 5. Configurar MetaMask

Agrega una red personalizada:

| Campo | Valor |
|---|---|
| Network name | `Hardhat Local` |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | `ETH` |

Importa al menos 2 cuentas usando las private keys que copiaste en el paso 3:
**MetaMask → Add account → Import account → pega la private key**

### 6. Abrir el frontend

Abre `frontend/index.html` con **Live Server** (extensión de VS Code) o sirviéndolo localmente:

```bash
cd frontend
python -m http.server 8080
```

Luego abre [http://localhost:8080](http://localhost:8080).

> ⚠️ No abras el HTML con doble clic (`file://...`), MetaMask no se conecta así.

---

## 🧪 Flujo de prueba

1. **Cuenta A (Organizador)** → conecta wallet → pestaña **Panel organizador** → crea evento
2. **Cuenta B (Comprador)** → cambia de cuenta en MetaMask → pestaña **Eventos** → compra ticket
3. **Cuenta B** → pestaña **Mis tickets** → pone el ticket en reventa
4. **Cuenta C (Revendedor)** → pestaña **Reventa** → compra el ticket. El 5% va al organizador
5. **Cuenta A** → pestaña **Panel organizador** → valida el ticket usando su ID

Intenta listar un ticket a un precio mayor al tope: el contrato lo rechaza ✅

---

## 📜 Funciones principales del smart contract

| Función | Quién puede llamarla | ¿Pagable? | Qué hace |
|---|---|---|---|
| `createEvent(...)` | Organizadores autorizados | No | Crea un nuevo evento |
| `buyTicket(eventId)` | Cualquiera | ✅ Sí | Compra ticket primario en ETH |
| `listForResale(ticketId, price)` | Dueño del ticket | No | Pone ticket en reventa (≤ tope) |
| `cancelListing(ticketId)` | Dueño del ticket | No | Cancela una reventa |
| `buyResaleTicket(ticketId)` | Cualquiera | ✅ Sí | Compra ticket de reventa |
| `useTicket(ticketId)` | Organizador del evento | No | Marca ticket como usado |
| `authorizeOrganizer(addr)` | Owner del contrato | No | Autoriza nuevo organizador |

### Validaciones con `require` (ejemplos)

```solidity
require(msg.sender == owner, "Solo el dueno del contrato");
require(isOrganizer[msg.sender], "No estas autorizado como organizador");
require(price <= ev.maxResalePrice, "Excede el precio maximo de reventa");
require(msg.value == ev.originalPrice, "Monto incorrecto");
require(!t.used, "Ticket ya usado");
```

---

## 🛠 Stack técnico

- **Solidity** `^0.8.20` — lenguaje del smart contract
- **Hardhat** `^2.22` — entorno de desarrollo y blockchain local
- **ethers.js** `v6` — librería para hablar con la blockchain desde el frontend
- **HTML + CSS + JS** — frontend sin frameworks (100% descentralizado)

---

## 📋 Cumplimiento de requisitos del PIA

| Requisito | Cumplimiento | Puntos |
|---|---|---|
| Uso de wallet (MetaMask) | Modal inicial pregunta si conectar, botón siempre visible | 20 |
| Uso correcto de funciones Blockchain | `mapping`, `struct`, `event`, `modifier`, `payable`, `msg.sender/value` | 10 |
| Función que recibe pago en cripto | `buyTicket` y `buyResaleTicket` son `payable` | 15 |
| Conexión Smart Contract con UI | ethers.js + escucha de eventos del contrato | 20 |
| Validación de roles con `require` | 4 modifiers con `require` para owner/organizer/ticketOwner | 15 |
| Código fuente del Smart Contract | `TicketMarketplace.sol` documentado | 20 |
| **Total** | | **100** |

---

## 👥 Equipo

- **Nombre del/los alumnos:** _(completar)_
- **Matrícula:** _(completar)_
- **Grupo:** _(completar)_
- **Materia:** _(completar)_
- **Profesor:** _(completar)_

---

## 📄 Licencia

MIT — uso libre para fines académicos.
