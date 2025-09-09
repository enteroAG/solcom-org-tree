import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { style, layout, htmlConfig } from './cytoscapeConfig';
import { refreshApex } from "@salesforce/apex";
import { deleteRecord, createRecord } from 'lightning/uiRecordApi';
import getOrgChartData from '@salesforce/apex/OrgChartController.getOrgChartData';

import cytoscapeComplete from '@salesforce/resourceUrl/cytoscapeComplete';
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

    isLoading = false;

    throttleId = null;
    draggedNode = null;

    NEAR_PX = 50;
    NEAR2 = this.NEAR_PX * this.NEAR_PX;

    FIT_LEVEL = 80;

    @wire(getOrgChartData, { recordId: '$recordId', orgChartId: 'default' })
    wiredResult(result) {
        this.wiredResult = result;

        const { data, error } = result;

        if (data) {
            console.log('[CYTOSCAPE]: Data retrieved', data);

            this.cyData = this.generateCyData(data);
            this.initializeCytoscape();
        } else if (error) {

        }
    }

    initializeCytoscape() {
        if (this.cytoscapeLoaded) {
            this.renderCytoscape();
            return;
        }

        loadScript(this, cytoscapeComplete)
            .then(() => {
                this.cytoscapeLoaded = true;
                this.debug('[CYTOSCAPE]: Scripts loaded');
                this.renderCytoscape();
            })
            .catch(error => {
                this.debug('loadScript', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            });
    }

    renderCytoscape() {
        const api = window.cytoscapeComplete;
        if (!api || typeof api.create !== 'function') {
            this.debug('[CYTOSCAPE]: cytoscapeComplete API missing', api);
            return;
        }

        // --- lokale Helpers/Konstanten ---
        const NEAR_PX = this.NEAR_PX || 50;
        const NEAR2 = NEAR_PX * NEAR_PX;
        const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };

        const container = this.template.querySelector('.cy-container');

        // --- Create ---
        this.cyto = api.create(container, {
            elements: this.cyData,
            style,
            layout: { ...layout, fit: false },
            htmlConfig,
            textureOnViewport: false,
            motionBlur: false,
            pixelRatio: 1
        });

        // --- Canvas-Fade gegen Ghosting ---
        const containerEl = container;
        let canvasHideTimer = 0;
        const hideCanvasNow = () => containerEl.classList.add('canvas-hidden');
        const showCanvasSoon = () => {
            if (canvasHideTimer) clearTimeout(canvasHideTimer);
            canvasHideTimer = setTimeout(() => {
                containerEl.classList.remove('canvas-hidden');
                try {
                    const h = this.cyto.nodeHtmlLabel && this.cyto.nodeHtmlLabel();
                    if (h && typeof h.update === 'function') h.update();
                    const r = this.cyto.renderer && this.cyto.renderer();
                    if (r && typeof r.redraw === 'function') r.redraw();
                } catch { }
            }, 80);
        };

        // --- Fit/Zoom-Nähe ---
        this.cyto.fit(this.cyto.elements(), this.FIT_LEVEL);

        // --- HTML-Overlay Update (rAF-gedrosselt) ---
        let htmlRaf = 0;
        const updateHtml = () => {
            if (htmlRaf) cancelAnimationFrame(htmlRaf);
            htmlRaf = requestAnimationFrame(() => {
                try {
                    const h = this.cyto.nodeHtmlLabel && this.cyto.nodeHtmlLabel();
                    if (h && typeof h.update === 'function') h.update();
                } catch { }
            });
        };

        this.cyto.on('render layoutstop zoom pan position viewport', updateHtml);
        this.cyto.on('zoom pan', hideCanvasNow);
        this.cyto.on('zoom', showCanvasSoon);
        this.cyto.on('pan', showCanvasSoon);

        // --- Clicks ---
        this.cyto.on('click', 'node', (evt) => {
            const node = evt.target;
            if (this.isSalesforceId(node.id())) this.handleEditNote(node.id());
            this.debug('[CYTOSCAPE]: Node clicked', node.id());
        });

        this.cyto.on('click', 'edge', (evt) => {
            const edge = evt.target;
            this.handleDeleteEdge(edge.id());
            this.debug('[CYTOSCAPE]: Edge clicked', edge.id());
        });

        // --- Drag + Highlight über d.hl ---
        let draggedNode = null;

        this.cyto.on('grab', 'node', (evt) => {
            draggedNode = evt.target;
        });

        let posRaf = 0;
        this.cyto.on('position', 'node', () => {
            if (!draggedNode) return;
            if (posRaf) return;
            posRaf = requestAnimationFrame(() => {
                posRaf = 0;
                const dp = draggedNode.position();
                let anyChange = false;

                this.cyto.nodes(':inside').forEach((n) => {
                    if (n === draggedNode) return;
                    const hit = dist2(dp, n.position()) < NEAR2;
                    if (!!n.data('hl') !== hit) {
                        n.data('hl', hit ? 1 : 0); // HTML-Template färbt Border rot bei hl
                        anyChange = true;
                    }
                });

                if (anyChange) updateHtml();
            });
        });

        this.cyto.on('free', 'node', () => {
            if (!draggedNode) return;
            const dp = draggedNode.position();

            this.cyto.nodes(':inside').forEach((n) => {
                if (n === draggedNode) return;
                const close = dist2(dp, n.position()) < NEAR2;
                if (close) {
                    const newEdge = { source: n.id(), target: draggedNode.id() };
                    this.cyto.add({ group: 'edges', data: newEdge });
                    this.handleAddEdge(newEdge);
                }
                if (n.data('hl')) n.data('hl', 0);
            });

            draggedNode = null;
            updateHtml();
        });

        this.cytoscapeRendered = true;
        this.debug('[CYTOSCAPE]: Rendered');
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
                        type: 'node',
                        html: true,
                        htmlW: 210,
                        htmlH: 86
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

        this.debug('[CYTOSCAPE]: Graph data generated');
        return [...nodes, ...edges];
    }


    /* HANDLER */

    handleAddEdge(edge) {
        const fields = {};

        fields['Source_Text__c'] = !this.isSalesforceId(edge.source) ? edge.source : null;
        fields['Source__c'] = !this.isSalesforceId(edge.source) ? null : edge.source;
        fields['Target_Text__c'] = !this.isSalesforceId(edge.target) ? edge.target : null;
        fields['Target__c'] = !this.isSalesforceId(edge.target) ? null : edge.target;
        fields['Account__c'] = this.recordId;

        this.createLinker({ apiName: 'OrgChartLinker__c', fields })
            .then(result => {
                this.refreshCyData();
            })
            .catch(error => {

            });
    }

    async handleDeleteEdge(edgeId) {
        const result = await ConfirmPrompt.open({
            size: 'small',
            message: 'Are you sure you want to delete this link?'
        });

        if (result === 'confirm') {
            this.deleteLinker(edgeId)
                .then(result => {
                    this.refreshCyData();
                });
        }

    }

    async handleEditNote(nodeId) {
        const result = await EditModal.open({
            size: 'small',
            recordId: nodeId,
            objectApiName: 'Contact',
        });

        if (result === 'success') {
            this.refreshCyData();
        } else if (result === 'error') {

        } else {
            if (result && typeof result === 'object') {
                this.handleAddEdge(result);
            }
        }
    }

    /* HELPER */

    async refreshCyData() {
        try {
            this.isLoading = true;
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
                const lay = this.cyto.layout({ ...layout, fit: false });
                lay.run();
                lay.once('layoutstop', () => {
                    this.cyto.fit(this.cyto.elements(), this.FIT_LEVEL);
                });
                this.isLoading = false;

            });

            this.debug('[CYTOSCAPE]: Graph refreshed');
        } catch (e) {

        }

    }

    async openLightningModal(modalComponent, payload) {
        const result = await modalComponent.open({
            size: 'small',
            content: payload
        });

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
                    2
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

    dist2(a, b) {
        const dx = a.x - b.x, dy = a.y - b.y;
        return dx * dx + dy * dy;
    }

    getVisibleNodes() {
        return this.cyto ? this.cyto.nodes(':inside') : [];
    }

    updateHighlightsThrottled() {
        if (this.throttleId) return;
        this.throttleId = requestAnimationFrame(() => {
            this.throttleId = null;
            if (!this.draggedNode || !this.cyto) return;

            const draggedPos = this.draggedNode.position();
            this.cyto.nodes(':inside').forEach((n) => {
                if (n === this.draggedNode) return;
                const hit = dist2(draggedPos, n.position()) < this.NEAR2;
                if (!!n.data('hl') !== hit) n.data('hl', hit ? 1 : 0);
            });
        });
    }
}
