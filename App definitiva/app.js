const SUPABASE_URL = 'https://hghwhtrngvydaalozrwi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_FIs5wasc1BLrGbhzZXkm-g_lFE8H-yb';

const dbClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let currentUser = null;
let userHouses = [];
let currentHouseId = null;
let currentRoomId = null;

let scene, camera, renderer, controls;

// All'avvio controlla se l'utente ha una sessione attiva su Supabase
window.addEventListener('DOMContentLoaded', async () => {
    if (dbClient) {
        const { data: { session } } = await dbClient.auth.getSession();
        if (!session) {
            openWelcomeModal();
        } else {
            currentUser = session.user;
            updateUserProfileUI();
            await loadDataFromSupabase();
        }
    } else {
        openWelcomeModal();
    }
});

// Gestione Tab Accesso / Registrazione
function switchAuthTab(mode) {
    const isReg = (mode === 'register');
    document.getElementById('tab-register').className = `flex-1 py-2 text-xs font-semibold rounded-lg transition ${isReg ? 'bg-orange-500 text-white' : 'text-slate-400'}`;
    document.getElementById('tab-login').className = `flex-1 py-2 text-xs font-semibold rounded-lg transition ${!isReg ? 'bg-orange-500 text-white' : 'text-slate-400'}`;
    document.getElementById('register-fields').classList.toggle('hidden', !isReg);
    document.getElementById('auth-submit-btn').innerText = isReg ? "Registrati" : "Accedi";
    document.getElementById('auth-title').innerText = isReg ? "Crea un Account" : "Benvenuto in Casa 3D";
}

// Autenticazione ufficiale Supabase (Registrazione o Login)
async function handleAuthAction() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    if (!email || !password) return alert("Inserisci email e password.");

    const isReg = !document.getElementById('register-fields').classList.contains('hidden');

    if (isReg) {
        const name = document.getElementById('reg-name').value.trim();
        const surname = document.getElementById('reg-surname').value.trim();
        if (!name || !surname) return alert("Inserisci nome e cognome.");

        const { data, error } = await dbClient.auth.signUp({ email, password, options: { data: { name, surname } } });
        if (error) return alert("Errore: " + error.message);
        currentUser = data.user;
        alert("Registrazione completata!");
    } else {
        const { data, error } = await dbClient.auth.signInWithPassword({ email, password });
        if (error) return alert("Credenziali non valide.");
        currentUser = data.user;
    }

    document.getElementById('modal-welcome').classList.add('hidden');
    updateUserProfileUI();
    await loadDataFromSupabase();
}

async function logoutUser() {
    if (!confirm("Vuoi uscire?")) return;
    await dbClient.auth.signOut();
    currentUser = null;
    openWelcomeModal();
}

function openWelcomeModal() { document.getElementById('modal-welcome').classList.remove('hidden'); }

function updateUserProfileUI() {
    const el = document.getElementById('user-display-name');
    if (el && currentUser) {
        const meta = currentUser.user_metadata || {};
        el.innerText = meta.name ? `${meta.name} ${meta.surname || ''}` : currentUser.email;
    }
}

// Caricamento dati da Supabase (Case, Stanze, Spesa, Oggetti)
async function loadDataFromSupabase() {
    try {
        if (!dbClient) return;
        const urlParams = new URLSearchParams(window.location.search);
        const sharedHouseId = urlParams.get('house');

        const { data: housesData, error } = await dbClient.from('houses').select('*');
        if (error) throw error;

        if (!housesData || housesData.length === 0) {
            const { data: newH } = await dbClient.from('houses').insert([{ name: 'Casa Principale' }]).select();
            userHouses = [{ id: newH[0].id, name: newH[0].name, shoppingList: [], rooms: [] }];
        } else {
            userHouses = [];
            for (let h of housesData) {
                const { data: roomsData } = await dbClient.from('rooms').select('*').eq('house_id', h.id);
                const rooms = [];
                if (roomsData) {
                    for (let r of roomsData) {
                        const { data: itemsData } = await dbClient.from('items').select('*').eq('room_id', r.id);
                        rooms.push({
                            id: r.id, name: r.name, type: r.type,
                            furniture: r.furniture ? JSON.parse(r.furniture) : [],
                            items: itemsData ? itemsData.map(i => ({ id: i.id, name: i.name, location: i.location, desc: i.desc, photo: i.photo_url })) : []
                        });
                    }
                }
                const { data: shopData } = await dbClient.from('shopping').select('*').eq('house_id', h.id);
                const shoppingList = shopData ? shopData.map(s => ({ id: s.id, text: s.text, completed: s.completed })) : [];
                userHouses.push({ id: h.id, name: h.name, shoppingList, rooms });
            }
        }

        currentHouseId = (sharedHouseId && userHouses.some(h => h.id === sharedHouseId)) ? sharedHouseId : userHouses[0].id;
        updateHouseSelectUI();
        renderSidebarRooms();
        renderRoomsGrid();
        renderShoppingList();
    } catch (err) {
        console.error("Errore caricamento:", err);
    }
}

function getCurrentHouse() { return userHouses.find(h => h.id === currentHouseId) || userHouses[0]; }
function switchHouse(id) { currentHouseId = id; currentRoomId = null; goToPlan(); updateHouseSelectUI(); renderShoppingList(); }

function updateHouseSelectUI() {
    const select = document.getElementById('house-select');
    const titleEl = document.getElementById('sidebar-house-name');
    const house = getCurrentHouse();
    if (titleEl && house) titleEl.innerText = house.name;
    if (!select || !house) return;
    select.innerHTML = '';
    userHouses.forEach(h => {
        const opt = document.createElement('option');
        opt.value = h.id; opt.innerText = h.name;
        if (h.id === currentHouseId) opt.selected = true;
        select.appendChild(opt);
    });
}

// Gestione Case e Condivisione
function openHouseModalCustom() { document.getElementById('modal-house').classList.remove('hidden'); }
function closeHouseModalCustom() { document.getElementById('modal-house').classList.add('hidden'); }

async function submitCreateHouse() {
    const name = document.getElementById('input-new-house-name').value.trim();
    if (!name) return;
    const { data } = await dbClient.from('houses').insert([{ name }]).select();
    userHouses.push({ id: data[0].id, name, shoppingList: [], rooms: [] });
    currentHouseId = data[0].id;
    closeHouseModalCustom(); updateHouseSelectUI(); goToPlan(); renderShoppingList();
}

async function submitJoinHouse() {
    const link = document.getElementById('input-join-house-link').value.trim();
    const id = new URL(link).searchParams.get('house');
    if (id) { currentHouseId = id; closeHouseModalCustom(); await loadDataFromSupabase(); }
}

function openShareModal() {
    const house = getCurrentHouse();
    document.getElementById('share-house-id').value = `${window.location.origin}${window.location.pathname}?house=${house.id}`;
    document.getElementById('modal-share').classList.remove('hidden');
}
function closeShareModal() { document.getElementById('modal-share').classList.add('hidden'); }
function copyShareLink() { navigator.clipboard.writeText(document.getElementById('share-house-id').value); alert("Link copiato!"); }

// Gestione Lista Spesa
function openShoppingModal() { document.getElementById('modal-shopping').classList.remove('hidden'); renderShoppingList(); }
function closeShoppingModal() { document.getElementById('modal-shopping').classList.add('hidden'); }

async function addShoppingItem() {
    const input = document.getElementById('shopping-item-input');
    const text = input.value.trim();
    if (!text) return;
    const house = getCurrentHouse();
    const { data } = await dbClient.from('shopping').insert([{ house_id: house.id, text, completed: false }]).select();
    if (!house.shoppingList) house.shoppingList = [];
    house.shoppingList.push({ id: data[0].id, text, completed: false });
    input.value = ''; renderShoppingList();
}

async function toggleShoppingItem(id) {
    const house = getCurrentHouse();
    const item = house.shoppingList.find(i => i.id === id);
    if (item) { item.completed = !item.completed; await dbClient.from('shopping').update({ completed: item.completed }).eq('id', id); renderShoppingList(); }
}

async function deleteShoppingItem(id) {
    const house = getCurrentHouse();
    await dbClient.from('shopping').delete().eq('id', id);
    house.shoppingList = house.shoppingList.filter(i => i.id !== id);
    renderShoppingList();
}

function renderShoppingList() {
    const container = document.getElementById('shopping-list-container');
    const badge = document.getElementById('shopping-count-badge');
    if (!container) return;
    const house = getCurrentHouse();
    const list = house.shoppingList || [];
    badge.innerText = list.filter(i => !i.completed).length;
    container.innerHTML = list.length === 0 ? `<p class="text-xs text-slate-500 italic text-center py-4">Vuota</p>` : '';
    list.forEach(i => {
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800";
        div.innerHTML = `<span onclick="toggleShoppingItem('${i.id}')" class="text-xs cursor-pointer ${i.completed ? 'line-through text-slate-500' : 'text-slate-200'}">${i.text}</span><button onclick="deleteShoppingItem('${i.id}')" class="text-red-400"><i class="fa-solid fa-trash text-xs"></i></button>`;
        container.appendChild(div);
    });
}

// Gestione Stanze e 3D
function renderSidebarRooms() {
    const list = document.getElementById('sidebar-rooms-list');
    if (!list) return;
    list.innerHTML = '';
    const house = getCurrentHouse();
    if (!house || !house.rooms) return;
    house.rooms.forEach(r => {
        const div = document.createElement('div');
        div.className = `w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer ${currentRoomId === r.id ? 'bg-orange-500/20 text-orange-400' : 'text-slate-300 hover:bg-slate-900'}`;
        div.onclick = () => enterRoom(r.id);
        div.innerHTML = `<span>${r.name}</span><span class="text-[10px] text-slate-500">${r.items.length}</span>`;
        list.appendChild(div);
    });
}

function renderRoomsGrid() {
    const grid = document.getElementById('rooms-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const house = getCurrentHouse();
    if (!house || !house.rooms || house.rooms.length === 0) {
        grid.innerHTML = `<p class="text-xs text-slate-500 italic col-span-full text-center py-8">Nessuna stanza creata.</p>`;
        return;
    }
    house.rooms.forEach(r => {
        const card = document.createElement('div');
        card.className = "glass p-4 rounded-2xl border border-slate-800 hover:border-orange-500 transition cursor-pointer bg-slate-900/60";
        card.onclick = () => enterRoom(r.id);
        card.innerHTML = `<h4 class="text-sm font-bold text-white mb-1">${r.name}</h4><p class="text-[10px] text-orange-400">${r.items.length} oggetti</p>`;
        grid.appendChild(card);
    });
}

function enterRoom(id) {
    currentRoomId = id;
    const room = getCurrentHouse().rooms.find(r => r.id === id);
    document.getElementById('view-plan').classList.add('hidden');
    document.getElementById('view-3d').classList.remove('hidden');
    document.getElementById('room-tools-section').classList.remove('hidden');
    document.getElementById('main-view-title').innerText = room.name;
    initThreeJS(room);
}

function goToPlan() {
    currentRoomId = null;
    document.getElementById('view-3d').classList.add('hidden');
    document.getElementById('view-plan').classList.remove('hidden');
    document.getElementById('room-tools-section').classList.add('hidden');
    document.getElementById('main-view-title').innerText = "Planimetria Generale";
    renderSidebarRooms(); renderRoomsGrid();
    if (renderer) renderer.dispose();
}

function openAddRoomModal() { document.getElementById('modal-room').classList.remove('hidden'); }
function closeAddRoomModal() { document.getElementById('modal-room').classList.add('hidden'); }

async function saveNewRoom() {
    const name = document.getElementById('new-room-name').value.trim();
    if (!name) return;
    const house = getCurrentHouse();
    const { data } = await dbClient.from('rooms').insert([{ house_id: house.id, name, type: 'sala', floor_color: '#111827', wall_color: '#1f2937', furniture: JSON.stringify([]) }]).select();
    house.rooms.push({ id: data[0].id, name, type: 'sala', furniture: [], items: [] });
    closeAddRoomModal(); renderSidebarRooms(); renderRoomsGrid();
}

// Inizializzazione Motore 3D
function initThreeJS(room) {
    const container = document.getElementById('canvas-container');
    container.innerHTML = '';
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 10, 16);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    // Pavimento della stanza
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ color: 0x111827 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

// Inventario Oggetti
function openAddItemModal() { document.getElementById('modal-item').classList.remove('hidden'); }
function closeAddItemModal() { document.getElementById('modal-item').classList.add('hidden'); }

async function saveNewItem() {
    const name = document.getElementById('item-name').value.trim();
    const location = document.getElementById('item-location').value.trim();
    const desc = document.getElementById('item-desc').value.trim();
    if (!name || !location) return alert("Inserisci nome e posizione.");
    const room = getCurrentHouse().rooms.find(r => r.id === currentRoomId);
    
    const { data } = await dbClient.from('items').insert([{ room_id: room.id, name, location, desc }]).select();
    room.items.push({ id: data[0].id, name, location, desc, photo: null });
    closeAddItemModal(); renderSidebarRooms(); renderRoomsGrid();
}

async function confirmAddFurniture() {
    alert("Funzione mobile 3D attiva!");
}
