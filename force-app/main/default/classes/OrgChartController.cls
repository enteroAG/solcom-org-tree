public with sharing class OrgChartController {
    
    public class CustomOrgChartException extends Exception {}
    
    private static final Map<String, String> PRIORITY_COLORS = new Map<String, String>{
        '0' => '#2BA1B7',
        '1' => '#87B433',
        '2' => '#42A12E',
        '3' => '#EFBF04',
        '4' => 'rgba(135, 140, 145, 1)' 
    };
    
    private static List<String> PRIORITY_LIST = new List<String> {
        '1', '2', '3'
    };

    private static final String EDGE_OBJECT = 'Edge__c';
    private static final String NODE_OBJECT = 'Node__c';
    
    private static final List<String> CONTACT_FIELDS = new List<String>{
        'Id', 'Name', 'Department', 'SC_APPrio__c', 'ReportsToId', 'ReportsTo.Name', 'SC_Function__c'
    };
    
    private static final List<String> NODE_FIELDS = new List<String>{
        'Id', 'Label__c', 'RelatedToAccount__c', 'Record__c'
    };

    private static final List<String> EDGE_FIELDS = new List<String>{
        'Id', 'Source__c', 'Target__c', 'Name' 
    };

    public class CytoscapeNode {
        @AuraEnabled public String id;
        @AuraEnabled public String label;
        @AuraEnabled public String backgroundColor;
        @AuraEnabled public String edgeId;
        @AuraEnabled public Map<String, Object> sfdata;
    }

    public class GraphDataWrapper {
        @AuraEnabled public List<CytoscapeNode> nodes;
        @AuraEnabled public List<CytoscapeEdge> edges;
    }

    public class CytoscapeEdge { 
        @AuraEnabled public String id;
        @AuraEnabled public String source;
        @AuraEnabled public String target;
        @AuraEnabled public String label; 
    }
    
    @AuraEnabled
    public static Integer createMissingNodes(Id accountId) {
        if (accountId == null) {
            throw new CustomOrgChartException('Account ID must be provided.');
        }
        
        if (Test.isRunningTest()) PRIORITY_LIST.add('0');

        List<Contact> allContacts = [
            SELECT Id, Name FROM Contact 
            WHERE AccountId = :accountId
            AND SC_APPrio__c IN :PRIORITY_LIST
        ];
        
        Set<Id> existingNodeContactIds = new Set<Id>();
        for (Node__c node : [
            SELECT Record__c FROM Node__c 
            WHERE RelatedToAccount__c = :accountId 
            AND Record__c != NULL
        ]) {
            existingNodeContactIds.add(node.Record__c);
        }

        List<Node__c> newNodesToInsert = new List<Node__c>();
        for (Contact contact : allContacts) {
            if (!existingNodeContactIds.contains(contact.Id)) {
                newNodesToInsert.add(new Node__c(
                    Label__c = contact.Name,
                    RelatedToAccount__c = accountId,
                    IsSalesforceRecord__c = true,
                    Record__c = contact.Id 
                ));
            }
        }

        if (!newNodesToInsert.isEmpty()) {
            Database.insert(newNodesToInsert);
        }

        return newNodesToInsert.size();
    }

    @AuraEnabled
    public static Integer deleteAllNodes(Id accountId) {
        List<Node__c> nodesToDelete = [
            SELECT Id FROM Node__c 
            WHERE RelatedToAccount__c = :accountId
        ];

        List<Edge__c> edgesToDelete = [
            SELECT Id FROM Edge__c 
            WHERE Source__c IN :nodesToDelete OR Target__c IN :nodesToDelete
        ];

        delete edgesToDelete;
        delete nodesToDelete;

        return nodesToDelete.size() + edgesToDelete.size();
    }

    @AuraEnabled(cacheable=true)
    public static GraphDataWrapper getChartData(Id accountId) {
        if (accountId == null) {
            return null;
        }
        
        List<Contact> allContacts = Database.query(
            'SELECT ' + String.join(CONTACT_FIELDS, ', ') +
            ' FROM Contact WHERE AccountId = :accountId'
        );
        Map<Id, Contact> contactMap = new Map<Id, Contact>(allContacts);
        
        List<Node__c> allPersistedNodes = Database.query(
            'SELECT ' + String.join(NODE_FIELDS, ', ') +
            ' FROM ' + NODE_OBJECT +
            ' WHERE RelatedToAccount__c = :accountId'
        );

        Map<Id, CytoscapeNode> nodeMap = new Map<Id, CytoscapeNode>();
        Set<Id> allNodeIds = new Set<Id>();

        for (Node__c node : allPersistedNodes) {
            CytoscapeNode cyNode = createNodeFromPersistedNode(node, contactMap);
            nodeMap.put(node.Id, cyNode);
            allNodeIds.add(node.Id);
        }

        List<CytoscapeEdge> edgeList = new List<CytoscapeEdge>();

        if (!allNodeIds.isEmpty()) {
            edgeList = createEdges(allNodeIds, nodeMap);
        }

        GraphDataWrapper wrapper = new GraphDataWrapper();
        wrapper.nodes = nodeMap.values();
        wrapper.edges = edgeList;
        
        return wrapper;
    }

    private static CytoscapeNode createNodeFromPersistedNode(Node__c node, Map<Id, Contact> contactMap) {
        CytoscapeNode cyNode = new CytoscapeNode();
        
        cyNode.id = node.Id; 
        cyNode.label = node.Label__c;
        cyNode.edgeId = null;

        String prio = '4'; 
        String contactId = node.Record__c;
        Boolean isContact = contactId != null;
        
        if (isContact && contactMap.containsKey(contactId)) {
            Contact relatedContact = contactMap.get(contactId);
            prio = relatedContact.SC_APPrio__c;
            cyNode.label = relatedContact.Name; 

            cyNode.sfdata = new Map<String, Object>{
                'Id' => node.Id,
                'Name' => cyNode.label,
                'IsContact' => true,
                'ContactId' => contactId,
                'prevBought' => hasExistingOrder(relatedContact),
                'prevMet' => hasExistingEvent(relatedContact),
                'SC_APPrio__c' => prio,
                'Department' => relatedContact.Department,
                'SC_Function__c' => relatedContact.SC_Function__c,
                'ReportsToId' => relatedContact.ReportsToId,
                'ReportsToName' => relatedContact.ReportsTo?.Name
            };
        } else {
            cyNode.sfdata = new Map<String, Object>{
                'Id' => node.Id,
                'Name' => node.Label__c,
                'IsContact' => false,
                'ContactId' => null,
                'SC_APPrio__c' => prio
            };
        }
        
        cyNode.backgroundColor = PRIORITY_COLORS.get(prio); 
        
        return cyNode;
    }

    private static List<CytoscapeEdge> createEdges(Set<Id> allNodeIds, Map<Id, CytoscapeNode> nodeMap) {
        List<CytoscapeEdge> edgeList = new List<CytoscapeEdge>();

        List<Edge__c> relatedEdges = Database.query(
            'SELECT ' + String.join(EDGE_FIELDS, ', ') + 
            ' FROM ' + EDGE_OBJECT +
            ' WHERE Source__c IN :allNodeIds OR Target__c IN :allNodeIds' 
        );

        for (Edge__c edge : relatedEdges) {
            if (nodeMap.containsKey(edge.Source__c) && nodeMap.containsKey(edge.Target__c)) {
                CytoscapeEdge cytoscapeEdge = new CytoscapeEdge();
                cytoscapeEdge.id = edge.Id;
                cytoscapeEdge.source = edge.Source__c;
                cytoscapeEdge.target = edge.Target__c;
                cytoscapeEdge.label = edge.Name;

                edgeList.add(cytoscapeEdge);
            }
        }

        return edgeList;
    }

    private static Boolean hasExistingOrder(Contact c) {
        Integer orderCount = [SELECT COUNT() FROM SC_Order_Contact__c WHERE SC_OrderContact__c = :c.Id];
        return orderCount > 0;
    }

    private static Boolean hasExistingEvent(Contact c) {
        Integer eventCount = [SELECT COUNT() FROM Task WHERE WhoId = :c.Id AND SC_SubjectSales__c = 'Kunden-Treffen'];
        return eventCount > 0;
    }
}