import { api } from 'lwc';

import LightningModal from 'lightning/modal';

export default class OrgChartModal extends LightningModal {
    @api content;

    linkData = {};

    get id() {
        return this.content?.id || null;
    }

    handleLookupChange(event) {
        const { id, name } = event.detail ? event.detail : { id: null, name: null };
        const end = event.target?.dataset?.name;

        this.linkData[end] = {
            id: id,
            name: name
        };
    }

    handleDelete() {
        this.closeWithPayload('delete', this.content.id);
    }
    
    handleCancel() {
        this.closeWithPayload('cancel', this.content.id);
    }

    /* HELPER */
    closeWithPayload(operation, payload) {
        this.close({
            operation: operation,
            payload: payload || null
        });
    }
}
