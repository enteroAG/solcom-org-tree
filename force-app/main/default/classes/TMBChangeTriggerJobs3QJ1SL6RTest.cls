@isTest(SeeAllData=true)
public without sharing class TMBChangeTriggerJobs3QJ1SL6RTest {
    @isTest
    public static void testTrigger() {
        SObject testRecord = TMB.TriggerTestUtils.createTestRecord('TR1__Job__c');
        System.assert(testRecord != null);
    }
}