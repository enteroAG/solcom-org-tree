import { api } from 'lwc';

import LightningModal from 'lightning/modal';

import PARENT from '@salesforce/schema/OrgChartLinker__c.Parent__c';
import CHILD from '@salesforce/schema/OrgChartLinker__c.Child__c';
import DESCRIPTION from '@salesforce/schema/OrgChartLinker__c.Description__c';

export default class OrgChartModal extends LightningModal {
    @api content;

    fields = [PARENT, CHILD, DESCRIPTION];

    get recordId() {
        return this.content?.linkId || null;
    }
        
    handleSubmit(event) {
        event.preventDefault();
        const fields = event.detail.fields;
        fields.Account__c = this.content.accountId;
        this.template.querySelector('lightning-record-form').submit(fields);   
    }

    handleSuccess(event) {
        this.closeWithPayload('upsert', event.detail.id);
    }

    handleDelete() {
        this.closeWithPayload('delete', this.content.linkId);
    }
    
    handleCancel() {
        this.closeWithPayload('cancel', this.content.linkId);
    }

    /* HELPER */
    closeWithPayload(operation, payload) {
        this.close({
            operation: operation,
            payload: payload || null
        });
    }
}
