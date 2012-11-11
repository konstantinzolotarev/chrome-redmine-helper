var BG = chrome.extension.getBackgroundPage();

/**
 * 
 * @type Config
 */
var config = BG.getConfig();

/**
 * 
 * @type Loader
 */
var loader = BG.getLoader();

/**
 * 
 * @type Projects
 */
var projects = BG.getProjects();
/**
 * Bind tooltips
 */
jQuery(document).ready(function($) {
    $('.container').tooltip({
        selector: "i[data-type='tooltip']"
    });
});

/**
 * Open Issue Author's Redmine page
 * 
 * @param {int} userId
 * @returns {undefined}
 */
function openAuthorPage(userId) {
    chrome.tabs.create({url: BG.getConfig().getHost()+"users/"+userId});
}

/**
 * Main controller
 * 
 * @param {Object} $scope
 * @returns {void}
 */
function Main($scope) {
    $scope.options = config;
    $scope.xhrError = false;
    $scope.projects = projects.all();
    $scope.xhrErrorHandler = function(request, sender, sendResponse) {
        if (request.action && request.action == "xhrError" && request.params) {
            $scope.$apply(function(sc) {
                sc.xhrError = true;
            });
        }
    };
    $scope.onMessageHandler = function(request, sender, sendResponse) {
        if (request.action && request.action == "projectsLoaded" && request.projects) {
            $scope.$apply(function(sc) {
                sc.projects = request.projects;
            });
        }
    };
    
    $scope.updateProjects = function() {
        projects.all(true);
    };
    chrome.extension.onMessage.addListener($scope.xhrErrorHandler);
    chrome.extension.onMessage.addListener($scope.onMessageHandler);
}

/**
 * Options screen controller
 * 
 * @param {Object} $scope
 * @param {Object} $timeout
 * @returns {void}
 */
function Options($scope, $timeout) {
    $scope.options = config;
    $scope.success = false;
    $scope.useHttpAuth = config.profile.useHttpAuth;
    /**
     * Hide success message
     */
    $scope.hideSuccess = function() {
        $scope.success = false;
    };
    /**
     * Save new options
     */
    $scope.storeOptions = function() {
        config.profile.host = document.querySelector("#inputHost").value;
        config.profile.apiAccessKey = document.querySelector("#inputApiKey").value;
        config.profile.useHttpAuth = $scope.useHttpAuth;
        config.profile.httpUser = config.profile.useHttpAuth ? document.querySelector("#httpUser").value : "";
        config.profile.httpPass = config.profile.useHttpAuth ? document.querySelector("#httpPass").value : "";
        config.store(config.profile);
        BG.clearItems();
        $scope.options = config;
        $scope.success = true;
        $timeout($scope.hideSuccess, 5000);
    };
    
    $scope.checkHttpAuth = function(event) {
        $scope.useHttpAuth = $(event.source).is(":checked");
    };
}

function Home($scope) {
    $scope.options = config;
    $scope.availStatuses = BG.getIssues().getStatuses();
    $scope.issues = [];
    $scope.order = "updated_on";
    $scope.reverse = true;
    $scope.isLoading = false;
    
    $scope.pageSize = 25;
    $scope.page = 0;
    
    //Vars for detailed info
    $scope.issue = {};
    $scope.project = {};
    
    /**
     * Get number of pages for list of issues
     * 
     * @returns {int}
     */
    $scope.numberOfPages=function(){
        return Math.ceil($scope.issues.length/$scope.pageSize);                
    };
    
    /**
     * Update issues on the screen.
     */
    $scope.updateIssues = function() {
        $scope.issues = [];
        for(var key in BG.getIssues().issues) {
            $scope.issues.push(BG.getIssues().issues[key]);
        }
    };
    //Run update issues action
    $scope.updateIssues();
    
    /**
     * Mark issue as read 
     * 
     * @param {Object} issue
     * @returns {undefined}
     */
    $scope.markRead = function(issue) {
        if (issue.read) {
            return;
        }
        BG.getIssues().markAsRead(issue.id);
        issue.read = true;
    };

    /**
     * Mark issue unread
     *
     * @param {Object} issue
     */
    $scope.markUnRead = function(issue) {
        if (!issue.read) {
            return;
        }
        BG.getIssues().markAsUnRead(issue.id);
        issue.read = false;
    };
    
    /**
     * Mark all visible issues as read
     * 
     * @returns {undefined}
     */
    $scope.markAllRead = function() {
        BG.getIssues().markAllAsRead();
        $scope.updateIssues();
    };
    
    /**
     * Reload issues
     * 
     * @returns {undefined}
     */
    $scope.reload = function() {
        $scope.isLoading = true;
        BG.getIssues().load();
    };
    
    /**
     * Open new tab with issue details
     * 
     * @param {Object} issue
     */
    $scope.openWebPage = function(issue) {
        chrome.tabs.create({url: BG.getConfig().getHost()+"issues/"+issue.id});
    };
    
    /**
     * Open authors Redmine page
     * @param {int} userId
     * @returns {undefined}
     */
    $scope.openAuthorPage = function(userId) {
        openAuthorPage(userId);
    };
    
    $('#issueDetails').modal({
        show: false
    });
    /**
     * Show issue details
     * 
     * @param {Object} issue
     */
    $scope.showDetails = function(issue) {
        BG.getIssues().get(issue, !issue.read);
        $scope.markRead(issue); //mark this issue as read
        $scope.issue = issue;
        $scope.project = BG.getProjects().get($scope.issue.project.id);
        console.log(issue);
        console.log($scope.project);
        $('#issueDetails').modal('toggle');
    };

    /**
     * Change the issue status and update it in Redmine
     * 
     * @param {String} value new issue status
     * @returns {void}
     */
    $scope.stausOk = function(value) {
        $scope.issue.detailsLoaded = false;
        BG.getIssues().update($scope.issue.id, {'status_id': parseInt(value)});
    };

    /**
     * Update tracker data into issue
     * 
     * @param {int} value
     */
    $scope.trackOk = function(value) {
        $scope.issue.detailsLoaded = false;
        BG.getIssues().update($scope.issue.id, {'tracker_id': parseInt(value)});
    };

    /**
     * Update issue done ratio
     * 
     * @param {int} value
     */
    $scope.doneOk = function(value) {
        $scope.issue.detailsLoaded = false;
        BG.getIssues().update($scope.issue.id, {'done_ratio': parseInt(value)});
    };

    /**
     * Add new comment to issue
     * 
     * @param {String} comment
     */
    $scope.addComment = function(comment) {
        $scope.issue.detailsLoaded = false;
        BG.getIssues().comment($scope.issue.id, comment);
    };
    
    //Handle update issue details
    var onIssueDetails = function(request, sender, sendResponse) {
        if (request.action && request.action == "issueDetails") {
            if ($scope.issue.id == request.id) {
                //update issue
                $scope.$apply(function(sc) {
                    sc.issue = request.issue;
                    sc.updateIssues();
                });
                sendResponse({});
            }
        }
    };
    
    //Handle update issues list
    var onIssuesUpdated = function(request, sender, sendResponse) {
        if (request.action && request.action == "issuesUpdated") {
            $scope.$apply(function(sc) {
                sc.issues = [];
                sc.isLoading = false;
                sc.updateIssues();
            });
        }
    };
    
    //handle project updated datas
    var onProjectUpdated = function(request, sender, sendResponse) {
        if (request.action && request.action == "projectUpdated" && request.project) {
            $scope.$apply(function(sc) {
                var projId = sc.issue.project.id;
                if (projId && projId > 0 && projId == request.project.id) {
                    sc.project = request.project;
                }
            });
        }
    };
    
    //Global message listener
    var onMessage = function(request, sender, sendResponse) {
        if (!request.action) {
            return;
        }
        switch(request.action) {
            case "issueDetails": 
                return onIssueDetails(request, sender, sendResponse);
                break;
            case "issuesUpdated": 
                return onIssuesUpdated(request, sender, sendResponse);
                break;
            case "projectUpdated": 
                return onProjectUpdated(request, sender, sendResponse);
                break;
        }
    };
    
    //Add one global handler for messages from background
    chrome.extension.onMessage.addListener(onMessage);
}

/**
 * Controller for project template
 * @param {Object} $scope
 * @param {Object} $routeParams
 * @returns {void}
 */
function Project($scope, $routeParams) {
    $scope.id = $routeParams.id;
    $scope.project = projects.get($scope.id);
    config.setSelectedProject($scope.id);
    projects.get($scope.id);
    $scope.issues = projects.getIssues($scope.id);
}


//Options.$inject = ['$scope', '$timeout'];
//Home.$inject = ['$scope'];
//Project.$inject = ['$scope', '$routeParams'];