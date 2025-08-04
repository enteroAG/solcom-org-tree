public class OrgChartController {
    
    public class CustomOrgChartException extends Exception {}

    @AuraEnabled(cacheable=true)
    public static List<OrgChartLinker__c> getOrgChartLinks(Id accountId) {
        return [
            SELECT Id, Parent__r.Id, Parent__r.Name, Parent__r.Department,
                   Child__r.Id, Child__r.Name, Child__r.Department
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