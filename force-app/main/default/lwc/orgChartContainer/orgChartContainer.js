import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { style, layout } from './cytoscapeConfig';

import cytoscapeJS from '@salesforce/resourceUrl/cytoscapeJS';
import getOrgChartLinks from '@salesforce/apex/OrgChartController.getOrgChartLinks';
import EditModal from 'c/orgChartModal';

export default class OrgTreeContainer extends LightningElement {
    @api recordId;

    cyto;
    cytoscapeLoaded = false;
    cytoscapeRendered = false;
    contactNodes = [];

    debugMode = true;

    @wire(getOrgChartLinks, { accountId: '$recordId' })
    wiredLinks({ error, data }) {
        if (data) {
            this.debug('wiredLinks data', data);
            if (data.length === 0) {
                this.contactNodes = [{
                    data: {
                        id: 'start-node',
                        label: 'Organigramm starten',
                    }
                }];
            } else {
                this.contactNodes = this.generateNodesFromLinkers(data);
            }
            this.initializeCytoscape();
        } else if (error) {
            this.debug('wiredLinks error', error);
        }
    }

    initializeCytoscape() {
        if (this.cytoscapeLoaded) {
            this.renderCytoscape();
            return;
        }

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

    generateNodesFromLinkers(linkers) {
        const nodes = [];
        const edges = [];
        const addedNodeIds = new Set();

        linkers.forEach(link => {
            const parent = link.Parent__r;
            const child = link.Child__r;

            // Parent Node
            if (parent && !addedNodeIds.has(parent.Id)) {
                nodes.push({
                    data: {
                        id: parent.Id,
                        label: parent.Name + '(' + parent.Department || 'Keine Abteilung' + ')',
                    }
                });
                addedNodeIds.add(parent.Id);
            }

            // Child Node
            if (child) {
                if (!addedNodeIds.has(child.Id)) {
                    nodes.push({
                        data: {
                            id: child.Id,
                            label: child.Name + '(' + child.Department || 'Keine Abteilung' + ')',
                        }
                    });
                    addedNodeIds.add(child.Id);
                }

                edges.push({
                    data: {
                        id: parent.Id + '-' + child.Id,
                        source: parent.Id,
                        target: child.Id
                    }
                });
            } else {
                // Leerer Child → Titel anzeigen
                const pseudoId = 'empty-' + link.Id;
                nodes.push({
                    data: {
                        id: pseudoId,
                    }
                });

                edges.push({
                    data: {
                        id: `${parent.Id}-${pseudoId}`,
                        source: parent.Id,
                        target: pseudoId
                    }
                });
            }
        });

        return [...nodes, ...edges];
    }

    async openLightningModal(node) {
        const result = await EditModal.open({
            size: 'small',
            content: {
                parentId: node.id,
                accountId: this.recordId
            }
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
