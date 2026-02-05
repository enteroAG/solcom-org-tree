import { LightningElement, api } from 'lwc';

import LightningModal from 'lightning/modal';
import NAME from "@salesforce/schema/Contact.Name";
import DEPARTMENT from "@salesforce/schema/Contact.Department";
import PRIO from "@salesforce/schema/Contact.SC_APPrio__c";
import FUNC from "@salesforce/schema/Contact.SC_Function__c";
import REPORTSTO from "@salesforce/schema/Contact.ReportsToId";
import ACCOUNT from "@salesforce/schema/Contact.AccountId";

export default class OrgChartEditModal extends LightningModal {
    isLoading = false;

    fields = [
        NAME,
        DEPARTMENT,
        PRIO,
        FUNC,
        REPORTSTO,
        ACCOUNT
    ]

    get contactFilter() {
        if (!this.accountId) return undefined;
        return {
            criteria: [
                { fieldPath: 'AccountId', operator: 'eq', value: this.accountId }
            ]
        };
    }

    @api nodeId;
    @api recordId;
    @api accountId;
    @api objectApiName;

    contactView = true;
    selectedContactId = {};

    handleSave(event) {
        this.isLoading = true;

        if (this.editContact) {
            event.preventDefault();
            const fields = event.detail.fields;
            this.template.querySelector('lightning-record-edit-form').submit(fields);
        } else {
            this.close({
                'method': 'replace',
                'payload': {
                    'Record__c': this.selectedContactId,
                    'IsSalesforceRecord__c': true,
                    'Id': this.nodeId
                }
            });
        }
    }

    handleDelete() {
        this.close({
            'method': 'delete',
            'payload': this.nodeId
        });
    }

    handleSuccess() {
        this.isLoading = false;
        this.close({
            'method': 'save',
            'status': 'success'
        });
    }

    handleError() {
        this.isLoading = false;
        this.close({
            'method': 'save',
            'status': 'error'
        });
    }

    handleLinkToRecord() {
        this.close({
            'method': 'redirect',
            'payload': this.recordId
        })
    }

    handleContactChange(event) {
        this.selectedContactId = event.detail.recordId;
    }

    get editContact() {
        return this.recordId;
    }
}