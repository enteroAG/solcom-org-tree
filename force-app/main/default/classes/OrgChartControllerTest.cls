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
                SC_APPrio__c = '1',
                Department = 'Department ' + Math.mod(i, 3),
                AccountId = testAccount.Id,
                RecordTypeId = recTypeIdContact,
                Email = 'test@test.dummy',
                ReportsToId = (i > 0) ? contacts[i - 1].Id : null
            ));     
        }
        insert contacts;
    }

    @IsTest
    static void testCreateAndDeleteMissingNodes() {
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];
        List<Contact> allContacts = [
            SELECT Id, Name, SC_APPrio__c FROM Contact 
            WHERE AccountId = :testAccount.Id
        ];

        Assert.areEqual(10, allContacts.size(), '10 contacts should exist');

        Test.startTest();
            Integer createdNodes = OrgChartController.createMissingNodes(testAccount.Id);
            Integer deletedNodes = OrgChartController.deleteAllNodes(testAccount.Id);
        Test.stopTest();

        Assert.areEqual(10, createdNodes, 'Expected 10 nodes to be created.');
        Assert.areEqual(10, deletedNodes, 'Expected 10 nodes to be deleted.');
    }

    @IsTest 
    static void testGetChartData() {
        Account testAccount = [SELECT Id FROM Account WHERE Name = 'Test Account' LIMIT 1];

        OrgChartController.createMissingNodes(testAccount.Id);

        Test.startTest();
            OrgChartController.GraphDataWrapper graphData = OrgChartController.getChartData(testAccount.Id);
        Test.stopTest();

        Assert.isNotNull(graphData, 'Expected graph data to be returned.');
    }   
}