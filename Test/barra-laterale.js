// Funzione per aggiornare l'anteprima e il testo del colore
function updateColor(hexValue, swatchId, btnTextId, labelText) {
    const swatch = document.getElementById(swatchId);
    const btnText = document.getElementById(btnTextId);
    
    if (swatch) {
        swatch.style.backgroundColor = hexValue;
    }
    if (btnText) {
        btnText.style.backgroundColor = hexValue;
        btnText.textContent = hexValue.toUpperCase() + ` (${labelText})`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Sincronizzazione colore Pavimento
    const colorPickerFloor = document.getElementById('color-picker-floor');
    if (colorPickerFloor) {
        colorPickerFloor.addEventListener('input', (e) => {
            updateColor(e.target.value, 'swatch-floor', 'btn-floor-text', 'Pavimento');
        });
    }

    // Sincronizzazione colore Muri
    const colorPickerWalls = document.getElementById('color-picker-walls');
    if (colorPickerWalls) {
        colorPickerWalls.addEventListener('input', (e) => {
            updateColor(e.target.value, 'swatch-walls', 'btn-walls-text', 'Muri');
        });
    }

    // Sincronizzazione colore Aggiungi Mobile
    const colorPickerAdd = document.getElementById('color-picker-add');
    if (colorPickerAdd) {
        colorPickerAdd.addEventListener('input', (e) => {
            updateColor(e.target.value, 'swatch-add', 'btn-add-text', 'Personalizzato');
        });
    }

    // Sincronizzazione colore Modifica Mobile
    const colorPickerEdit = document.getElementById('color-picker-edit');
    if (colorPickerEdit) {
        colorPickerEdit.addEventListener('input', (e) => {
            updateColor(e.target.value, 'swatch-edit', 'btn-edit-text', 'Personalizzato');
        });
    }

    // Azioni pulsanti
    const btnAggiornaStanza = document.getElementById('btn-aggiorna-stanza');
    if (btnAggiornaStanza) {
        btnAggiornaStanza.addEventListener('click', () => {
            const unit = document.getElementById('room-unit').value;
            console.log("Stanza aggiornata con unità: " + unit);
        });
    }

    const btnAggiungiScena = document.getElementById('btn-aggiungi-scena');
    if (btnAggiungiScena) {
        btnAggiungiScena.addEventListener('click', () => {
            const unit = document.getElementById('add-unit').value;
            console.log("Oggetto aggiunto alla scena con unità: " + unit);
        });
    }

    const btnEliminaOggetto = document.getElementById('btn-elimina-oggetto');
    if (btnEliminaOggetto) {
        btnEliminaOggetto.addEventListener('click', () => {
            console.log("Oggetto selezionato eliminato");
        });
    }
});
