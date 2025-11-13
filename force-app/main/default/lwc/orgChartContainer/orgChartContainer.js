import { LightningElement, api, wire } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import { style, layout, htmlConfig } from './cytoscapeConfig';
import { refreshApex } from '@salesforce/apex';
import { deleteRecord, createRecord } from 'lightning/uiRecordApi';
import getOrgChartData from '@salesforce/apex/OrgChartController.getOrgChartData';

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

    @wire(getOrgChartData, { recordId: '$recordId', orgChartId: 'default' })
    wiredResult(result) {
        this.wiredResult = result;

        const { data, error } = result || {};
        if (data) {
            this.debug('[CYTOSCAPE]: Data retrieved', data);
            this.cyData = this.generateCyData(data);
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

        this.cyto.on('click', 'node', (evt) => {
            const node = evt.target;
            this.debug('[CYTOSCAPE]: Node clicked', node.data());
            if (this.isSalesforceId(node.id())) this.handleEditNode(node.data());
        });

        this.cyto.on('click', 'edge', (evt) => {
            const edge = evt.target;
            this.debug('[CYTOSCAPE]: Edge clicked', edge);
            this.handleDeleteEdge(edge.id());
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

        this.cytoscapeRendered = true;
        this.debug('[CYTOSCAPE]: Rendered');
    }

    /* Data */
    generateCyData(data) {
        const nodes = [];
        const edges = [];
        const links = {};
        const added = new Set();

        data.forEach((row) => {
            const node = row;
            if (!added.has(node.id)) {
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
                added.add(node.id);
            }
            if (node.linkId) {
                if (!links[node.linkId]) links[node.linkId] = [];
                links[node.linkId].push(node.id);
            }
        });

        Object.entries(links).forEach(([linkId, nodeIds]) => {
            const ids = [...nodeIds];
            if (ids.length < 2) return;
            for (let i = 0; i < ids.length - 1; i++) {
                edges.push({
                    data: {
                        id: linkId,
                        source: ids[i],
                        target: ids[i + 1],
                        type: 'edge'
                    }
                });
            }
        });

        this.debug('[CYTOSCAPE]: Graph data generated');
        return [...nodes, ...edges];
    }

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
                lay.once('layoutstop', () => this.cyto.fit(this.cyto.elements(), this.fitLevel));
                this.isLoading = false;
            });

            this.debug('[CYTOSCAPE]: Graph refreshed');
        } catch (e) {
            this.debug('[CYTOSCAPE]: refresh error', e);
        }
    }

    /* CRUD Handlers */
    handleAddEdge(edge) {
        const fields = {};
        fields['Source_Text__c'] = !this.isSalesforceId(edge.source) ? edge.source : null;
        fields['Source__c'] = !this.isSalesforceId(edge.source) ? null : edge.source;
        fields['Target_Text__c'] = !this.isSalesforceId(edge.target) ? edge.target : null;
        fields['Target__c'] = !this.isSalesforceId(edge.target) ? null : edge.target;
        fields['Account__c'] = this.recordId;

        this.createLinker({ apiName: 'OrgChartLinker__c', fields })
            .then(() => this.refreshCyData())
            .catch((error) => this.debug('[CYTOSCAPE]: add edge error', error));
    }

    async handleDeleteEdge(edgeId) {
        const result = await ConfirmPrompt.open({
            size: 'small',
            message: 'Are you sure you want to delete this link?'
        });
        if (result === 'confirm') {
            this.deleteLinker(edgeId).then(() => this.refreshCyData());
        }
    }

    async handleEditNode(node) {
        const result = await EditModal.open({
            size: 'small',
            recordId: node.id,
            label: node.label,
            objectApiName: 'Contact'
        });

        if (result === 'success') {
            this.refreshCyData();
        } else if (result && typeof result === 'object') {
            this.handleAddEdge(result);
        }
    }

    async handleAddNode() {
        const result = await AddModal.open({
            size: 'small'
        });
       
        if (result && typeof result === 'object') {
            this.handleAddEdge(result);
        }
    } 

    /* Helpers */
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

    async deleteLinker(recordId) { return deleteRecord(recordId); }
    async createLinker(recordInput) { return createRecord(recordInput); }

    isSalesforceId(id) {
        const sfIdRegex = /^[a-zA-Z0-9]{15,18}$/;
        return sfIdRegex.test(id);
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

    generateUUID() {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
        return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
    }

    get containerCSS() {
        return 'height: ' + this.cHeight + 'px; width: 100%;';
    }
}
