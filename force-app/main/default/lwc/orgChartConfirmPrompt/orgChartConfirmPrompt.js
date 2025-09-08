import {  api } from 'lwc';
import LightningModal from 'lightning/modal';


export default class OrgChartConfirmPrompt extends LightningModal {
    @api message;

    handleConfirm() {
        this.close('confirm');
    }
    
    handleCancel() {
       this.close('cancel');
    }
}