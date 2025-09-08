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

    @api recordId;
    @api objectApiName;

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

}