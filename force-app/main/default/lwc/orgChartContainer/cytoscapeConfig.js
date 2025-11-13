// config.js
export const style = [
    {
        selector: 'core',
        style: {
            'background-color': '#ffffff',
            'outside-texture-bg-color': '#ffffff',
            'active-bg-color': '#ffffff',
            'active-bg-opacity': 0,
            'active-bg-size': 0, 
            'selection-box-opacity': 0,
        }
    },
    {
        selector: 'node',
        style: {
            'shape': 'round-rectangle',
            'background-color': 'data(backgroundColor)',
            'border-color': 'data(backgroundColor)',
            'border-width': 2,
            'label': 'data(label)',
            'color': '#222',
            'font-size': 12,
            'text-wrap': 'wrap',
            'text-max-width': 160,
            'text-valign': 'center',
            'text-halign': 'center',
            'padding': '12px',
            'width': function (node) {
                const label = node?.data?.('label') ?? '';
                const base = label.length * 7 + 24;
                return Math.max(80, Math.min(220, base));
            },
            'height': function (node) {
                const label = node.data('label') || '';
                const charsPerLine = 25;
                const lineCount = Math.ceil(label.length / charsPerLine) || 1;
                return lineCount * 18 + 16;
            }
        }
    },
    {
        selector: 'node[html]',
        style: {
            'label': '',
            'opacity': 0,
            'text-opacity': 0,
            'background-opacity': 0,
            'border-width': 0,
            'border-opacity': 0,
            'overlay-opacity': 0,
            'underlay-opacity': 0,
            'width': 'data(htmlW)',
            'height': 'data(htmlH)'
        }
    },
    {
        selector: 'node.highlight',
        style: {
            'border-width': 2,
            'border-color': '#ff6b6b',
            'background-color': 'transparent'
        }
    },
    {
        selector: 'edge',
        style: {
            'width': 2,
            'line-color': '#2c2c2c',
            'curve-style': 'round-taxi',
            'taxi-direction': 'downward',
            'taxi-turn': '50%',
            'taxi-turn-min-distance': 14,
            'target-arrow-shape': 'none',
            'source-arrow-shape': 'none'
        }
    }
];

export const layout = {
    name: 'dagre',
    rankDir: 'TB',
    nodeSep: 20,
    rankSep: 40,
    edgeSep: 12,
    padding: 30
};

export const htmlConfig = [
    {
        query: 'node[html]',
        enablePointerEvents: false,
        cssClass: 'cy-html-label',
        halign: 'center',
        valign: 'center',
        halignBox: 'center',
        valignBox: 'center',
        tpl: (d) => {
            const W = d.htmlW || 210;
            const H = d.htmlH || 86;
            const isHL = !!d.hl;
            const base = d.borderColor || d.backgroundColor || '#2BA1B7';
            const bd = isHL ? '#ff6b6b' : base;
            const fill = d.fillColor || '#fff';
            const prio = d.prio ?? d.sfdata?.SC_APPrio__c ?? '';
            const func = d.sfdata?.SC_Function__c || '';
            const dept = d.department ?? d.sfdata?.Department ?? '';
            const name = (d.name || d.label || '').toUpperCase();

            const prioBadge = prio ?
                `<span style="font-size:11px;padding:2px 8px;border:1px solid ${bd};
                    border-radius:999px;white-space:nowrap;">
                    ${prio}
                </span>` : '';

            return `
                <div style="width:${W}px;height:${H}px;box-sizing:border-box;">
                <div style="
                    height:100%;width:100%;
                    background:${fill};
                    border:3px solid ${bd};
                    border-radius:12px;
                    padding:10px 12px;box-sizing:border-box;
                    display:flex;flex-direction:column;justify-content:center;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                    ${prioBadge}
                    <span style="font-size:11px;max-width:${W - 100}px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                        ${func}</br>
                        ${dept}
                    </span>
                    </div>
                    <div style="text-align:center;font-weight:700;letter-spacing:.2px;">
                    ${name}
                    </div>
                </div>
                </div>`;
        }
    }
];
