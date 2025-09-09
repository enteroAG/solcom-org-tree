import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { style, layout } from './cytoscapeConfig';
import { refreshApex } from "@salesforce/apex";
import { deleteRecord, createRecord } from 'lightning/uiRecordApi';
import getOrgChartData from '@salesforce/apex/OrgChartController.getOrgChartData';

import cyDagreBundle from '@salesforce/resourceUrl/cyDagreBundle';
import EditModal from 'c/orgChartEditModal';
import ConfirmPrompt from 'c/orgChartConfirmPrompt';

export default class OrgTreeContainer extends LightningElement {
    @api recordId;

    cyto;
    cytoscapeLoaded = false;
    cytoscapeRendered = false;
    cyData = [];

    debugMode = true;

    wiredResult;

    @wire(getOrgChartData, { recordId: '$recordId', orgChartId: 'default' })
    wiredResult(result) {
        this.wiredResult = result;

        const { data, error } = result;

        if (data) {
            this.cyData = this.generateCyData(data);
            this.initializeCytoscape();

            this.debug('contactNodes', this.cyData);
        } else if (error) {
            this.debug('wiredResult error', error);
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
            elements: this.cyData,
            style: style,
            layout: layout,
            zoom: 0.5,
        });

        this.cyto.on('click', 'node', (evt) => {
            const node = evt.target;

            if (this.isSalesforceId(node.id())) {
                this.handleEditNote(node.id());
            }
        });

        this.cyto.on('click', 'edge', (evt) => {
            const edge = evt.target;
            this.handleDeleteEdge(edge.id());
        });

        let draggedNode = null;

        this.cyto.on('grab', 'node', (evt) => {
            draggedNode = evt.target;
        });

        this.cyto.on('position', 'node', (evt) => {
            if (!draggedNode) return;

            const draggedPos = draggedNode.position();

            this.cyto.nodes().forEach((targetNode) => {
                if (targetNode.id() === draggedNode.id()) return;

                const targetPos = targetNode.position();
                const dx = draggedPos.x - targetPos.x;
                const dy = draggedPos.y - targetPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 50) {
                    targetNode.addClass('highlight');
                } else {
                    targetNode.removeClass('highlight');
                }
            });
        });

        this.cyto.on('free', 'node', (evt) => {
            if (!draggedNode) return;

            const draggedPos = draggedNode.position();

            this.cyto.nodes().forEach((targetNode) => {
                if (targetNode.id() === draggedNode.id()) return;

                const targetPos = targetNode.position();
                const dx = draggedPos.x - targetPos.x;
                const dy = draggedPos.y - targetPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 50) {
                    const newEdge = {
                        source: targetNode.id(),
                        target: draggedNode.id()
                    }

                    this.cyto.add({
                        group: 'edges',
                        data: newEdge
                    });

                    this.handleAddEdge(newEdge)
                }

                targetNode.removeClass('highlight');
            });

            draggedNode = null;
        });

        this.cytoscapeRendered = true;
    }

    generateCyData(data) {
        const nodes = [];
        const edges = [];
        const links = {};
        const addedNodeIds = new Set();

        data.forEach(row => {
            const node = row;

            if (!addedNodeIds.has(node.id)) {
                nodes.push({
                    data: {
                        id: node.id,
                        label: node.label,
                        backgroundColor: node.backgroundColor,
                        sfdata: node.sfdata,
                        type: 'node'
                    }
                });
                addedNodeIds.add(node.id);

            }

            if (node.linkId) {
                if (!links[node.linkId]) {
                    links[node.linkId] = [];
                }
                links[node.linkId].push(node.id);
            }
        });

        for (const [linkId, nodeIds] of Object.entries(links)) {
            const ids = [...nodeIds];
            if (ids.length < 2) {
                continue;
            }
            for (let i = 0; i < ids.length - 1; i++) {
                edges.push({
                    data: {
                        id: linkId,
                        source: ids[i],
                        target: ids[i + 1],
                        type: 'edge',
                    }
                });
            }
        }

        return [...nodes, ...edges];
    }


    /* HANDLER */

    handleAddEdge(edge) {
        const fields = {};
        this.debug('handleAddEdge', edge);

        fields['Source_Text__c'] = !this.isSalesforceId(edge.source) ? edge.source : null;
        fields['Source__c'] = !this.isSalesforceId(edge.source) ? null : edge.source;
        fields['Target_Text__c'] = !this.isSalesforceId(edge.target) ? edge.target : null;
        fields['Target__c'] = !this.isSalesforceId(edge.target) ? null : edge.target;
        fields['Account__c'] = this.recordId;

        this.createLinker({ apiName: 'OrgChartLinker__c', fields })
            .then(result => {
                this.debug('createLinker result', result);
                this.refreshCyData();
            })
            .catch(error => {
                this.debug('createLinker error', error);
            });
    }

    async handleDeleteEdge(edgeId) {
        this.debug('handleDeleteEdge', edgeId);
        const result = await ConfirmPrompt.open({
            size: 'small',
            message: 'Are you sure you want to delete this link?'
        });

        if (result === 'confirm') {
            this.deleteLinker(edgeId)
                .then(result => {
                    this.debug('deleteLinker result', result);
                    this.refreshCyData();
                });
        }

    }

    async handleEditNote(nodeId) {
        this.debug('handleEditNote', nodeId);

        const result = await EditModal.open({
            size: 'small',
            recordId: nodeId,
            objectApiName: 'Contact'
        });

        if (result === 'success') {
            this.debug('EditModal result', result);
            this.refreshCyData();
        } else {
            this.debug('EditModal closed without success');
        }
    }

    /* HELPER */

    async refreshCyData() {
        try {
            await refreshApex(this.wiredResult);

            const data = this.wiredResult?.data;
            if (!data) return;

            this.cyData = this.generateCyData(data);
            if (!Array.isArray(this.cyData)) {
                const { nodes = [], edges = [] } = this.cyData || {};
                this.cyData = [...nodes, ...edges];
            }

            this.cyto.batch(() => {
                this.cyto.elements().remove();
                this.cyto.add(this.cyData);
                this.cyto.elements().unlock();           
                this.cyto.style().fromJson(style).update();
            });

            this.cyto.resize();

            requestAnimationFrame(() => {
                const lay = this.cyto.layout(layout);
                lay.run();
                lay.once('layoutstop', () => {
                    this.cyto.fit(this.cyto.elements(), 30);
                });
            });
        } catch (e) {
            console.error('refreshCyData failed', e);
        }

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

    async createLinker(recordInput) {
        const result = await createRecord(recordInput);
        return result;
    }

    debug(method, obj) {
        if (!this.debugMode) {
            return;
        }

        const cache = new Set();

        const safeStringify = (value) => {
            try {
                return JSON.stringify(
                    value,
                    (key, val) => {
                        if (typeof val === 'object' && val !== null) {
                            if (cache.has(val)) {
                                return '[Circular]';
                            }
                            cache.add(val);
                        }
                        return val;
                    },
                    2 // pretty-print
                );
            } catch (e) {
                return String(value);
            }
        };

        if (typeof obj === 'object') {
            console.log(method, safeStringify(obj));
        } else {
            console.log(method, obj);
        }
    }

    generateUUID() {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
    }

    isSalesforceId(id) {
        const sfIdRegex = /^[a-zA-Z0-9]{15,18}$/;
        return sfIdRegex.test(id);
    }

}
