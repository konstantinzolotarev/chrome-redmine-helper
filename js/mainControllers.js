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
 * @param {Object} issue
 * @returns {undefined}
 */
function openAuthorPage(issue) {
    chrome.tabs.create({url: BG.getConfig().getHost()+"users/"+issue.author.id});
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
 * @returns {void}
 */
function Options($scope) {
    $scope.options = config;
    $scope.useHttpAuth = config.profile.useHttpAuth;
    $scope.storeOptions = function() {
        config.profile.host = document.querySelector("#inputHost").value;
        config.profile.apiAccessKey = document.querySelector("#inputApiKey").value;
        config.profile.useHttpAuth = $scope.useHttpAuth;
        config.profile.httpUser = config.profile.useHttpAuth ? document.querySelector("#httpUser").value : "";
        config.profile.httpPass = config.profile.useHttpAuth ? document.querySelector("#httpPass").value : "";
        config.store(config.profile);
        BG.clearItems();
        $scope.options = config;
    };
    
    $scope.checkHttpAuth = function(event) {
        $scope.useHttpAuth = $(event.source).is(":checked");
    };
}

function Home($scope) {
    $scope.options = config;
    $scope.issues = [];
    $scope.order = "updated_on";
    $scope.reverse = true;
    $scope.issue = {};
    $scope.isLoading = false;
    
    $scope.updateIssues = function() {
        $scope.issues = [];
        for(var key in BG.getIssues().issues) {
            $scope.issues.push(BG.getIssues().issues[key]);
        }
    };
    $scope.updateIssues();
    $scope.markRead = function(issue) {
        if (issue.read) {
            return;
        }
        console.log(issue);
        BG.getIssues().markAsRead(issue.id);
        issue.read = true;
    };
    
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
     * @param {Object} issue
     * @returns {undefined}
     */
    $scope.openAuthorPage = function(issue) {
        openAuthorPage(issue);
    };
    
    $('#issueDetails').modal({
        show: false
    });
    /**
     * Show issue details
     */
    $scope.showDetails = function(issue) {
        $scope.issue = issue;
        $('#issueDetails').modal('toggle');
    };
    
    var onIssuesUpdated = function(request, sender, sendResponse) {
        if (request.action && request.action == "issuesUpdated") {
            $scope.$apply(function(sc) {
                sc.issues = [];
                sc.isLoading = false;
                for(var key in BG.getIssues().issues) {
                    sc.issues.push(BG.getIssues().issues[key]);
                }
            });
        }
    };
    
//    if (config.getProfile().selectedProject) {
//        window.location.href = chrome.extension.getURL("html/main.html#/project/"+config.getProfile().selectedProject);
//    }
    // Add handler for issues updated
    chrome.extension.onMessage.addListener(onIssuesUpdated);
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

function Issues($scope, $timeout) {
    $scope.options = config;
    $scope.loading = true;
    $scope.stopLoading = function() {
        $scope.loading = false;
    };
    $timeout($scope.stopLoading, 5000);
}

//Options.$inject = ['$scope'];
//Home.$inject = ['$scope'];
//Issues.$inject = ['$scope', '$timeout'];
//Project.$inject = ['$scope', '$routeParams'];