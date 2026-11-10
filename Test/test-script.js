let scene, camera, renderer, controls;
let objects = [];
let plane, visualFloor, wall1, wall2;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let selectedObject = null;
let isDraggingObject = false;

const container = document.getElementById('canvas-container');

window.addEventListener('DOMContentLoaded', () => {
    init();
    animate();
});

// Converte il valore inserito in base all'unità scelta (se cm, divide per 100 per adattarlo alla scala 3D)
function getScaleFactor() {
    const unit = document.getElementById('unit-scale').value;
    return unit === 'cm' ? 0.01 : 1.0;
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);
    scene.fog = new THREE.FogExp2(0x0b0f19, 0.025);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 10, 16);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffedd5, 0.8);
    dirLight.position.set(10, 20, 15);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Piano invisibile iniziale per raycasting
    const planeGeo = new THREE.PlaneGeometry(40, 40);
    planeGeo.rotateX(-Math.PI / 2);
    plane = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ visible: false }));
    scene.add(plane);

    // Costruisce la stanza iniziale
    rebuildRoom();

    // Eventi
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onWindowResize);

    // UI Eventi Stanza
    document.getElementById('btn-update-room').addEventListener('click', rebuildRoom);
    
    // UI Eventi Mobili
    document.getElementById('btn-add').addEventListener('click', addNewObject);
    document.getElementById('btn-delete').addEventListener('click', deleteSelectedObject);
    
    document.getElementById('edit-color').addEventListener('input', (e) => {
        if (selectedObject) selectedObject.material.color.set(e.target.value);
    });

    ['edit-width', 'edit-height', 'edit-depth'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateSelectedObjectDimensions);
    });

    createMesh('box', 0, 0, '#f97316', 2.5, 1.2, 2.0);
}

// Funzione che ricrea la stanza in base alle dimensioni inserite
function rebuildRoom() {
    const factor = getScaleFactor();
    const w = parseFloat(document.getElementById('room-width').value) * factor;
    const h = parseFloat(document.getElementById('room-height').value) * factor;
    const d = parseFloat(document.getElementById('room-depth').value) * factor;

    const floorColor = document.getElementById('floor-color').value;
    const wallColor = document.getElementById('wall-color').value;

    // Rimuove vecchi elementi stanza se esistono
    if (visualFloor) scene.remove(visualFloor);
    if (wall1) scene.remove(wall1);
    if (wall2) scene.remove(wall2);

    // Nuovo Pavimento
    visualFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(floorColor), roughness: 0.8 })
    );
    visualFloor.rotation.x = -Math.PI / 2;
    visualFloor.receiveShadow = true;
    scene.add(visualFloor);

    // Nuovi Muri
    const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(wallColor), roughness: 0.9 });
    
    wall1 = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.4), wallMat);
    wall1.position.set(0, h / 2, -d / 2);
    scene.add(wall1);

    wall2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, d), wallMat);
    wall2.position.set(-w / 2, h / 2, 0);
    scene.add(wall2);

    // Aggiorna anche il piano di trascinamento
    plane.scale.set(w / 20, 1, d / 20);
}

function createMesh(type, x, z, colorHex, wInput, hInput, dInput) {
    const factor = getScaleFactor();
    const w = wInput * factor;
    const h = hInput * factor;
    const d = dInput * factor;

    let geometry = (type === 'cylinder') 
        ? new THREE.CylinderGeometry(w / 2, w / 2, h, 32) 
        : new THREE.BoxGeometry(w, h, d);

    const material = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { type, width: wInput, height: hInput, depth: dInput };

    scene.add(mesh);
    objects.push(mesh);
    return mesh;
}

function addNewObject() {
    const type = document.getElementById('object-type').value;
    const color = document.getElementById('object-color').value;
    const w = parseFloat(document.getElementById('new-width').value) || 2;
    const h = parseFloat(document.getElementById('new-height').value) || 1.2;
    const d = parseFloat(document.getElementById('new-depth').value) || 2;

    const newMesh = createMesh(type, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, color, w, h, d);
    selectObject(newMesh);
}

function updateSelectedObjectDimensions() {
    if (!selectedObject) return;
    const factor = getScaleFactor();
    const wInput = parseFloat(document.getElementById('edit-width').value) || 1;
    const hInput = parseFloat(document.getElementById('edit-height').value) || 1;
    const dInput = parseFloat(document.getElementById('edit-depth').value) || 1;

    const w = wInput * factor;
    const h = hInput * factor;
    const d = dInput * factor;

    selectedObject.geometry.dispose();
    selectedObject.geometry = (selectedObject.userData.type === 'cylinder')
        ? new THREE.CylinderGeometry(w / 2, w / 2, h, 32)
        : new THREE.BoxGeometry(w, h, d);

    selectedObject.position.y = h / 2;
    selectedObject.userData.width = wInput;
    selectedObject.userData.height = hInput;
    selectedObject.userData.depth = dInput;
}

function getIntersection(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / renderer.domElement.clientWidth) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
}

function onPointerDown(e) {
    getIntersection(e);
    const intersects = raycaster.intersectObjects(objects);

    if (intersects.length > 0) {
        selectObject(intersects[0].object);
        isDraggingObject = true;
        controls.enabled = false;
    } else {
        deselectObject();
    }
}

function onPointerMove(e) {
    if (!isDraggingObject || !selectedObject) return;

    getIntersection(e);
    const intersects = raycaster.intersectObject(plane);

    if (intersects.length > 0) {
        selectedObject.position.x = intersects[0].point.x;
        selectedObject.position.z = intersects[0].point.z;
    }
}

function onPointerUp() {
    isDraggingObject = false;
    controls.enabled = true;
}

function selectObject(mesh) {
    selectedObject = mesh;
    document.getElementById('selected-panel').classList.remove('hidden');
    document.getElementById('selected-info').innerText = `Oggetto Selezionato`;
    document.getElementById('edit-color').value = '#' + mesh.material.color.getHexString();
    document.getElementById('edit-width').value = mesh.userData.width || 2;
    document.getElementById('edit-height').value = mesh.userData.height || 1.2;
    document.getElementById('edit-depth').value = mesh.userData.depth || 2;
}

function deselectObject() {
    selectedObject = null;
    document.getElementById('selected-panel').classList.add('hidden');
}

function deleteSelectedObject() {
    if (!selectedObject) return;
    scene.remove(selectedObject);
    objects = objects.filter(o => o !== selectedObject);
    deselectObject();
}

function onWindowResize() {
    if (!container) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
