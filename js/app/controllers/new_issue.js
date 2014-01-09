'use strict';

/**
 * New issue controller
 *
 * @param {Object} $scope
 * @param {Object} BG
 * @param {*} Projects
 * @returns {undefined}
 */
function NewIssue($scope, BG, Projects) {
    //Store selected in context menu text
    var subject = BG.getSelectedText();
    //clear selected text
    BG.clearSelectedText();

    //list of projects
    $scope.projects = [];
    $scope.project = {};

    //User options
    $scope.options = BG.getConfig();
    $scope.success = false;
    //List of errors
    $scope.errors = [];

    $scope.membersLoading = false;

    // Load list of projects from backend
    $scope.getProjects = function() {
        Projects.all().then(function(data) {
            $scope.projects = data;
        });
    };

    /**
     * Load project list
     */
    $scope.getProjects();

    // Issue model
    $scope.issue = {
        subject: subject,
        project_id: 0,
        description: ""
    };

    /**
     * handle project selection
     */
    $scope.projectChanged = function() {
        if ($scope.issue.project_id > 0) {
            $scope.project = BG.com.rdHelper.Projects.get($scope.issue.project_id);
            if (!$scope.project.membersLoaded) {
                BG.com.rdHelper.Projects.getMembers($scope.issue.project_id);
            }
        } else {
            $scope.project = {};
        }
        //clear field depending on selected project
        if ($scope.issue.tracker_id) {
            delete $scope.issue.tracker_id;
        }
        if ($scope.issue.assigned_to_id) {
            delete $scope.issue.assigned_to_id;
        }
    };

    /**
     * Submit handler
     */
    $scope.submit = function() {
        $scope.errors = []; //clear errors
        //checks
        if ($scope.issue.project_id < 1) {
            $scope.errors.push("Please select project");
        }
        //clear empty values
        if ($scope.issue.assigned_to_id == "") {
            delete $scope.issue.assigned_to_id;
        }
        //Check before submit
        if ($scope.errors.length > 0) {
            return false;
        }
        BG.com.rdHelper.Issues.create($scope.issue);
        $scope.showLoading();
    };

    /**
     * On new issue created
     *
     * @param {Object} request
     * @param {Object} sender
     * @param {Object} sendResponse
     * @returns {undefined}
     */
    var onIssueCreated = function(request, sender, sendResponse) {
        $scope.$apply(function(sc) {
            sc.hideLoading();
            sc.success = true;
            //clear issue
            sc.issue = {
                subject: "",
                project_id: 0,
                description: ""
            };
            //clear project
            sc.project = {};
        });
    };
    /**
     * On project details updated
     *
     * @param {Object} request
     * @param {Object} sender
     * @param {Object} sendResponse
     * @returns {*}
     */
    var onProjectUpdated = function(request, sender, sendResponse) {
        //check project
        if (!request.project) {
            return;
        }
        //Check current project
        if ($scope.issue.project_id != request.project.id) {
            return;
        }
        $scope.$apply(function(sc) {
            sc.project = request.project;
        });
    };

    //Handle error on create new issue
    var onCustomError = function(request, sender, sendResponse) {
        if (!request || !request.type || request.type != "issueCreate") {
            return;
        }
        //stop loading
        $scope.hideLoading();
        if (!$scope.$$phase) {
            $scope.$digest();
        }
    };

    //Handle new issue creation
    var onMessage = function(request, sender, sendResponse) {
        if (!request.action && request.action != "issueCreated") {
            return;
        }
        switch(request.action) {
            case "issueCreated":
                return onIssueCreated(request, sender, sendResponse);
                break;
            case "projectUpdated":
                return onProjectUpdated(request, sender, sendResponse);
                break;
            case "customError":
                return onCustomError(request, sender, sendResponse);
                break;
        };
    };

    //Add one global handler for messages from background
    chrome.extension.onMessage.addListener(onMessage);
}
NewIssue.$inject = ['$scope', 'BG', 'Projects'];