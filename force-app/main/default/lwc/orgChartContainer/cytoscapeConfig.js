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
            const prevBought = d.prevBought ?? d.sfdata?.prevBought ?? '';
            const prevMet = d.prevMet ?? d.sfdata?.prevMet ?? '';
            const func = d.sfdata?.SC_Function__c || '';
            const dept = d.department ?? d.sfdata?.Department ?? '';
            const name = (d.name || d.label || '').toUpperCase();

            const moneyIcon = `<svg viewBox="0 0 52 52" width="14" height="14" style="fill:${bd}"><path d="M26 2C12.7 2 2 12.7 2 26s10.7 24 24 24 24-10.7 24-24S39.3 2 26 2zm4.1 32.1c0 .8-.7 1.4-1.5 1.4h-5.2c-.8 0-1.5-.7-1.5-1.4v-1.2c-2.6-.6-4.5-2.7-4.5-5.3 0-.6.4-1 1-1h2.5c.5 0 .9.4 1 1 .3 1.2 1.4 2.2 2.8 2.2h1.4c1.1 0 1.9-.7 1.9-1.6 0-.8-.5-1.4-1.9-2l-3.3-1.4c-2.9-1.2-4.1-3.1-4.1-5.4 0-2.8 2.2-5.1 5.2-5.6v-1.2c0-.8.7-1.4 1.5-1.4h5.2c.8 0 1.5.7 1.5 1.4v1.2c2.2.5 3.9 2.1 4.3 4.3.1.5-.3 1-1 1h-2.5c-.5 0-.9-.3-1-.8-.4-1-1.3-1.6-2.4-1.6h-1.2c-1.1 0-1.7.6-1.7 1.4 0 .8.6 1.3 2 1.9l3.3 1.4c3.1 1.3 4.4 3.1 4.4 5.6 0 3.2-2.3 5.4-5.3 5.9v1.2z"/></svg>`;

            const eventIcon = `
            <svg viewBox="0 0 52 52" width="14" height="14" style="fill:${bd}">
                <path d="M43 10h-3V7c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H18V7c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H7c-2.8 0-5 2.2-5 5v30c0 2.8 2.2 5 5 5h38c2.8 0 5-2.2 5-5V15c0-2.8-2.2-5-5-5zM8 45V19h36v26H8zM39 23H13c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1h26c.6 0 1-.4 1-1v-4c0-.6-.4-1-1-1z"/>
            </svg>`;

            const badgeStyle = `display:flex; align-items:center; justify-content:center; width:22px; height:22px; border:1px solid ${bd}; border-radius:4px; background:white; flex-shrink:0;`;

            return `
            <div style="width:${W}px; height:${H}px; font-family: sans-serif; box-sizing: border-box; overflow: hidden;">
                <div style="
                    height:100%; width:100%;
                    background:${fill};
                    border:3px solid ${bd};
                    border-radius:12px;
                    padding:6px 10px 4px 10px; /* Padding unten reduziert */
                    box-sizing:border-box;
                    display:flex; flex-direction:column;">
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-grow: 1;">
                        
                        <div style="display: flex; flex-direction: column; gap: 3px; width: 48px; flex-shrink: 0; padding-top: 2px;">
                            <div style="display: flex; gap: 4px;">
                                ${prio ? `<div style="${badgeStyle} font-size:10px; font-weight:700; color:${bd};">${prio}</div>` : ''}
                                ${prevMet ? `<div style="${badgeStyle}">${eventIcon}</div>` : ''}
                            </div>
                            ${prevBought ? `<div style="${badgeStyle}">${moneyIcon}</div>` : ''}
                        </div>

                        <div style="text-align: right; flex-grow: 1; padding-left: 6px; overflow: hidden;">
                            <div style="font-size: 11px; font-weight: 700; color: #333; line-height: 1.1; margin-bottom: 2px; white-space: normal;">
                                ${func}
                            </div>
                            <div style="font-size: 10px; color: #666; line-height: 1.1; white-space: normal;">
                                ${dept}
                            </div>
                        </div>
                    </div>

                    <div style="border-top: 1px solid #eee; padding-top: 4px; margin-top: 2px; text-align: center; flex-shrink: 0;">
                        <div style="font-size: 12px; font-weight: 700; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${name}
                        </div>
                    </div>
                </div>
            </div>`;
        }
    }
];
