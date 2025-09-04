import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { style, layout } from './cytoscapeConfig';
import { refreshApex } from "@salesforce/apex";
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
            const edge = evt.target;
            this.debug('Edge clicked', edge.id());
        });

        let draggedNode = null;

        this.cyto.on('grab', 'node', (evt) => {
            draggedNode = evt.target;
            this.debug('Node grabbed', draggedNode.id());
        });

        this.cyto.on('tapdrag', 'node', (evt) => {
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
            const draggedNode = evt.target;
            this.debug('Node released', draggedNode.id());

            if (!draggedNode) return;

            const draggedPos = draggedNode.position();

            this.cyto.nodes().forEach((targetNode) => {
                if (targetNode.id() === draggedNode.id()) return;

                const targetPos = targetNode.position();
                const dx = draggedPos.x - targetPos.x;
                const dy = draggedPos.y - targetPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 50) {
                    this.cyto.add({
                        group: 'edges',
                        data: {
                            source: draggedNode.id(),
                            target: targetNode.id()
                        }
                    });
                }

                targetNode.removeClass('highlight');
            });

            draggedNode = null;
        });


        this.cytoscapeRendered = true;
    }

    generateNodesFromLinkers(linkers) {
        const nodes = [];
        const edges = [];
        const addedNodeIds = new Set();

        linkers.forEach(link => {
            const parent = link.Parent__r || {
                Id: link.Parent_Text__c,
                Name: link.Parent_Text__c,
                SC_APPrio__c: 4,
                SC_Function__c: null,
                ReportsToId: null
            };

            const child = link.Child__r || {
                Id: link.Child_Text__c,
                Name: link.Child_Text__c,
                SC_APPrio__c: 4,
                SC_Function__c: null,
                ReportsToId: null
            };

            if (!addedNodeIds.has(parent.Id)) {
                nodes.push({
                    data: {
                        id: parent.Id,
                        label: parent.Name,
                        priority: parent.SC_APPrio__c,
                        linkId: link.Id,
                        backgroundColor: this.getNodeColor(parent.SC_APPrio__c),
                        type: 'node'
                    }
                });
                addedNodeIds.add(parent.Id);
            }

            if (!addedNodeIds.has(child.Id)) {
                nodes.push({
                    data: {
                        id: child.Id,
                        label: child.Name,
                        priority: child.SC_APPrio__c,
                        linkId: link.Id,
                        backgroundColor: this.getNodeColor(child.SC_APPrio__c),
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
            })
        });

        return [...nodes, ...edges];
    }

    /* HANDLER */

    handleAddEdge() {
    }

    handleDeleteEdge(edgeId) {
        this.debug('handleDeleteEdge', 'deleting edge with ID: ' + edgeId);
        this.deleteLinker(edgeId)
            .then(result => {
                this.debug('deleteLinker result', result);
                this.refreshNodes();
            });
    }

    handleRefresh() {
        this.debug('handleRefresh', 'Refreshing nodes');
        this.refreshNodes();
    }

    /* HELPER */

    refreshNodes() {
        refreshApex(this.wiredLinksResult);

        this.generateNodesFromLinkers(this.wiredLinksResult.data);

        this.cyto.startBatch();
        this.cyto.elements().remove();
        this.cyto.add(this.contactNodes);
        this.cyto.nodes().unlock();
        this.cyto.endBatch();
        this.cyto.resize();
        this.cyto.style().fromJson(style).update();

        requestAnimationFrame(() => {
            this.cyto.layout(layout).run();
            this.cyto.fit(this.cyto.elements(), 30);  // 30px Padding
        });
        this.refreshGraph();
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
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
    }

    getNodeColor(priority) {
        const PRIORITY_COLORS = {
            0: '#2BA1B7',
            1: '#87B433',
            2: '#42A12E',
            3: '#B2BE36',
            4: 'rgba(135, 140, 145, 1)'
        };

        return PRIORITY_COLORS[priority] || 'rgba(135, 140, 145, 1)'; // Default color if priority not found
    };
}
