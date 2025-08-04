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
            'font-size': '12px',
            'text-wrap': 'wrap',
            'text-max-width': 120,
            'border-width': 2,
            'border-color': '#005fa3'
        }
    },
    {
        selector: 'edge',
        style: {
            'width': 2,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
        }
    }
];

export const layout = {
    name: 'breadthfirst',
    spacingFactor: 0.3,
    directed: true,
    padding: 10,
    animate: false,
    orientation: 'vertical'
};

