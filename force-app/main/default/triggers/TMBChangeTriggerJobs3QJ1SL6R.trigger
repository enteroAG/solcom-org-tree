trigger TMBChangeTriggerJobs3QJ1SL6R on TR1__Job__c (after insert, after update, after delete, after undelete) {
    TMB.TriggerDispatcher.Run(new TMB.QueueableCallbackHandler('jobs'));
}