import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { style, layout, htmlConfig } from './cytoscapeConfig';
import { refreshApex } from '@salesforce/apex';
import { deleteRecord, createRecord, updateRecord } from 'lightning/uiRecordApi';

import getChartData from '@salesforce/apex/OrgChartController.getChartData';
import createMissingNodes from '@salesforce/apex/OrgChartController.createMissingNodes';
import deleteAllNodes from '@salesforce/apex/OrgChartController.deleteAllNodes';


import cytoscapeComplete from '@salesforce/resourceUrl/cytoscapeComplete';

import AddModal from 'c/orgChartAddModal';
import EditModal from 'c/orgChartEditModal';
import ConfirmPrompt from 'c/orgChartConfirmPrompt';

export default class OrgTreeContainer extends LightningElement {
    @api recordId;
    @api cHeight;
    @api fitLevel;

    cyto;
    cyData = [];
    cytoscapeLoaded = false;
    cytoscapeRendered = false;

    debugMode = true;
    isLoading = false;

    wiredResult;

    NEAR_PX = 50;
    NEAR2 = this.NEAR_PX * this.NEAR_PX;

    _htmlRaf = 0;
    _scrollRaf = 0;
    _onScroll = null;
    _updateHtml = null;
    _scrollTarget = null;

    @wire(getChartData, { accountId: '$recordId' })
    wiredResult(result) {
        this.wiredResult = result;

        const { data, error } = result || {};
        if (data) {
            this.cyData = this.generateCyData(data.nodes, data.edges);
            this.debug('[CYTOSCAPE]: Graph data generated', this.cyData);

            this.initializeCytoscape();
        } else if (error) {
            this.debug('[CYTOSCAPE]: Data error', error);
        }
    }

    disconnectedCallback() {
        if (this._scrollTarget && this._onScroll) {
            if (this._scrollTarget === window) {
                window.removeEventListener('scroll', this._onScroll);
            } else {
                this._scrollTarget.removeEventListener('scroll', this._onScroll);
            }
        }
        this._onScroll = null;
        this._scrollTarget = null;

        if (this._htmlRaf) cancelAnimationFrame(this._htmlRaf);
        if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
        this._htmlRaf = 0;
        this._scrollRaf = 0;
    }

    /* Init / Render Cytoscape  */
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
            .catch((error) => {
                this.debug('loadScript', JSON.stringify(error, Object.getOwnPropertyNames(error)));
            });
    }

    renderCytoscape() {
        const api = window.cytoscapeComplete;
        if (!api || typeof api.create !== 'function') {
            this.debug('[CYTOSCAPE]: cytoscapeComplete API missing', api);
            return;
        }

        const container = this.template.querySelector('.cy-container');

        this.cyto = api.create(container, {
            elements: this.cyData,
            style,
            layout: { ...layout, fit: false },
            htmlConfig,
            boxSelectionEnabled: false,
            autounselectify: false,
            autoungrabify: false,
            hideEdgesOnViewport: true,
            textureOnViewport: false,
            motionBlur: false,
            pixelRatio: 1
        });

        this.cyto.fit(this.cyto.elements(), this.fitLevel);

        this._updateHtml = this.updateHtml.bind(this);
        this.cyto.on('render layoutstop zoom pan position viewport', this._updateHtml);

        const scrollTarget = this.getScrollParent(container);
        this._scrollTarget = scrollTarget;
        this._onScroll = this.onScroll.bind(this);

        if (scrollTarget === window) {
            window.addEventListener('scroll', this._onScroll, { passive: true });
        } else {
            scrollTarget.addEventListener('scroll', this._onScroll, { passive: true });
        }

        this.registerCytoListeners();

        this.cytoscapeRendered = true;
        this.debug('[CYTOSCAPE]: Rendered');
    }

    /* Listeners */
    registerCytoListeners() {
        this.cyto.on('click', 'node', (evt) => {
            const node = evt.target;
            this.debug('[CYTOSCAPE]: Node clicked', node.data());
            this.handleNodeClick(node.data());
        });

        this.cyto.on('click', 'edge', (evt) => {
            const edge = evt.target;
            this.debug('[CYTOSCAPE]: Edge clicked', edge);
            this.handleEdgeClick(edge.id());
        });

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
                    const hit = this.dist2(dp, n.position()) < this.NEAR2;
                    if (!!n.data('hl') !== hit) {
                        n.data('hl', hit ? 1 : 0);
                        anyChange = true;
                    }
                });

                if (anyChange) this.updateHtml();
            });
        });

        this.cyto.on('free', 'node', () => {
            if (!draggedNode) return;
            const dp = draggedNode.position();

            this.cyto.nodes(':inside').forEach((n) => {
                if (n === draggedNode) return;
                const close = this.dist2(dp, n.position()) < this.NEAR2;
                if (close) {
                    const newEdge = { source: n.id(), target: draggedNode.id() };

                    const exists = this.cyto.edges().some(e => {
                        const d = e.data();
                        return d.source === newEdge.source && d.target === newEdge.target;
                    });

                    if (!exists) {
                        this.cyto.add({ group: 'edges', data: newEdge });
                        this.handleAddEdge(newEdge);
                    } else {
                        this.debug('[CYTOSCAPE]: Edge already exists', newEdge);
                    }
                }
                if (n.data('hl')) n.data('hl', 0);
            });

            draggedNode = null;
            this.updateHtml();
        });
    }

    /* Data */
    generateCyData(nodeData, edgeData) {
        const nodes = [];
        const edges = [];

        nodeData.forEach((node) => {
            nodes.push({
                data: {
                    id: node.id,
                    label: node.label,
                    backgroundColor: node.backgroundColor,
                    sfdata: node.sfdata,
                    type: 'node',
                    html: true,
                    htmlW: 210,
                    htmlH: 86,
                    edgeId: node.edgeId
                }
            });
        });

        edgeData.forEach((edge) => {
            edges.push({
                data: {
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    type: 'edge',
                    label: edge.label
                }
            });
        });
        return [...nodes, ...edges];
    }

    async refreshCyData() {
        try {
            this.isLoading = true;
            await refreshApex(this.wiredResult);

            const data = this.wiredResult?.data;
            if (!data) return;

            this.cyData = this.generateCyData(data.nodes, data.edges);
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
                lay.once('layoutstop', () => this.cyto.fit(this.cyto.elements(), this.fitLevel));
                this.isLoading = false;
            });

            this.debug('[CYTOSCAPE]: Graph refreshed');
        } catch (e) {
            this.debug('[CYTOSCAPE]: refresh error', e);
        }
    }

    /* CRUD Handlers */
    /* UI Event and Direct Handlers (Level 1) */
    handleAddEdge(edge) {
        const fields = {
            'Source__c': edge.source,
            'Target__c': edge.target
        };
        this.createEdgeRecordAction(fields);
    }

    handleUpdateEdge(edge) {
        const fields = {
            'Id': edge.id,
            'Source__c': edge.source,
            'Target__c': edge.target
        };
        this.updateEdgeRecordAction(fields);
    }

    handleDeleteEdge(edgeId) {
        this.deleteEdgeRecordAction(edgeId);
    }

    handleEdgeClick(edgeId) {
        this.handleOpenConfirmPrompt(edgeId);
    }

    handleNodeClick(node) {
        this.handleOpenEditNodeModal(node);
    }

    handleRefreshCanvas() {
        this.refreshCyData();
    }

    handleCreateNodes() {
        createMissingNodes({ accountId: this.recordId }).then(result => {
            this.debug('[CRUD]: create nodes count', result);
            this.refreshCyData()
        });
    }

    handleDeleteNodes() {
        deleteAllNodes({ accountId: this.recordId }).then(result => {
            this.debug('[CRUD]: delete nodes count', result);
            this.refreshCyData();
        });
    }

    /* UI Flow Handlers (Level 2) */
    async handleOpenAddNodeModal() {
        const result = await AddModal.open({ size: 'small' });

        if (result) {
            const fields = {
                'RelatedToAccount__c': this.recordId,
                'Label__c': result
            };
            this.createNodeRecordAction(fields);
        }
    }

    async handleOpenEditNodeModal(node) {
        const result = await EditModal.open({
            size: 'small',
            objectApiName: 'Contact',
            nodeId: node.id,
            recordId: node.sfdata?.ContactId,
            accountId: this.recordId,
            label: node.label,
        });

        switch (result.method) {
            case 'save':
                if (result.status === 'error') this.debug('[CYTOSCAPE]: error saving node');
                this.refreshCyData();
                break;
            case 'delete':
                this.deleteNodeRecordAction(result.payload);
                break;
            case 'replace':
                this.replaceNodeRecordAction(result.payload);
                break;
            default:
                break;
        }
    }

    async handleOpenConfirmPrompt(edgeId) {
        const result = await ConfirmPrompt.open({
            size: 'small',
            message: 'Are you sure you want to delete this link?'
        });

        if (result === 'confirm') {
            this.deleteEdgeRecordAction(edgeId);
        }
    }

    /* Data Actions (Level 3) */
    createEdgeRecordAction(fields) {
        this.createEdge({ apiName: 'Edge__c', fields })
            .then(() => this.refreshCyData())
            .catch((error) => console.error('[CRUD]: create edge error', error));
    }

    updateEdgeRecordAction(fields) {
        this.updateEdge({ fields })
            .then(() => this.refreshCyData())
            .catch((error) => console.log('[CRUD]: update edge error', error.message));
    }

    deleteEdgeRecordAction(edgeId) {
        this.deleteEdge(edgeId)
            .then(() => this.refreshCyData())
            .catch((error) => console.error('[CRUD]: delete edge error', error));
    }

    createNodeRecordAction(fields) {
        this.createNode({ apiName: 'Node__c', fields })
            .then(() => this.refreshCyData())
            .catch((error) => console.error('[CRUD]: create node error', error));
    }

    deleteNodeRecordAction(nodeId) {
        this.deleteNode(nodeId)
            .then(() => this.refreshCyData())
            .catch((error) => console.error('[CRUD]: delete node error', error));
    }

    replaceNodeRecordAction(fields) {
        this.updateNode({ fields })
            .then(() => this.refreshCyData())
            .catch((error) => console.log('[CRUD]: update node error', error.message));
    }

    /* Helpers */
    async deleteEdge(recordId) { return deleteRecord(recordId); }
    async createEdge(recordInput) { return createRecord(recordInput); }
    async updateEdge(recordInput) { return updateRecord(recordInput); }
    async createNode(recordInput) { return createRecord(recordInput); }
    async deleteNode(recordId) { return deleteRecord(recordId); }
    async updateNode(recordInput) { return updateRecord(recordInput); }


    dist2(a, b) {
        const dx = a.x - b.x, dy = a.y - b.y;
        return dx * dx + dy * dy;
    }

    updateHtml() {
        if (this._htmlRaf) cancelAnimationFrame(this._htmlRaf);
        this._htmlRaf = requestAnimationFrame(() => {
            try {
                const h = this.cyto?.nodeHtmlLabel && this.cyto.nodeHtmlLabel();
                if (h && typeof h.update === 'function') h.update();
            } catch { }
        });
    }

    onScroll() {
        if (this._scrollRaf) return;
        this._scrollRaf = requestAnimationFrame(() => {
            this._scrollRaf = 0;
            try {
                this.cyto?.resize();
                this.updateHtml();
            } catch { }
        });
    }

    getScrollParent(el) {
        let p = el?.parentElement;
        while (p) {
            const s = getComputedStyle(p);
            if (/(auto|scroll)/.test(s.overflowY)) return p;
            p = p.parentElement;
        }
        return window;
    }

    debug(method, obj) {
        if (!this.debugMode) return;
        const cache = new Set();
        const safeStringify = (value) => {
            try {
                return JSON.stringify(value, (key, val) => {
                    if (typeof val === 'object' && val !== null) {
                        if (cache.has(val)) return '[Circular]';
                        cache.add(val);
                    }
                    return val;
                }, 2);
            } catch {
                return String(value);
            }
        };
        if (typeof obj === 'object') {
            // eslint-disable-next-line no-console
            console.log(method, safeStringify(obj));
        } else {
            // eslint-disable-next-line no-console
            console.log(method, obj);
        }
    }

    get containerCSS() {
        return 'height: ' + this.cHeight + 'px; width: 100%;';
    }
}
