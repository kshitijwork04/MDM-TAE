// ---- State ----
// books and reservations now live in the Turso database (backend).
// this file just loads them through the API and re-renders.
let books = [];
let myReservations = [];
let savedName = "";
let savedMobile = "";
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
const reserveModal = document.getElementById("reserveModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const modalBookTitle = document.getElementById("modalBookTitle");
const modalBookAuthor = document.getElementById("modalBookAuthor");
const modalName = document.getElementById("modalName");
const modalMobile = document.getElementById("modalMobile");
const modalConfirm = document.getElementById("modalConfirm");
const nameError = document.getElementById("nameError");
const mobileError = document.getElementById("mobileError");

// ---- Load data from the API ----
async function loadData() {
    // get all books from the server
    const res = await fetch("/api/books");
    const bookRows = await res.json();

    // the database returns snake_case columns, renaming them for the view
    books = bookRows.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        genre: b.genre,
        totalCopies: b.total_copies,
        availableCopies: b.available_copies,
    }));

    // get reservations (already joined with book info on the server)
    const res2 = await fetch("/api/reservations");
    const reservRows = await res2.json();

    myReservations = reservRows.map(r => ({
        id: r.id,
        bookId: r.book_id,
        title: r.title,
        author: r.author,
        genre: r.genre,
        reservedBy: r.user_name,
        mobile: r.mobile,
    }));

    // populate genre filter once, then render
    populateGenreFilter();
    renderBooks(books);
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

// ---- Stats ----
function updateStats() {
    let total = books.reduce((s, b) => s + b.totalCopies, 0);
    let avail = books.reduce((s, b) => s + b.availableCopies, 0);
    statTotal.textContent = total;
    statAvailable.textContent = avail;
    statReserved.textContent = myReservations.length;

    if (myReservations.length > 0) {
        navReserved.classList.remove("hidden");
        navReserved.classList.add("inline-flex");
        navCount.textContent = myReservations.length;
    } else {
        navReserved.classList.add("hidden");
        navReserved.classList.remove("inline-flex");
    }
}

function updateUserBadge() {
    if (savedName) {
        userBadge.classList.remove("hidden");
        userBadge.classList.add("flex");
        userInitial.textContent = savedName.charAt(0).toUpperCase();
        userNameEl.textContent = savedName.split(" ")[0];
    }
}

// ---- Render Books ----
function renderBooks(bookList) {
    if (bookList.length === 0) {
        bookGrid.innerHTML = "";
        noResults.classList.remove("hidden");
        bookCount.textContent = "0 books";
        return;
    }

    noResults.classList.add("hidden");
    bookCount.textContent = bookList.length + " book" + (bookList.length !== 1 ? "s" : "");

    bookGrid.innerHTML = bookList.map(book => {
        let isAvail = book.availableCopies > 0;
        let isReserved = myReservations.some(r => r.bookId === book.id);
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
    if (myReservations.length === 0) {
        reservationList.innerHTML = "";
        noReservations.classList.remove("hidden");
        updateStats();
        return;
    }

    noReservations.classList.add("hidden");

    reservationList.innerHTML = myReservations.map(book => {
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

function getFilteredBooks() {
    let q = searchInput.value.toLowerCase().trim();
    let g = genreFilter.value;
    return books.filter(b => {
        let ok = b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
        return ok && (g === "all" || b.genre === g);
    });
}

// ---- Modal ----
function openReserveModal(bookId) {
    let book = books.find(b => b.id === bookId);
    if (!book) return;

    pendingBookId = bookId;
    modalBookTitle.textContent = book.title;
    modalBookAuthor.textContent = book.author + "  ·  " + book.genre;

    modalName.value = savedName;
    modalMobile.value = savedMobile;
    nameError.classList.add("hidden");
    mobileError.classList.add("hidden");
    modalName.classList.remove("border-red-300");
    modalMobile.classList.remove("border-red-300");

    reserveModal.classList.remove("hidden");
    reserveModal.classList.add("flex");
    document.body.style.overflow = "hidden";

    if (!savedName) modalName.focus();
}

function closeModal() {
    reserveModal.classList.add("hidden");
    reserveModal.classList.remove("flex");
    document.body.style.overflow = "";
    pendingBookId = null;
}

// confirm the reservation → saves it to the database via the API
async function confirmReserve() {
    let name = modalName.value.trim();
    let mobile = modalMobile.value.trim();
    let valid = true;

    if (!name) {
        nameError.classList.remove("hidden");
        modalName.classList.add("border-red-300");
        valid = false;
    } else {
        nameError.classList.add("hidden");
        modalName.classList.remove("border-red-300");
    }

    if (!mobile || mobile.length !== 10 || !/^\d+$/.test(mobile)) {
        mobileError.classList.remove("hidden");
        modalMobile.classList.add("border-red-300");
        valid = false;
    } else {
        mobileError.classList.add("hidden");
        modalMobile.classList.remove("border-red-300");
    }

    if (!valid) return;

    // remember for next time
    savedName = name;
    savedMobile = mobile;
    updateUserBadge();

    // ask the server to reserve this book
    const res = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: pendingBookId, name, mobile }),
    });

    const data = await res.json();

    if (data.success) {
        closeModal();
        await loadData();      // refresh books & reservations from db
        showToast("Reserved");
    } else {
        showToast("Failed: " + (data.error || "unknown error"));
    }
}

// ---- Cancel ----
async function cancelReservation(reservationId) {
    const res = await fetch("/api/reservations/" + reservationId, {
        method: "DELETE",
    });
    const data = await res.json();

    if (data.success) {
        await loadData();
        showToast("Reservation cancelled");
    } else {
        showToast("Failed to cancel");
    }
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
modalName.addEventListener("keydown", e => { if (e.key === "Enter") confirmReserve(); });
modalMobile.addEventListener("keydown", e => { if (e.key === "Enter") confirmReserve(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// boot up
loadData();