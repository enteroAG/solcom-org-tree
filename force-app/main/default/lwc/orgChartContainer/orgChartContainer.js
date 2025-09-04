import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { style, layout } from './cytoscapeConfig';
import { refreshApex } from "@salesforce/apex";
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { deleteRecord } from 'lightning/uiRecordApi';

import cyDagreBundle from '@salesforce/resourceUrl/cyDagreBundle';
import getOrgChartLinks from '@salesforce/apex/OrgChartController.getOrgChartLinks';
import RecordModal from 'c/orgChartModal';

export default class OrgTreeContainer extends LightningElement {
    @api recordId;

    wiredLinksResult;

    cyto;
    cytoscapeLoaded = false;
    cytoscapeRendered = false;
    contactNodes = [];

    debugMode = true;

    @wire(getOrgChartLinks, { accountId: '$recordId' })
    wiredLinks(result) {
        this.wiredLinksResult = result;
        const { data, error } = result;
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
            this.debug('contactNodes', this.contactNodes);
        } else if (error) {
            this.debug('wiredLinks error', error);
        }
    }

    initializeCytoscape() {
        if (this.cytoscapeLoaded) {
            this.renderCytoscape();
            return;
        }

        loadScript(this, cyDagreBundle)
            .then(() => {
                this.cytoscapeLoaded = true;
                this.debug('Cytoscape and Dagre loaded');
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
        
        this.cyto.on('click', 'edge', (evt) => {
            const edgeData = evt.target.data();
            this.debug('Edge clicked', edgeData);
            this.openLightningModal(RecordModal, edgeData)
                .then(result => {
                    if (result && result.operation !== 'cancel') {
                        if (result.operation === 'delete') {
                            this.handleDeleteEdge(result.payload);
                        } else if (result.operation === 'upsert') {
                            this.refreshNodes();
                        }
                    }
                });
        });

        this.cyto.on('click', 'node', (evt) => {
            const nodeData = evt.target.data();
            this.debug('Node clicked', nodeData);
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
            const description = link.Description__c;

            // Parent Node
            if (parent && !addedNodeIds.has(parent.Id)) {
                nodes.push({
                    data: {
                        id: parent.Id,
                        label: parent.Name,
                        linkId: link.Id,
                        backgroundColor: 'rgba(189, 230, 92, 1)',
                        type: 'node'
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
                            label: child.Name,
                            linkId: link.Id,
                            backgroundColor: 'rgba(189, 230, 92, 1)',
                            type: 'node'
                        }
                    });
                    addedNodeIds.add(child.Id);
                }

                edges.push({
                    data: {
                        id: link.Id,
                        source: parent.Id,
                        target: child.Id,
                        type: 'edge'
                    }
                });
            } else {
                const pseudoId = this.generateUUID();
                nodes.push({
                    data: {
                        id: pseudoId,
                        label: description,
                        linkId: link.Id,
                        backgroundColor: 'rgba(135, 140, 145, 1)',
                        type: 'node'
                    }
                });

                edges.push({
                    data: {
                        id: link.Id,
                        source: parent.Id,
                        target: pseudoId,
                        type: 'edge'
                    }
                });
            }
        });

        return [...nodes, ...edges];
    }

    /* HANDLER */

    handleDeleteEdge(recordId) {
        this.debug('handleDeleteEdge', 'Deleting record with ID: ' + recordId);
        this.deleteLinker(recordId)
            .then(result => {
                this.debug('deleteLinker result', result);
                this.refreshNodes();
            });
    }

    handleAddNode() {
        this.debug('handleAddNode', 'Adding new node');
        this.openLightningModal(RecordModal, { 'accountId' : this.recordId })
            .then(result => {
                if (result && result !== 'cancel') {
                    this.refreshNodes();
                }
            })
    }

    handleRefresh() {
        this.debug('handleRefresh', 'Refreshing nodes');
        this.refreshNodes();
    }

    /* HELPER */

    refreshNodes() {
        refreshApex(this.wiredLinksResult);
        this.generateNodesFromLinkers(this.wiredLinksResult.data);
        this.refreshGraph(this.contactNodes);
    }

    refreshGraph(newElements) {
        if (!this.cyto) return;

        this.cyto.startBatch();
        this.cyto.elements().remove();
        this.cyto.add(newElements);
        this.cyto.nodes().unlock();       
        this.cyto.endBatch();
        this.cyto.resize();
        this.cyto.style().fromJson(style).update();

        requestAnimationFrame(() => {
            this.cyto.layout(layout).run();
            this.cyto.fit(this.cyto.elements(), 30);  // 30px Padding
        });

    }

    async openLightningModal(modalComponent, payload) {
        const result = await modalComponent.open({
            size: 'small',
            content: payload
        });
        this.debug('openLightningModal', result);

        return result;
    }

    async deleteLinker(recordId) {
        const result = await deleteRecord(recordId);
        return result;
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

    generateUUID() {
        const bytes = crypto.getRandomValues(new Uint8Array(16));

        // Set the version to 4 (UUIDv4)
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        // Set the variant to RFC4122
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

        return [
            hex.substring(0, 8),
            hex.substring(8, 12),
            hex.substring(12, 16),
            hex.substring(16, 20),
            hex.substring(20)
        ].join('-');
    }
}
