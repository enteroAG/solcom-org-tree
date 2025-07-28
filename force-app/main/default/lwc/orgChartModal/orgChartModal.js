import { api } from 'lwc'
import LightningModal from 'lightning/modal';

export default class OrgChartModal extends LightningModal {
    @api content;

    handleSave() {
        this.close('save');
    }

    handleCancel() {
        this.close('cancel');
    }
}