public class OrgChartController {
    
    public class CustomOrgChartException extends Exception {}
    
    private static final Map<String, String> PRIORITY_COLORS = new Map<String, String>{
        '0' => '#2BA1B7',
        '1' => '#87B433',
        '2' => '#42A12E',
        '3' => '#B2BE36',
        '4' => 'rgba(135, 140, 145, 1)'
    };
    
    private static final String ORG_CHART_LINKER_OBJECT = 'OrgChartLinker__c';
    private static final String CONTACT_OBJECT = 'Contact';
    
    private static final List<String> CONTACT_FIELDS = new List<String>{
        'Id', 'Name', 'Department', 'SC_APPrio__c', 'ReportsToId', 'ReportsTo.Name'
    };
    private static final List<String> LINKER_FIELDS = new List<String>{
        'Id', 'Source__c', 'Target__c', 'Source_Text__c', 'Target_Text__c', 'Account__c'
    };
    
    @AuraEnabled(cacheable=true)
    public static List<CytoscapeNode> getOrgChartData(String recordId, String orgChartId) {
        if (String.isBlank(recordId) || String.isBlank(orgChartId)) {
            throw new CustomOrgChartException('Record ID and Org Chart ID must be provided.');
        }
        
        List<Contact> contacts = Database.query(
            'SELECT ' + String.join(CONTACT_FIELDS, ', ') +
            ' FROM Contact WHERE AccountId = :recordId'
            );
        
        List<OrgChartLinker__c> linkers = Database.query(
            'SELECT ' + String.join(LINKER_FIELDS, ', ') +
            ' FROM ' + ORG_CHART_LINKER_OBJECT +
            ' WHERE Account__c = :recordId'
            );
        
        if (contacts.isEmpty() || linkers.isEmpty()) {
            throw new CustomOrgChartException('No contacts or linkers found for the provided record ID.');
        }
        
        List<CytoscapeNode> nodes = new List<CytoscapeNode>();
        
        for (OrgChartLinker__c linker : linkers) {
            List<CytoscapeNode> linkerNodes = createNodesFromLinkers(linker, contacts);
            
            if (!linkerNodes.isEmpty()) {
                nodes.addAll(linkerNodes);
            }
        }
        
        for (Contact contact : contacts) {
            CytoscapeNode node = createNodeFromContact(contact);
            
            if (node != null) {
                nodes.add(node);
            }
        }
        
        List<CytoscapeNode> sanitizedNodes = new List<CytoscapeNode>();
        for (CytoscapeNode node : nodes) {
            Map<String, Object> sfdata = node.sfdata;

            if (node.linkId != null || (sfdata.get('SC_APPrio__c') == '1' || sfdata.get('SC_APPrio__c') == '2' || sfdata.get('SC_APPrio__c') == '3')) {
                sanitizedNodes.add(node);
            } 
        }
        return sanitizedNodes;
    }
    
    private static List<CytoscapeNode> createNodesFromLinkers(OrgChartLinker__c linker, List<Contact> contacts) {
        List<String> entities = new List<String>{ 'Source', 'Target' };
        List<CytoscapeNode> nodes = new List<CytoscapeNode>();
        
        for (String entity : entities) {
            CytoscapeNode node = new CytoscapeNode();
            
            Contact entityRecord = findContactById((String) linker.get(entity + '__c'), contacts);
            
            node.id = entityRecord != null ? (String) linker.get(entity + '__c') : (String )linker.get(entity + '_Text__c');
            node.label = entityRecord != null ? entityRecord.Name : (String) linker.get(entity + '_Text__c');
            node.backgroundColor = entityRecord != null ? (String) PRIORITY_COLORS.get(entityRecord.SC_APPrio__c) : (String) PRIORITY_COLORS.get('4') ;
            node.linkId = linker.Id;
            
            node.sfdata = new Map<String, Object>{
                'Id' => entityRecord != null ? (String) entityRecord.Id : UUID.randomUUID().toString(),
                'Name' => entityRecord != null ? entityRecord.Name : (String) linker.get(entity + '_Text__c'),
                'Department' => entityRecord != null ? entityRecord.Department : null,
                'SC_APPrio__c' => entityRecord != null ? entityRecord.SC_APPrio__c : null,
                'ReportsToId' => entityRecord != null ? entityRecord.ReportsToId : null,
                'ReportsToName' => entityRecord != null ? entityRecord.ReportsTo?.Name : null
            };
            
            nodes.add(node);
        }
        
        return nodes;
    }
    
    private static CytoscapeNode createNodeFromContact(Contact contact) {
        CytoscapeNode node = new CytoscapeNode();
        
        node.id = contact.Id;
        node.label = contact.Name;
        node.backgroundColor = PRIORITY_COLORS.get(contact.SC_APPrio__c);
        
        node.sfdata = new Map<String, Object>{
            'Id' => contact.Id,
            'Name' => contact.Name,
            'Department' => contact.Department,
            'SC_APPrio__c' => contact.SC_APPrio__c,
            'ReportsToId' => contact.ReportsToId,
            'ReportsToName' => contact.ReportsTo?.Name
        };
        
        return node;
    }
    
    private static Contact findContactById(String contactId, List<Contact> contacts) {

        if (contactId == null || !isSalesforceId(contactId)) {
            return null;
        }
        
        for (Contact contact : contacts) {
            if (contact.Id == contactId) {
                return contact;
            }
        }
        return null;
    }
    
    private static Boolean isSalesforceId(String candidate) {
        return candidate != null &&
            (candidate.length() == 15 || candidate.length() == 18) &&
            Pattern.matches('^[a-zA-Z0-9]+$', candidate);
    }
    
    public class CytoscapeNode {
        @AuraEnabled public String id;
        @AuraEnabled public String label;
        @AuraEnabled public String backgroundColor;
        @AuraEnabled public String linkId;
        @AuraEnabled public Map<String, Object> sfdata;
    }
}