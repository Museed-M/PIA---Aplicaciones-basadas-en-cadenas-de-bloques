let provider = null;
let signer = null;
let contract = null;
let userAddress = null;
let isOwner = false;

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("welcome-modal").classList.remove("hidden");

  document.getElementById("btn-connect-welcome").onclick = async () => {
    closeWelcomeModal();
    await connectWallet();
  };
  document.getElementById("btn-decline-welcome").onclick = () => {
    closeWelcomeModal();
    enterReadOnlyMode();
  };

  document.getElementById("btn-toggle-wallet").onclick = toggleWallet;

  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  document.getElementById("form-create-event").onsubmit = handleCreateEvent;
  document.getElementById("form-validate-ticket").onsubmit = handleValidateTicket;
  document.getElementById("form-authorize").onsubmit = handleAuthorize;
  document.getElementById("form-resale").onsubmit = handleListResale;
  document.getElementById("resale-cancel").onclick = closeResaleModal;

  setupReadOnlyProvider();
  loadEvents();
  loadResale();
});

function closeWelcomeModal() {
  document.getElementById("welcome-modal").classList.add("hidden");
}

function enterReadOnlyMode() {
  toast("Modo solo lectura activado. Conecta tu wallet para realizar transacciones.", "info");
  document.querySelectorAll("main section").forEach(sec => {
    if (sec.id !== "tab-events" && sec.id !== "tab-resale" && !sec.querySelector(".readonly-banner")) {
      const banner = document.createElement("div");
      banner.className = "readonly-banner";
      banner.innerHTML = "🔒 Estás en modo solo lectura. Conecta tu wallet para usar esta sección.";
      sec.querySelector(".section-head").after(banner);
    }
  });
}

async function connectWallet() {
  if (!window.ethereum) {
    toast("No detectamos MetaMask. Instálalo desde metamask.io", "error");
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    contract = new ethers.Contract(window.CONTRACT.address, window.CONTRACT.abi, signer);

    const ownerAddr = await contract.owner();
    isOwner = ownerAddr.toLowerCase() === userAddress.toLowerCase();

    updateWalletUI(true);
    removeReadOnlyBanners();
    toast(`Conectado: ${shortAddr(userAddress)}`, "success");

    await loadEvents();
    await loadResale();
    await loadMyTickets();

    listenContractEvents();

    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged",    () => window.location.reload());

  } catch (err) {
    console.error(err);
    toast("No se pudo conectar la wallet: " + (err.message || err), "error");
  }
}

function disconnectWallet() {
  signer = null;
  userAddress = null;
  isOwner = false;
  setupReadOnlyProvider();
  updateWalletUI(false);
  toast("Wallet desconectada (modo lectura)", "info");
  loadEvents();
  loadResale();
  document.getElementById("my-tickets-list").innerHTML =
    '<div class="empty">Conecta tu wallet para ver tus tickets.</div>';
}

function toggleWallet() {
  if (signer) disconnectWallet();
  else        connectWallet();
}

function updateWalletUI(connected) {
  const status = document.getElementById("wallet-status");
  const text   = document.getElementById("wallet-text");
  const btn    = document.getElementById("btn-toggle-wallet");
  if (connected) {
    status.classList.remove("disconnected");
    status.classList.add("connected");
    text.textContent = shortAddr(userAddress);
    btn.textContent = "Desconectar";
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-ghost");
  } else {
    status.classList.add("disconnected");
    status.classList.remove("connected");
    text.textContent = "Wallet desconectada";
    btn.textContent = "Conectar wallet";
    btn.classList.add("btn-primary");
    btn.classList.remove("btn-ghost");
  }
}

function removeReadOnlyBanners() {
  document.querySelectorAll(".readonly-banner").forEach(b => b.remove());
}

function setupReadOnlyProvider() {
  try {
    provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    contract = new ethers.Contract(window.CONTRACT.address, window.CONTRACT.abi, provider);
  } catch (e) {
    console.error("No hay nodo local en 127.0.0.1:8545");
  }
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  document.querySelectorAll(".tab-content").forEach(s => s.classList.toggle("active", s.id === `tab-${name}`));

  if (name === "events")      loadEvents();
  if (name === "resale")      loadResale();
  if (name === "my-tickets")  loadMyTickets();
}

async function loadEvents() {
  const list = document.getElementById("events-list");
  list.innerHTML = '<div class="empty">Cargando…</div>';
  try {
    const ids = await contract.getAllEventIds();
    if (ids.length === 0) {
      list.innerHTML = '<div class="empty">Aún no hay eventos. Si eres organizador, crea uno desde el panel.</div>';
      return;
    }
    list.innerHTML = "";
    for (const id of ids) {
      const ev = await contract.events(id);
      list.appendChild(renderEventCard(ev));
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div class="empty">No se pudo conectar con la blockchain. ¿Está corriendo el nodo local?</div>';
  }
}

function renderEventCard(ev) {
  const card = document.createElement("div");
  card.className = "event-card";

  const sold     = Number(ev.ticketsSold);
  const total    = Number(ev.totalTickets);
  const available = total - sold;
  const date = new Date(Number(ev.date) * 1000);
  const isPast = date < new Date();

  card.innerHTML = `
    <span class="badge ${!ev.active || isPast ? 'dim' : ''}">EVENTO #${ev.id}</span>
    <h3>${escapeHtml(ev.name)}</h3>
    <div class="muted small" style="margin-bottom:12px;">📍 ${escapeHtml(ev.venue)}</div>

    <div class="row"><span class="label">Fecha</span> <span class="value">${date.toLocaleString()}</span></div>
    <div class="row"><span class="label">Precio</span> <span class="value">${ethers.formatEther(ev.originalPrice)} ETH</span></div>
    <div class="row"><span class="label">Tope reventa</span> <span class="value">${ethers.formatEther(ev.maxResalePrice)} ETH</span></div>
    <div class="row"><span class="label">Disponibles</span> <span class="value">${available} / ${total}</span></div>
    <div class="row"><span class="label">Organizador</span> <span class="value mono">${shortAddr(ev.organizer)}</span></div>

    <div class="card-actions">
      ${available > 0 && ev.active && !isPast
        ? `<button class="btn btn-primary btn-sm" data-buy="${ev.id}" data-price="${ev.originalPrice}">Comprar ticket</button>`
        : `<button class="btn btn-ghost btn-sm" disabled>${isPast ? 'Evento pasado' : (available === 0 ? 'Agotado' : 'Cerrado')}</button>`
      }
    </div>
  `;

  const buyBtn = card.querySelector("[data-buy]");
  if (buyBtn) buyBtn.onclick = () => handleBuyTicket(buyBtn.dataset.buy, buyBtn.dataset.price);

  return card;
}

async function handleBuyTicket(eventId, priceWei) {
  if (!signer) { toast("Necesitas conectar tu wallet primero", "error"); return; }
  try {
    toast("Enviando transacción…", "info");
    const tx = await contract.buyTicket(eventId, { value: priceWei });
    await tx.wait();
    toast("🎟 ¡Ticket comprado!", "success");
    await loadEvents();
    await loadMyTickets();
  } catch (e) {
    console.error(e);
    toast(parseError(e), "error");
  }
}

async function loadResale() {
  const list = document.getElementById("resale-list");
  list.innerHTML = '<div class="empty">Cargando…</div>';
  try {
    const listedIds = await contract.getActiveListings();
    if (listedIds.length === 0) {
      list.innerHTML = '<div class="empty">No hay tickets en reventa por ahora.</div>';
      return;
    }
    list.innerHTML = "";
    for (const tid of listedIds) {
      const listing = await contract.listings(tid);
      const ticket  = await contract.tickets(tid);
      const ev      = await contract.events(ticket.eventId);
      list.appendChild(renderListingCard(listing, ticket, ev));
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div class="empty">Error cargando reventas.</div>';
  }
}

function renderListingCard(listing, ticket, ev) {
  const card = document.createElement("div");
  card.className = "listing-card";
  const date = new Date(Number(ev.date) * 1000);
  const isMine = userAddress && listing.seller.toLowerCase() === userAddress.toLowerCase();

  card.innerHTML = `
    <span class="badge warn">REVENTA · TICKET #${ticket.id}</span>
    <h3>${escapeHtml(ev.name)}</h3>
    <div class="muted small" style="margin-bottom:12px;">📍 ${escapeHtml(ev.venue)}</div>

    <div class="row"><span class="label">Fecha</span> <span class="value">${date.toLocaleString()}</span></div>
    <div class="row"><span class="label">Precio reventa</span> <span class="value">${ethers.formatEther(listing.price)} ETH</span></div>
    <div class="row"><span class="label">Precio original</span> <span class="value">${ethers.formatEther(ev.originalPrice)} ETH</span></div>
    <div class="row"><span class="label">Vendedor</span> <span class="value mono">${shortAddr(listing.seller)}</span></div>

    <div class="card-actions">
      ${isMine
        ? `<button class="btn btn-danger btn-sm" data-cancel="${ticket.id}">Cancelar mi listing</button>`
        : `<button class="btn btn-primary btn-sm" data-buyresale="${ticket.id}" data-price="${listing.price}">Comprar reventa</button>`
      }
    </div>
  `;

  const buyBtn = card.querySelector("[data-buyresale]");
  if (buyBtn) buyBtn.onclick = () => handleBuyResale(buyBtn.dataset.buyresale, buyBtn.dataset.price);

  const cancelBtn = card.querySelector("[data-cancel]");
  if (cancelBtn) cancelBtn.onclick = () => handleCancelListing(cancelBtn.dataset.cancel);

  return card;
}

async function handleBuyResale(ticketId, priceWei) {
  if (!signer) { toast("Conecta tu wallet primero", "error"); return; }
  try {
    toast("Enviando transacción…", "info");
    const tx = await contract.buyResaleTicket(ticketId, { value: priceWei });
    await tx.wait();
    toast("🎟 Ticket de reventa comprado", "success");
    await loadResale();
    await loadMyTickets();
  } catch (e) {
    console.error(e);
    toast(parseError(e), "error");
  }
}

async function handleCancelListing(ticketId) {
  try {
    const tx = await contract.cancelListing(ticketId);
    await tx.wait();
    toast("Listing cancelado", "success");
    await loadResale();
    await loadMyTickets();
  } catch (e) { toast(parseError(e), "error"); }
}

async function loadMyTickets() {
  const list = document.getElementById("my-tickets-list");
  if (!userAddress) {
    list.innerHTML = '<div class="empty">Conecta tu wallet para ver tus tickets.</div>';
    return;
  }
  list.innerHTML = '<div class="empty">Cargando…</div>';
  try {
    const ids = await contract.getMyTickets(userAddress);
    if (ids.length === 0) {
      list.innerHTML = '<div class="empty">Aún no tienes tickets. Compra uno desde la pestaña de Eventos.</div>';
      return;
    }
    list.innerHTML = "";
    for (const tid of ids) {
      const ticket = await contract.tickets(tid);
      const ev     = await contract.events(ticket.eventId);
      const listing = await contract.listings(tid);
      list.appendChild(renderTicketCard(ticket, ev, listing));
    }
  } catch (e) {
    console.error(e);
    list.innerHTML = '<div class="empty">Error cargando tus tickets.</div>';
  }
}

function renderTicketCard(ticket, ev, listing) {
  const card = document.createElement("div");
  card.className = "ticket-card";
  const date = new Date(Number(ev.date) * 1000);

  let statusBadge;
  if (ticket.used)               statusBadge = '<span class="badge used">USADO</span>';
  else if (listing.active)       statusBadge = '<span class="badge warn">EN REVENTA</span>';
  else                           statusBadge = '<span class="badge">DISPONIBLE</span>';

  card.innerHTML = `
    ${statusBadge}
    <h3>${escapeHtml(ev.name)}</h3>
    <div class="muted small" style="margin-bottom:12px;">📍 ${escapeHtml(ev.venue)} · 🎟 #${ticket.id}</div>

    <div class="row"><span class="label">Fecha</span> <span class="value">${date.toLocaleString()}</span></div>
    <div class="row"><span class="label">Comprado a</span> <span class="value">${ethers.formatEther(ticket.purchasePrice)} ETH</span></div>
    <div class="row"><span class="label">Máx reventa</span> <span class="value">${ethers.formatEther(ev.maxResalePrice)} ETH</span></div>

    <div class="card-actions">
      ${!ticket.used && !listing.active
        ? `<button class="btn btn-primary btn-sm" data-resell="${ticket.id}" data-max="${ev.maxResalePrice}">Poner en reventa</button>`
        : ''
      }
      ${listing.active
        ? `<button class="btn btn-danger btn-sm" data-cancel="${ticket.id}">Cancelar reventa</button>`
        : ''
      }
    </div>
  `;

  const resellBtn = card.querySelector("[data-resell]");
  if (resellBtn) resellBtn.onclick = () => openResaleModal(resellBtn.dataset.resell, resellBtn.dataset.max);

  const cancelBtn = card.querySelector("[data-cancel]");
  if (cancelBtn) cancelBtn.onclick = () => handleCancelListing(cancelBtn.dataset.cancel);

  return card;
}

let currentResaleTicketId = null;

function openResaleModal(ticketId, maxWei) {
  currentResaleTicketId = ticketId;
  document.getElementById("resale-ticket-info").textContent = `#${ticketId}`;
  document.getElementById("resale-max").textContent = ethers.formatEther(maxWei);
  document.getElementById("resale-price").max = ethers.formatEther(maxWei);
  document.getElementById("resale-modal").classList.remove("hidden");
}
function closeResaleModal() {
  document.getElementById("resale-modal").classList.add("hidden");
  currentResaleTicketId = null;
}

async function handleListResale(e) {
  e.preventDefault();
  if (!signer) { toast("Conecta tu wallet", "error"); return; }
  const priceEth = document.getElementById("resale-price").value;
  try {
    const priceWei = ethers.parseEther(priceEth);
    const tx = await contract.listForResale(currentResaleTicketId, priceWei);
    await tx.wait();
    toast("Ticket puesto en reventa", "success");
    closeResaleModal();
    await loadResale();
    await loadMyTickets();
  } catch (err) { toast(parseError(err), "error"); }
}

async function handleCreateEvent(e) {
  e.preventDefault();
  if (!signer) { toast("Conecta tu wallet", "error"); return; }
  try {
    const name        = document.getElementById("ev-name").value;
    const venue       = document.getElementById("ev-venue").value;
    const dateStr     = document.getElementById("ev-date").value;
    const priceEth    = document.getElementById("ev-price").value;
    const maxResale   = document.getElementById("ev-max-resale").value;
    const total       = document.getElementById("ev-total").value;

    const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);
    const priceWei  = ethers.parseEther(priceEth);
    const maxWei    = ethers.parseEther(maxResale);

    toast("Creando evento…", "info");
    const tx = await contract.createEvent(name, venue, timestamp, priceWei, maxWei, total);
    await tx.wait();
    toast("✅ Evento creado", "success");
    e.target.reset();
    await loadEvents();
  } catch (err) { toast(parseError(err), "error"); }
}

async function handleValidateTicket(e) {
  e.preventDefault();
  if (!signer) { toast("Conecta tu wallet", "error"); return; }
  const id = document.getElementById("validate-id").value;
  try {
    const tx = await contract.useTicket(id);
    await tx.wait();
    toast(`✅ Ticket #${id} marcado como usado`, "success");
    e.target.reset();
    await loadMyTickets();
  } catch (err) { toast(parseError(err), "error"); }
}

async function handleAuthorize(e) {
  e.preventDefault();
  if (!signer) { toast("Conecta tu wallet", "error"); return; }
  if (!isOwner) { toast("Solo el dueño del contrato puede autorizar", "error"); return; }
  const addr = document.getElementById("authorize-address").value;
  try {
    const tx = await contract.authorizeOrganizer(addr);
    await tx.wait();
    toast(`✅ ${shortAddr(addr)} autorizado como organizador`, "success");
    e.target.reset();
  } catch (err) { toast(parseError(err), "error"); }
}

function listenContractEvents() {
  contract.on("EventCreated",       () => loadEvents());
  contract.on("TicketPurchased",    () => { loadEvents(); loadMyTickets(); });
  contract.on("TicketListedForResale", () => { loadResale(); loadMyTickets(); });
  contract.on("ResaleCancelled",    () => { loadResale(); loadMyTickets(); });
  contract.on("TicketResold",       () => { loadResale(); loadMyTickets(); });
  contract.on("TicketUsed",         () => loadMyTickets());
}

function shortAddr(a) {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function parseError(err) {
  if (err.reason)             return "Error: " + err.reason;
  if (err.shortMessage)       return "Error: " + err.shortMessage;
  if (err.data && err.data.message) return "Error: " + err.data.message;
  if (err.message)            return "Error: " + err.message.split("(")[0];
  return "Error desconocido";
}

function toast(msg, type = "info") {
  const c = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
