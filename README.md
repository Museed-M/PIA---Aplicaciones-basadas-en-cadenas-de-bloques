#  TicketChain

> Marketplace descentralizado de boletos para eventos, con reventa controlada (anti-scalping) sobre blockchain local.

Proyecto Integrador de Aprendizaje (PIA)

---

##  ¿Qué hace este proyecto?

**TicketChain** es una DApp (aplicación descentralizada) donde:

- **Organizadores** crean eventos y emiten boletos en la blockchain
- **Asistentes** compran boletos pagando en ETH (criptomoneda) desde su wallet
- **Revendedores** pueden poner sus boletos en venta, pero **a un precio máximo definido por el organizador** (anti-scalping)
- **El organizador** valida los boletos en la entrada del evento

Cada boleto vive en la blockchain, firmado criptográficamente, y no puede falsificarse ni revenderse a precios abusivos.

---

##  Estructura del proyecto

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

##  Cómo correr el proyecto

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


---

##  Flujo de prueba

1. **Cuenta A (Organizador)** → conecta wallet → pestaña **Panel organizador** → crea evento
2. **Cuenta B (Comprador)** → cambia de cuenta en MetaMask → pestaña **Eventos** → compra ticket
3. **Cuenta B** → pestaña **Mis tickets** → pone el ticket en reventa
4. **Cuenta C (Revendedor)** → pestaña **Reventa** → compra el ticket. El 5% va al organizador
5. **Cuenta A** → pestaña **Panel organizador** → valida el ticket usando su ID

Intenta listar un ticket a un precio mayor al tope: el contrato lo rechaza ✅

---

##  Funciones principales del smart contract

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

##  Equipo

- **Nombre del/los alumnos:** Edgar De Jesus Mendez Martinez / Itzeli Giovanna Reta Martinez
- **Matrícula:** 2132927 / 1913570
- **Materia:** Aplicaciones Basadas en Cadenas de Bloques
- **Profesor:** Astrid Muniz Solorio
