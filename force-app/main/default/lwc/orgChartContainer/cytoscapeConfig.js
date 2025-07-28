export const style = [
    {
        selector: 'node',
        style: {
            'background-color': '#0074D9',
            'label': 'data(label)',
            'color': '#fff',
            'text-valign': 'center',
            'text-halign': 'center',
            'shape': 'roundrectangle',
            'width': 'label',
            'padding': '10px',
            'font-size': '12px'
        }
    },
    {
        selector: 'edge',
        style: {
            'width': 2,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'curve-style': 'round-taxi',
            'taxi-direction': 'downward',
            'taxi-turn': 20,
            'taxi-turn-min-distance': 10
        }
    }
];

export const layout = {
    name: 'breadthfirst',
    spacingFactor: 0.5,
    directed: true,
    padding: 2
};