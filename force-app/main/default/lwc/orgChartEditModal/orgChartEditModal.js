import { LightningElement, api } from 'lwc';
import LightningModal from 'lightning/modal';

import NAME from "@salesforce/schema/Contact.Name";
import DEPARTMENT from "@salesforce/schema/Contact.Department";
import PRIO from "@salesforce/schema/Contact.SC_APPrio__c";
import REPORTSTO from "@salesforce/schema/Contact.ReportsToId";
import ACCOUNT from "@salesforce/schema/Contact.AccountId";

export default class OrgChartEditModal extends LightningModal {
    isLoading = false;

    fields = [
        NAME,
        DEPARTMENT,
        PRIO,
        REPORTSTO,
        ACCOUNT
    ]

    get contactFilter() {
        if (!this.recordId) return undefined;
        return {
            criteria: [
                { fieldPath: 'Id', operator: 'nin', value: [this.recordId] }
            ]
        };
    }

    @api recordId;
    @api objectApiName;
 
    editContactMode = true;
    isFreeInput;

    freeInputValue = '';

    handleSuccess(event) {
        this.isLoading = false;
        this.close('success');
    }

    handleError(event) {
        this.isLoading = false;
        this.close('error');
    }

    handleSubmit(event) {
        event.preventDefault();
        this.isLoading = true;
        const fields = event.detail.fields;
        this.template.querySelector('lightning-record-edit-form').submit(fields);
    }

    handleToggleMode() {
        this.editContactMode = !this.editContactMode;
        this.freeInputValue = null;
    }

    handleChangeInputType(event) {
        this.isFreeInput = event.target.checked;
        this.selectedContactId = null;
    }

    handleFreeInputChange(event) {
        this.freeInputValue = event.target.value;
    }

    handleContactChange(event) {
        this.selectedContactId = event.detail.recordId;
    }

    handleSubsidiarySubmit(event) {
        this.isLoading = true;

        const newLink = {
            source: this.recordId,
            target: this.freeInputValue || this.selectedContactId,
        }

        this.close(newLink);
    }
}