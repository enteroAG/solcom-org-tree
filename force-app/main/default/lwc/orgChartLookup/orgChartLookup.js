import { LightningElement, api, wire, track } from 'lwc';
import searchContacts from '@salesforce/apex/OrgChartController.searchContacts';

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

export default class OrgChartLookupDrawer extends LightningElement {
    @api placeholder = 'Suchen...';
    @api disabled = false;

    @track inputValue = '';
    isOpen = false;
    isLoading = false;

    results = [];               // [{Id, Name, Title}]
    selection = null;           // { id, name } (egal ob Contact oder Freitext)
    inputId = this.generateUUID();

    debounceTimer;

    // Sichtbarkeit
    get hasSelection() { return this.selection !== null; }
    get hasResults() { return (this.results?.length || 0) > 0; }
    get showDrawer() { return this.isOpen && !this.hasSelection; }
    get selectionLabel() { return this.selection?.name; }

    // Optionen fürs Template
    get freeTextOption() {
        const value = (this.inputValue || '').trim();
        return { primary: value ? `Verwenden: “${value}”` : 'Eingabe übernehmen' };
    }
    get recordOptions() {
        return (this.results || []).map((contact, index) => ({
            key: contact.Id,
            index: index + 1, // 0 ist Freitext
            primary: contact.Name,
            secondary: contact.Title,
            recordId: contact.Id
        }));
    }

    // UUID v4
    generateUUID() {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
    }

    // Apex Wire (reagiert auf inputValue)
    @wire(searchContacts, { searchKey: '$inputValue' })
    wiredContacts({ data, error }) {
        if (error) { this.results = []; this.isLoading = false; return; }
        if (data) {
            if ((this.inputValue || '').trim().length < MIN_CHARS) { this.results = []; this.isLoading = false; return; }
            this.results = data; this.isLoading = false;
        }
    }

    // Drawer öffnen
    openDrawer() {
        if (!this.disabled) {
            this.isOpen = true;
        }
    }

    // Eingabe mit Debounce
    handleInput(event) {
        this.inputValue = event.target.value || '';
        this.selection = null;
        this.openDrawer();

        const length = (this.inputValue || '').trim().length;
        clearTimeout(this.debounceTimer);

        if (length === 0) { this.results = []; this.isLoading = false; return; }
        if (length < MIN_CHARS) { this.results = []; this.isLoading = false; return; }

        this.isLoading = true;
        this.debounceTimer = setTimeout(() => {
            if (!this.inputValue) this.isLoading = false;
        }, DEBOUNCE_MS);
    }

    // Klick auf Freitext oder Contact
    handleOptionClick(event) {
        const index = Number(event.currentTarget?.dataset?.index);
        if (Number.isNaN(index)) return;

        if (index === 0) {
            const name = (this.inputValue || '').trim();
            if (!name) return;
            this.commitSelection({ id: this.generateUUID(), name: name }); // Freitext → UUID
        } else {
            const contact = this.results[index - 1];
            if (contact) this.commitSelection({ id: contact.Id, name: contact.Name });
        }
    }

    // Auswahl übernehmen und Event senden
    commitSelection(selection) {
        this.selection = selection;
        this.inputValue = selection.name || '';
        this.isOpen = false;

        this.dispatchEvent(new CustomEvent('change', {
            detail: selection, // { id, name }
            bubbles: true,
            composed: true
        }));
    }

    // Auswahl löschen (und Parent informieren)
    clearSelection() {
        this.selection = null;
        this.dispatchEvent(new CustomEvent('change', {
            detail: null,
            bubbles: true,
            composed: true
        }));
        const input = this.template.querySelector('input');
        if (input) input.focus();
    }
}
