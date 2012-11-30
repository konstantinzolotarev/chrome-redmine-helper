/**
 * Controller for project template
 * @param {Object} $scope
 * @param {Object} $routeParams
 * @returns {void}
 */
function Project($scope, $routeParams) {
    $scope.id = $routeParams.id;

    //available filters
    $scope.filters = {
        'onlyMy': false
    };
    //Filters for issues list
    $scope.issueFilter = {
        'assigned_to': ""
    };
    //Load current user data
    $scope.myId = BG.getConfig().getProfile().currentUserId;

    //Load project details
    $scope.project = BG.getProjects().get($scope.id);
    //list of issues
    $scope.issues = [];
    //Get list of issue statuses
    $scope.issueStatuses = BG.getIssues().getStatuses();


    /**
     * List of cols for issues
     */
    $scope.cols = [
        {
            'title': "Open",
            'order': 0,
            'issues': []
        },
        {
            'title': "In progress",
            'order': 1,
            'issues': []
        },
        {
            'title': "Done",
            'order': 2,
            'issues': []
        }
    ];
    /**
     * Bind issues to filtering
     */
    $scope.bindIssues = function() {
        $scope.issues = [];
        for(var colKey in $scope.cols) {
            $scope.cols[colKey].issues = [];
        }
        for(var key in $scope.project.issues) {
            $scope.cols[0].issues.push($scope.project.issues[key]);
        }
    };

    //Run issues loading 
    BG.getProjects().getIssues($scope.id);
    $scope.bindIssues();

    console.log($scope.issues);

    /**
     * Reload current project
     */
    $scope.updateProject = function() {
        BG.getProjects().get($scope.id, true);
        BG.getProjects().getIssues($scope.id, 0, true);
    };

    /**
     * Store issues statuses that should be visible in table
     */
    $scope.storeIssuesSelection = function() {

    };

    /**
     * Show/Hide only my issues filter
     */
    $scope.onlyMy = function() {
        $scope.filters.onlyMy = !$scope.filters.onlyMy;  
        $scope.issueFilter.assigned_to = $scope.filters.onlyMy ? $scope.myId : "";
    };

    /**
     * On project details updated
     * 
     * @param {Object} request
     * @param {Object} sender
     * @param {Object} sendResponse
     * @returns {undefined}
     */
    var onProjectUpdated = function(request, sender, sendResponse) {
        //check project
        if (!request.project) {
            return;
        }
        //Check current project
        if ($scope.id != request.project.id) {
            return;
        }
        $scope.$apply(function(sc) {
            sc.project = request.project;
            sc.bindIssues();
            console.log(request.project);
        });
    };

    //Handle new issue creation
    var onMessage = function(request, sender, sendResponse) {
        if (!request.action && request.action != "issueCreated") {
            return;
        }
        switch(request.action) {
            case "projectUpdated":
                return onProjectUpdated(request, sender, sendResponse);
                break;
        };
    };

    //Add one global handler for messages from background
    chrome.extension.onMessage.addListener(onMessage);
}