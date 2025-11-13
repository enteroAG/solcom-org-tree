@IsTest
private class OrgChartControllerTest {
    @TestSetup
    static void makeData() {
        Id recTypeId = [SELECT Id FROM RecordType WHERE DeveloperName = 'Customer'].Id;
        Id recTypeIdContact = [SELECT Id FROM RecordType WHERE DeveloperName = 'Customer_Contact'].Id;

        Account testAccount = new Account(
            Name = 'Test Account',
            RecordTypeId = recTypeId,
            SC_ExternalAccountNo__c = '1234567890'
        );
        insert testAccount;

        List<Contact> contacts = new List<Contact>();
        for (Integer i = 0; i < 10; i++) {
            contacts.add(new Contact(
                LastName = 'Test Contact ' + i,
                SC_APPrio__c = String.valueOf(Math.mod(i, 5) + 1),
                Department = 'Department ' + Math.mod(i, 3),
                AccountId = testAccount.Id,
                RecordTypeId = recTypeIdContact,
                Email = 'test@test.dummy',
                ReportsToId = (i > 0) ? contacts[i - 1].Id : null
            ));     
        }
        insert contacts;

        List<OrgChartLinker__c> linkers = new List<OrgChartLinker__c>();
        for (Integer i = 0; i < 5; i++) {
            linkers.add(new OrgChartLinker__c(
                Source__c = contacts[i * 2].Id,
                Source_Text__c = contacts[i * 2].Name,
                Target__c = contacts[i * 2 + 1].Id,
                Target_Text__c = contacts[i * 2 + 1].Name,
                Account__c = testAccount.Id
            )); 
        }
        insert linkers;
    }

    @IsTest
    static void testGetOrgChartData() {
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];

        List<OrgChartController.CytoscapeNode> nodes = OrgChartController.getOrgChartData(testAccount.Id, 'default');

        Assert.areEqual(10, nodes.size(), 'Expected 10 nodes in the org chart data.');
    }
}