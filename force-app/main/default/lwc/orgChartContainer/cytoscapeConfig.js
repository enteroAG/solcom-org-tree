export const style = [
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
                const minW = 80;
                const maxW = 220;
                return Math.max(minW, Math.min(maxW, base));
            },
            'height': function (node) {
                const label = node.data('label') || '';
                const charsPerLine = 25;
                const lineCount = Math.ceil(label.length / charsPerLine) || 1;
                const lineHeight = 18;
                const padding = 16;
                return lineCount * lineHeight + padding;
            }
        }
    },
    {
        selector: '.highlight',
        style: {
            'border-color': 'red',
            'border-width': 4,
            'border-opacity': 1
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


