// ---- State ----
// Everything lives in the browser via localStorage — no server, no database,
// just works by opening index.html in any browser.
let books = [];
let myReservations = [];
// who is logged in (demo auth — set by login.html)
let currentUser = sessionStorage.getItem("lbUser") || "";
let savedMobile = localStorage.getItem("lbMobile") || "";
let pendingBookId = null;

// genre colors — saturated, visible
const genreColor = {
    "Fiction":     "#4f46e5",
    "Science":     "#0284c7",
    "Fantasy":     "#7c3aed",
    "Non-Fiction": "#d97706",
};

// ---- DOM ----
const bookGrid = document.getElementById("bookGrid");
const noResults = document.getElementById("noResults");
const bookCount = document.getElementById("bookCount");
const reservationList = document.getElementById("reservationList");
const noReservations = document.getElementById("noReservations");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const genreFilter = document.getElementById("genreFilter");
const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toastMsg");
const statTotal = document.getElementById("statTotal");
const statAvailable = document.getElementById("statAvailable");
const statReserved = document.getElementById("statReserved");
const navReserved = document.getElementById("navReserved");
const navCount = document.getElementById("navCount");
const userBadge = document.getElementById("userBadge");
const userInitial = document.getElementById("userInitial");
const userNameEl = document.getElementById("userName");
const loginLink = document.getElementById("loginLink");
const logoutBtn = document.getElementById("logoutBtn");
const sidebarPrompt = document.getElementById("sidebarPrompt");
const reserveModal = document.getElementById("reserveModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const modalBookTitle = document.getElementById("modalBookTitle");
const modalBookAuthor = document.getElementById("modalBookAuthor");
const modalMobile = document.getElementById("modalMobile");
const modalConfirm = document.getElementById("modalConfirm");
const mobileError = document.getElementById("mobileError");

// the starting catalogue — used only the first time (seeds localStorage)
function seedBooks() {
    return [
        { id: 1, title: "The Great Gatsby", author: "F. Scott Fitzgerald", genre: "Fiction", totalCopies: 4, availableCopies: 3 },
        { id: 2, title: "1984", author: "George Orwell", genre: "Fiction", totalCopies: 3, availableCopies: 0 },
        { id: 3, title: "To Kill a Mockingbird", author: "Harper Lee", genre: "Fiction", totalCopies: 5, availableCopies: 2 },
        { id: 4, title: "A Brief History of Time", author: "Stephen Hawking", genre: "Science", totalCopies: 2, availableCopies: 2 },
        { id: 5, title: "The Hobbit", author: "J.R.R. Tolkien", genre: "Fantasy", totalCopies: 3, availableCopies: 1 },
        { id: 6, title: "Pride and Prejudice", author: "Jane Austen", genre: "Fiction", totalCopies: 4, availableCopies: 4 },
        { id: 7, title: "Sapiens", author: "Yuval Noah Harari", genre: "Non-Fiction", totalCopies: 2, availableCopies: 0 },
        { id: 8, title: "The Alchemist", author: "Paulo Coelho", genre: "Fiction", totalCopies: 3, availableCopies: 2 },
        { id: 9, title: "Atomic Habits", author: "James Clear", genre: "Non-Fiction", totalCopies: 4, availableCopies: 3 },
        { id: 10, title: "Harry Potter and the Sorcerer's Stone", author: "J.K. Rowling", genre: "Fantasy", totalCopies: 5, availableCopies: 1 },
    ];
}

function saveBooks()    { localStorage.setItem("lbBooks", JSON.stringify(books)); }
function saveReservations() { localStorage.setItem("lbReservations", JSON.stringify(myReservations)); }

// ---- Load data from localStorage ----
function loadData() {
    let raw = localStorage.getItem("lbBooks");
    if (!raw) {
        books = seedBooks();
        saveBooks();
    } else {
        books = JSON.parse(raw);
    }

    // reservations only store the book id, so attach the book's title/author/genre
    myReservations = (JSON.parse(localStorage.getItem("lbReservations") || "[]")).map(r => {
        let b = books.find(x => x.id === r.bookId);
        return {
            id: r.id,
            bookId: r.bookId,
            title: b ? b.title : "Unknown book",
            author: b ? b.author : "",
            genre: b ? b.genre : "",
            reservedBy: r.reservedBy,
            mobile: r.mobile,
        };
    });

    populateGenreFilter();
    filterBooks();            // respects any active search/genre filter
    renderReservations();
}

function populateGenreFilter() {
    // only fill once so the dropdown doesn't duplicate options
    if (genreFilter.options.length > 1) return;

    [...new Set(books.map(b => b.genre))].forEach(g => {
        let o = document.createElement("option");
        o.value = g; o.textContent = g;
        genreFilter.appendChild(o);
    });
}

// reservations that belong to the logged-in user
function currentUserReservations() {
    if (!currentUser) return [];
    return myReservations.filter(r => r.reservedBy.toLowerCase() === currentUser.toLowerCase());
}

// ---- Stats ----
function updateStats() {
    let total = books.reduce((s, b) => s + b.totalCopies, 0);
    let avail = books.reduce((s, b) => s + b.availableCopies, 0);
    let mine = currentUserReservations().length;

    statTotal.textContent = total;
    statAvailable.textContent = avail;
    statReserved.textContent = mine;

    if (mine > 0) {
        navReserved.classList.remove("hidden");
        navReserved.classList.add("inline-flex");
        navCount.textContent = mine;
    } else {
        navReserved.classList.add("hidden");
        navReserved.classList.remove("inline-flex");
    }
}

function updateUserBadge() {
    if (currentUser) {
        userBadge.classList.remove("hidden");
        userBadge.classList.add("flex");
        userInitial.textContent = currentUser.charAt(0).toUpperCase();
        userNameEl.textContent = currentUser.split(" ")[0];
        loginLink.classList.add("hidden");
        logoutBtn.classList.remove("hidden");
    } else {
        userBadge.classList.add("hidden");
        userBadge.classList.remove("flex");
        loginLink.classList.remove("hidden");
        logoutBtn.classList.add("hidden");
    }
}

function logout() {
    sessionStorage.removeItem("lbUser");
    window.location.href = "index.html";
}

// ---- Render Books ----
function renderBooks(bookList) {
    if (bookList.length === 0) {
        bookGrid.innerHTML = "";
        noResults.classList.remove("hidden");
        bookCount.textContent = "0 books";
        updateStats();
        return;
    }

    noResults.classList.add("hidden");
    bookCount.textContent = bookList.length + " book" + (bookList.length !== 1 ? "s" : "");

    bookGrid.innerHTML = bookList.map(book => {
        let isAvail = book.availableCopies > 0;
        let isReserved = currentUserReservations().some(r => r.bookId === book.id);
        let color = genreColor[book.genre] || "#4f46e5";
        let pct = book.totalCopies > 0 ? (book.availableCopies / book.totalCopies) * 100 : 0;

        return `
            <div class="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md hover:border-zinc-300 transition-all duration-200">
                <div class="h-[3px]" style="background:${color}"></div>
                <div class="p-4 flex flex-col flex-1">
                    <div class="flex items-start justify-between gap-2 mb-1.5">
                        <h3 class="font-bold text-zinc-900 text-[13px] leading-snug">${book.title}</h3>
                        <span class="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${isAvail ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-zinc-500 bg-zinc-100 border border-zinc-200'}">
                            ${isAvail ? book.availableCopies + ' left' : '0 left'}
                        </span>
                    </div>
                    <p class="text-[12px] text-zinc-500 mb-2 font-medium">${book.author}</p>
                    <span class="inline-flex self-start text-[10px] font-bold px-2 py-0.5 rounded border" style="color:${color}; background:${color}0d; border-color:${color}33">${book.genre}</span>

                    <div class="mt-auto pt-4">
                        <div class="h-1.5 bg-zinc-100 rounded-full overflow-hidden mb-3">
                            <div class="h-full rounded-full transition-all duration-500" style="width:${pct}%; background:${color}"></div>
                        </div>

                        ${isReserved
                            ? `<button disabled class="w-full py-2 rounded-lg text-[12px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-200 cursor-default">
                                &#10003; Reserved
                               </button>`
                            : isAvail
                                ? `<button onclick="openReserveModal(${book.id})"
                                    class="w-full py-2 rounded-lg text-[12px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 transition shadow-sm">
                                    Reserve
                                   </button>`
                                : `<button disabled class="w-full py-2 rounded-lg text-[12px] font-bold text-zinc-400 bg-zinc-100 border border-zinc-200 cursor-not-allowed">
                                    Unavailable
                                   </button>`
                        }
                    </div>
                </div>
            </div>
        `;
    }).join("");

    updateStats();
}

// ---- Render Reservations ----
function renderReservations() {
    if (!currentUser) {
        // not logged in — show a prompt instead of a list
        reservationList.innerHTML = "";
        sidebarPrompt.classList.remove("hidden");
        noReservations.classList.add("hidden");
        updateStats();
        return;
    }
    sidebarPrompt.classList.add("hidden");

    let mine = currentUserReservations();
    if (mine.length === 0) {
        reservationList.innerHTML = "";
        noReservations.classList.remove("hidden");
        updateStats();
        return;
    }

    noReservations.classList.add("hidden");

    reservationList.innerHTML = mine.map(book => {
        let color = genreColor[book.genre] || "#4f46e5";
        return `
            <div class="flex items-center gap-2.5 py-2.5 border-b border-zinc-100 last:border-0">
                <div class="w-1 h-8 rounded-full shrink-0" style="background:${color}"></div>
                <div class="min-w-0 flex-1">
                    <p class="text-[12px] font-bold text-zinc-800 truncate">${book.title}</p>
                    <p class="text-[10px] text-zinc-500 truncate">${book.reservedBy} &middot; ${book.mobile}</p>
                </div>
                <button onclick="cancelReservation(${book.id})"
                    class="text-[11px] text-zinc-400 hover:text-red-600 font-bold shrink-0 transition px-2 py-1 rounded hover:bg-red-50">
                    Cancel
                </button>
            </div>
        `;
    }).join("");

    updateStats();
}

// ---- Search / Filter ----
function filterBooks() {
    let q = searchInput.value.toLowerCase().trim();
    let g = genreFilter.value;
    renderBooks(books.filter(b => {
        let ok = b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
        return ok && (g === "all" || b.genre === g);
    }));
}

// ---- Modal ----
function openReserveModal(bookId) {
    // reserving requires a login — send guests to the login page first
    if (!currentUser) {
        window.location.href = "login.html";
        return;
    }

    let book = books.find(b => b.id === bookId);
    if (!book) return;

    pendingBookId = bookId;
    modalBookTitle.textContent = book.title;
    modalBookAuthor.textContent = book.author + "  ·  " + book.genre;

    // name comes from the login session, only mobile is asked
    modalMobile.value = savedMobile;
    mobileError.classList.add("hidden");
    modalMobile.classList.remove("border-red-300");

    reserveModal.classList.remove("hidden");
    reserveModal.classList.add("flex");
    document.body.style.overflow = "hidden";

    modalMobile.focus();
}

function closeModal() {
    reserveModal.classList.add("hidden");
    reserveModal.classList.remove("flex");
    document.body.style.overflow = "";
    pendingBookId = null;
}

// confirm the reservation — saves straight to localStorage
function confirmReserve() {
    // name is taken from the login session, only mobile is validated
    let name = currentUser;
    let mobile = modalMobile.value.trim();
    let valid = true;

    if (!mobile || mobile.length !== 10 || !/^\d+$/.test(mobile)) {
        mobileError.classList.remove("hidden");
        modalMobile.classList.add("border-red-300");
        valid = false;
    } else {
        mobileError.classList.add("hidden");
        modalMobile.classList.remove("border-red-300");
    }

    if (!valid) return;

    // prevent double-click creating two reservations
    modalConfirm.disabled = true;

    // remember mobile for next time
    savedMobile = mobile;
    localStorage.setItem("lbMobile", mobile);

    let book = books.find(b => b.id === pendingBookId);
    if (!book || book.availableCopies <= 0) {
        modalConfirm.disabled = false;
        showToast("Failed: no copies left");
        return;
    }

    // take a copy + record the reservation
    book.availableCopies -= 1;
    myReservations.push({
        id: Date.now(),
        bookId: book.id,
        reservedBy: name,
        mobile: mobile,
    });

    saveBooks();
    saveReservations();

    modalConfirm.disabled = false;
    closeModal();
    loadData();
    showToast("Reserved");
}

// ---- Cancel ----
function cancelReservation(reservationId) {
    let idx = myReservations.findIndex(r => r.id === reservationId);
    if (idx === -1) {
        showToast("Failed to cancel");
        return;
    }

    // put the copy back, then remove the reservation
    let book = books.find(b => b.id === myReservations[idx].bookId);
    if (book) book.availableCopies += 1;

    myReservations.splice(idx, 1);
    saveBooks();
    saveReservations();

    loadData();
    showToast("Reservation cancelled");
}

// ---- Toast ----
function showToast(message) {
    toastMsg.textContent = message;
    toast.classList.remove("translate-y-16", "opacity-0");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
        toast.classList.add("translate-y-16", "opacity-0");
    }, 2000);
}

// ---- Events ----
searchBtn.addEventListener("click", filterBooks);
searchInput.addEventListener("keydown", e => { if (e.key === "Enter") filterBooks(); });
genreFilter.addEventListener("change", filterBooks);
modalClose.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
modalConfirm.addEventListener("click", confirmReserve);
modalMobile.addEventListener("keydown", e => { if (e.key === "Enter") confirmReserve(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
logoutBtn.addEventListener("click", logout);

// boot up
updateUserBadge();
loadData();