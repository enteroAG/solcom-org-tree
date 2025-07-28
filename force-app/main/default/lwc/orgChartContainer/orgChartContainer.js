import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { getRelatedListRecords } from 'lightning/uiRelatedListApi';
import { style, layout } from './cytoscapeConfig';

import EditModal from 'c/orgChartModal';
import cytoscapeJS from '@salesforce/resourceUrl/cytoscapeJS';

export default class OrgTreeContainer extends LightningElement {

    @api recordId;

    cyto;
    cytoscapeLoaded = false;
    cytoscapeRendered = false;
    contacts = [];
    contactNodes = [];

    debugMode = true;

    get hasContacts() {
        return this.contacts && this.contacts.length > 0;
    }

    @wire(getRelatedListRecords, {
        parentRecordId: '$recordId',
        relatedListId: 'Contacts',
        fields: ['Contact.Name', 'Contact.Id', 'Contact.Department'],
        sortBy: ['Contact.Name']
    })
    setRelatedContacts({ error, data }) {
        if (data) {
            this.contacts = this.parseContacts(data);
            this.contactNodes = this.generateCytoscapeNodes(this.contacts);

            this.debug('generateCytoscapeNodes', this.contactNodes);

            this.initializeCytoscape();
        } else if (error) {
            this.debug('setRelatedContacts', error);
        }
    }

    initializeCytoscape() {
        loadScript(this, cytoscapeJS)
            .then(() => {
                this.cytoscapeLoaded = true;
                this.renderCytoscape();
            })
            .catch(error => {
                this.debug('loadScript', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            });
    }

    renderCytoscape() {
        this.cyto = cytoscape({
            container: this.template.querySelector('.cy-container'),
            elements: this.contactNodes,
            style: style,
            layout: layout,
            zoom: 0.5,
        });

        this.cyto.on('tap', 'node', (evt) => {
        const nodeData = evt.target.data();
        this.openLightningModal(nodeData);
    });


        this.cytoscapeRendered = true;
    }

    generateCytoscapeNodes(contacts) {
        if (!Array.isArray(contacts)) return [];

        return contacts.map(contact => ({
            data: {
                id: contact.Department,
                label: contact.Name + ' (' + (contact.Department) + ')'
            }

        }));
    }

    parseContacts(data) {
        if (!data || !data.records) return [];

        const contacts = data.records.map(record => ({
            Id: record.Id,
            Name: record.fields.Name.value,
            Department: record.fields.Department.value ? record.fields.Department.value : 'No Department'
        }));

        this.debug('parseContacts', contacts);
        return contacts;
    }

    async openLightningModal(node) {
        const result = await EditModal.open({
                size: 'small',
                description: 'Accessible description of modal\'s purpose',
                content: node,
            });
        this.debug('openLightningModal', result);
    }

    debug(method, obj) {
        if (this.debugMode) {
            if (typeof obj === 'object') {
                console.log(method, JSON.stringify(obj, null, 2));
            } else {
                console.log(method, obj);
            }
        }
    }

}