// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TicketMarketplace {

    struct Event {
        uint256 id;
        string name;
        string venue;
        uint256 date;
        uint256 originalPrice;
        uint256 maxResalePrice;
        uint256 totalTickets;
        uint256 ticketsSold;
        address organizer;
        bool active;
    }

    struct Ticket {
        uint256 id;
        uint256 eventId;
        address owner;
        uint256 purchasePrice;
        bool used;
    }

    struct Listing {
        uint256 ticketId;
        address seller;
        uint256 price;
        bool active;
    }

    address public owner;
    uint256 public resaleFeePercent = 5;

    uint256 public nextEventId = 1;
    uint256 public nextTicketId = 1;

    mapping(address => bool) public isOrganizer;
    mapping(uint256 => Event) public events;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => Listing) public listings;

    uint256[] public allEventIds;
    uint256[] public allTicketIds;
    mapping(address => uint256[]) private ticketsByOwner;

    event OrganizerAuthorized(address indexed account);
    event OrganizerRevoked(address indexed account);
    event EventCreated(uint256 indexed eventId, string name, address indexed organizer, uint256 originalPrice, uint256 totalTickets);
    event TicketPurchased(uint256 indexed ticketId, uint256 indexed eventId, address indexed buyer, uint256 price);
    event TicketListedForResale(uint256 indexed ticketId, address indexed seller, uint256 price);
    event ResaleCancelled(uint256 indexed ticketId);
    event TicketResold(uint256 indexed ticketId, address indexed from, address indexed to, uint256 price);
    event TicketUsed(uint256 indexed ticketId, address indexed validator);

    modifier onlyOwner() {
        require(msg.sender == owner, "Solo el dueno del contrato");
        _;
    }

    modifier onlyOrganizer() {
        require(isOrganizer[msg.sender], "No estas autorizado como organizador");
        _;
    }

    modifier onlyEventOrganizer(uint256 eventId) {
        require(events[eventId].organizer == msg.sender, "Solo el organizador del evento");
        _;
    }

    modifier onlyTicketOwner(uint256 ticketId) {
        require(tickets[ticketId].owner == msg.sender, "No eres dueno del ticket");
        _;
    }

    modifier eventExists(uint256 eventId) {
        require(events[eventId].id != 0, "El evento no existe");
        _;
    }

    modifier ticketExists(uint256 ticketId) {
        require(tickets[ticketId].id != 0, "El ticket no existe");
        _;
    }

    constructor() {
        owner = msg.sender;
        isOrganizer[msg.sender] = true;
        emit OrganizerAuthorized(msg.sender);
    }

    function authorizeOrganizer(address account) external onlyOwner {
        require(account != address(0), "Direccion invalida");
        require(!isOrganizer[account], "Ya es organizador");
        isOrganizer[account] = true;
        emit OrganizerAuthorized(account);
    }

    function revokeOrganizer(address account) external onlyOwner {
        require(isOrganizer[account], "No es organizador");
        require(account != owner, "No puedes revocar al owner");
        isOrganizer[account] = false;
        emit OrganizerRevoked(account);
    }

    function createEvent(
        string calldata name,
        string calldata venue,
        uint256 date,
        uint256 originalPrice,
        uint256 maxResalePrice,
        uint256 totalTickets
    ) external onlyOrganizer returns (uint256) {
        require(bytes(name).length > 0, "Nombre vacio");
        require(date > block.timestamp, "La fecha debe ser futura");
        require(totalTickets > 0, "Debe emitir al menos 1 ticket");
        require(maxResalePrice >= originalPrice, "El tope de reventa no puede ser menor al precio original");

        uint256 eventId = nextEventId++;

        events[eventId] = Event({
            id: eventId,
            name: name,
            venue: venue,
            date: date,
            originalPrice: originalPrice,
            maxResalePrice: maxResalePrice,
            totalTickets: totalTickets,
            ticketsSold: 0,
            organizer: msg.sender,
            active: true
        });

        allEventIds.push(eventId);
        emit EventCreated(eventId, name, msg.sender, originalPrice, totalTickets);
        return eventId;
    }

    function closeEvent(uint256 eventId) external eventExists(eventId) onlyEventOrganizer(eventId) {
        events[eventId].active = false;
    }

    function buyTicket(uint256 eventId) external payable eventExists(eventId) returns (uint256) {
        Event storage ev = events[eventId];

        require(ev.active, "Evento cerrado");
        require(ev.date > block.timestamp, "El evento ya ocurrio");
        require(ev.ticketsSold < ev.totalTickets, "Sin tickets disponibles");
        require(msg.value == ev.originalPrice, "Monto incorrecto");

        uint256 ticketId = nextTicketId++;
        ev.ticketsSold += 1;

        tickets[ticketId] = Ticket({
            id: ticketId,
            eventId: eventId,
            owner: msg.sender,
            purchasePrice: msg.value,
            used: false
        });

        allTicketIds.push(ticketId);
        ticketsByOwner[msg.sender].push(ticketId);

        (bool sent, ) = ev.organizer.call{value: msg.value}("");
        require(sent, "Fallo el pago al organizador");

        emit TicketPurchased(ticketId, eventId, msg.sender, msg.value);
        return ticketId;
    }

    function listForResale(uint256 ticketId, uint256 price) external ticketExists(ticketId) onlyTicketOwner(ticketId) {
        Ticket storage t = tickets[ticketId];
        Event storage ev = events[t.eventId];

        require(!t.used, "Ticket ya usado");
        require(ev.date > block.timestamp, "El evento ya ocurrio");
        require(price > 0, "Precio invalido");
        require(price <= ev.maxResalePrice, "Excede el precio maximo de reventa");
        require(!listings[ticketId].active, "Ya esta listado");

        listings[ticketId] = Listing({
            ticketId: ticketId,
            seller: msg.sender,
            price: price,
            active: true
        });

        emit TicketListedForResale(ticketId, msg.sender, price);
    }

    function cancelListing(uint256 ticketId) external ticketExists(ticketId) onlyTicketOwner(ticketId) {
        require(listings[ticketId].active, "No esta listado");
        listings[ticketId].active = false;
        emit ResaleCancelled(ticketId);
    }

    function buyResaleTicket(uint256 ticketId) external payable ticketExists(ticketId) {
        Listing storage l = listings[ticketId];
        Ticket storage t = tickets[ticketId];
        Event storage ev = events[t.eventId];

        require(l.active, "Ticket no esta en reventa");
        require(!t.used, "Ticket ya usado");
        require(ev.date > block.timestamp, "El evento ya ocurrio");
        require(msg.value == l.price, "Monto incorrecto");
        require(msg.sender != l.seller, "No puedes comprarte a ti mismo");

        address previousOwner = l.seller;
        uint256 fee = (msg.value * resaleFeePercent) / 100;
        uint256 sellerAmount = msg.value - fee;

        t.owner = msg.sender;
        t.purchasePrice = msg.value;
        l.active = false;

        ticketsByOwner[msg.sender].push(ticketId);

        (bool sentSeller, ) = previousOwner.call{value: sellerAmount}("");
        require(sentSeller, "Fallo pago al vendedor");

        if (fee > 0) {
            (bool sentFee, ) = ev.organizer.call{value: fee}("");
            require(sentFee, "Fallo cobro de comision");
        }

        emit TicketResold(ticketId, previousOwner, msg.sender, msg.value);
    }

    function useTicket(uint256 ticketId) external ticketExists(ticketId) {
        Ticket storage t = tickets[ticketId];
        Event storage ev = events[t.eventId];

        require(ev.organizer == msg.sender, "Solo el organizador puede validar");
        require(!t.used, "Ya fue usado");

        t.used = true;

        if (listings[ticketId].active) {
            listings[ticketId].active = false;
        }

        emit TicketUsed(ticketId, msg.sender);
    }

    function getAllEventIds() external view returns (uint256[] memory) {
        return allEventIds;
    }

    function getAllTicketIds() external view returns (uint256[] memory) {
        return allTicketIds;
    }

    function getMyTickets(address user) external view returns (uint256[] memory) {
        uint256[] memory raw = ticketsByOwner[user];
        uint256 count = 0;
        for (uint256 i = 0; i < raw.length; i++) {
            if (tickets[raw[i]].owner == user) {
                count++;
            }
        }
        uint256[] memory result = new uint256[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < raw.length; i++) {
            if (tickets[raw[i]].owner == user) {
                result[j++] = raw[i];
            }
        }
        return result;
    }

    function getActiveListings() external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allTicketIds.length; i++) {
            if (listings[allTicketIds[i]].active) count++;
        }
        uint256[] memory result = new uint256[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < allTicketIds.length; i++) {
            if (listings[allTicketIds[i]].active) {
                result[j++] = allTicketIds[i];
            }
        }
        return result;
    }
}
