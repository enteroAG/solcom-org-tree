import { LightningElement } from 'lwc';
import LightningModal from 'lightning/modal';

export default class OrgChartAddModal extends LightningModal {
    freeInputValue = '';

    handleFreeInputChange(event) {
        this.freeInputValue = event.target.value;
    }

    handleSubmit() {
        this.close(this.freeInputValue);
    }
}