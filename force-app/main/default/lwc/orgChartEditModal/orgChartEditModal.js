import { LightningElement, api } from 'lwc';
import LightningModal from 'lightning/modal';

import PRIO from "@salesforce/schema/Contact.SC_APPrio__c";
import DEPARTMENT from "@salesforce/schema/Contact.Department";
import REPORTSTO from "@salesforce/schema/Contact.ReportsToId";
import ACCOUNT from "@salesforce/schema/Contact.AccountId";

export default class OrgChartEditModal extends LightningModal {
    isLoading = false;

    fields = [
        PRIO,
        DEPARTMENT,
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

    handleSuccess() {
        this.isLoading = false;
        this.close('success');
    }

    handleError() {
        this.isLoading = false;
        this.close('error');
    }

    handleSubmit(event) {
        this.isLoading = true;
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