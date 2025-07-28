public class OrgChartController {
    

    public class CustomOrgChartException extends Exception {}

    private static Map<String, String> buildResponse(String status, String operation, String message) {
        return new Map<String, String>{
            'status' => status,
            'operation' => operation,
            'message' => message
        };
    }
}