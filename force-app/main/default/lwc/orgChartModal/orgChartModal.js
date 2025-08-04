import { api } from 'lwc';
import LightningModal from 'lightning/modal';

export default class OrgChartModal extends LightningModal {
    @api content;

    get parentId() {
        return this.content?.parentId || null;
    }

    get accountId() {
        return this.content?.accountId || null;
    }

    handleSuccess(event) {
        this.close('success');
    }

    handleCancel() {
        this.close('cancel');
    }
}
