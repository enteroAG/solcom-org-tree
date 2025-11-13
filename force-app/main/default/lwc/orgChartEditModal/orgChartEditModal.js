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
        if (!this.recordId) return undefined;
        return {
            criteria: [
                { fieldPath: 'Id', operator: 'nin', value: [this.recordId] }
            ]
        };
    }

    @api recordId;
    @api objectApiName;
    @api typeOfNode;

    contactView = true;
    isFreeInput;

    freeInputValue = '';

    handleSuccess() {
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

    handleSubsidiarySubmit() {
        this.close({
            'add' : {
                source: this.recordId,
                target: this.freeInputValue || this.selectedContactId
            }
        });
    }

    handleContactPick() {
        this.close({
            'update' : {
                id: this.recordId,
                source: this.selectedContactId,
                target: ''
            }
        });
    }

    handleToggleContactMode() {
        this.contactView = !this.contactView;
        this.freeInputValue = null;
    }

    get editContact() {
        return this.typeOfNode === 'contact';
    }

    get editPlaceholder() {
        return this.typeOfNode === 'placeholder';
    }
}