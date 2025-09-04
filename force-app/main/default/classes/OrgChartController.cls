public class OrgChartController {
    
    public class CustomOrgChartException extends Exception {}

    @AuraEnabled(cacheable=true)
    public static List<Contact> searchContacts(String searchKey) {     
        if (String.isBlank(searchKey)) return new List<Contact>();

        String likeKey = '%' + searchKey.replace('%','\\%').replace('_','\\_') + '%';

        return [
            SELECT Id, Name
            FROM Contact
            WHERE Name LIKE :likeKey
            ORDER BY Name
            LIMIT 5
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<OrgChartLinker__c> getOrgChartLinks(Id accountId) {
        return [
            SELECT Id, Parent__r.Id, Parent__r.Name, Parent__r.Department,
                   Child__r.Id, Child__r.Name, Child__r.Department, Description__c
            FROM OrgChartLinker__c
            WHERE Account__c = :accountId
        ];
    }

    private static Map<String, String> buildResponse(String status, String operation, String message) {
        return new Map<String, String>{
            'status' => status,
            'operation' => operation,
            'message' => message
        };
    }
}