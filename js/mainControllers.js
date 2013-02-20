var BG = chrome.extension.getBackgroundPage();

/**
 * Bind tooltips
 * 
 * @param {jQuery} $
 */
jQuery(document).ready(function($) {
    $('.container').tooltip({
        selector: "i[data-type='tooltip']"
    });

    //Popover
    $('.container').popover({
        selector: ".help[data-type='popover']",
        trigger: "hover",
        placement: "top"
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
 * @param {Object} $location
 * @param {Object} $timeout
 * @returns {void} 
 */
function Main($scope, $location, $timeout) {
    $scope.options = BG.getConfig();
    $scope.xhrError = false;
    $scope.projects = BG.com.rdHelper.Projects.all();
    $scope.$location = $location;

    //Custom messages
    $scope.customError = "";
    $scope.customSuccess = "";
    /**
     * Loading dialog flag
     */
    $scope.loading = false;

    /**
     * Sidebar showing flag
     */
    $scope.showSidebar = false;

    /**
     * Show loading dialog
     */
    $scope.showLoading = function() {
        $scope.loading = true;
    }; 

    /**
     * Hide loading dialog
     */
    $scope.hideLoading = function() {
        $scope.loading = false;
    };

    /**
     * Check if loading dialog is shown
     *
     * @returns {boolean}
     */
    $scope.isLoading = function() {
        return $scope.loading;
    }

    /**
     * Shows custom success message
     *
     * @param {String} message HTML message to show
     * @param {Boolean} persist do not hide success message
     */
    $scope.showSuccess = function(message, persist) {
        $scope.customSuccess = message;
        if (!persist) {
            $timeout($scope.hideSuccess, 5000);
        }
    };

    $scope.hideSuccess = function() {
        $scope.customSuccess = "";
    };

    /**
     * Get unread issues count
     * 
     * @returns {Number}
     */
    $scope.getUnreadCount = function() {
        return BG.getIssues().getUnreadCount();
    }
    
    $scope.xhrErrorHandler = function(request, sender, sendResponse) {
        if (request.action && request.action == "globalError" && request.params) {
            console.log(request.params);
            $scope.$apply(function(sc) {
                sc.xhrError = true;
                sc.hideLoading();
            });
        }
    };

    $scope.projectsLoadedHandler = function(request, sender, sendResponse) {
        if (request.action && request.action == "projectsLoaded" && request.projects) {
            $scope.$apply(function(sc) {
                sc.projects = request.projects;
            });
        }
    };

    $scope.onCustomError = function(request, sender, sendResponse) {
        if (request.errors) {
            var msg = "<ul>";
            for(var i in request.errors.errors) {
                msg += "<li>"+request.errors.errors[i]+"</li>";
            }
            msg += "</ul>"
            $scope.$apply(function(sc) {
                sc.customError = msg;
            });
        }
    };

    $scope.onMessageHandler = function(request, sender, sendResponse) {
        if (!request || !request.action) {
            return;
        }
        switch(request.action) {
            case "projectsLoaded":
                $scope.projectsLoadedHandler(request, sender, sendResponse);
                break;
            case "globalError":
                $scope.xhrErrorHandler(request, sender, sendResponse);
                break;
            case "customError":
                $scope.onCustomError(request, sender, sendResponse);
                break;
        }
    };
    
    /**
     * On projects updated
     */
    $scope.updateProjects = function() {
        BG.com.rdHelper.Projects.all(true);
    };

    /**
     * On project filter
     * 
     * @param {Event} event
     */
    $scope.projectChecked = function(event) {
        console.log(event);
    };

    /**
     * Store project filtering settings
     */
    $scope.storeProjects = function() {
        //Clear list
        BG.getConfig().getProjectsSettings().list = [];
        angular.forEach($scope.projects, function(value, key) {
            if (value.used) {
                BG.getConfig().getProjectsSettings().list.push(value.id);
            }
        });
        BG.getConfig().store(BG.getConfig().getProfile());
        BG.com.rdHelper.Projects.store();
        BG.getIssues().clearIssues();
        jQuery('#projectFilters').modal('toggle');
    };
    chrome.extension.onMessage.addListener($scope.onMessageHandler);
}

/**
 * News screen controller 

 * @param {Object} $scope
 */
function News($scope) {
    $scope.news = [];

    $scope.newsLoaded = function(json) {
        console.log(json);
        $scope.$apply(function(sc) {
            if (json.total_count > 0) {
                sc.news = json.news;
            }
            sc.hideLoading();
        });
    };

    $scope.newsError = function(e, resp) {
        $scope.$apply(function(sc) {
            sc.hideLoading();
        });
    };

    $scope.loadNews = function() {
        $scope.news = [];
        $scope.showLoading();
        BG.getNews().load($scope.newsLoaded, $scope.newsError);
    };

    if ($scope.news.length < 1) {
        $scope.loadNews();
    }
}

/**
 * Options screen controller
 * 
 * @param {Object} $scope
 * @param {Object} $timeout
 * @returns {void}
 */
function Options($scope, $timeout) {
    $scope.options = BG.getConfig();
    $scope.useHttpAuth = BG.getConfig().getProfile().useHttpAuth;
    
    /**
     * Save new options
     */
    $scope.storeOptions = function() {
        BG.getConfig().store(BG.getConfig().getProfile());
        $scope.xhrError = false;
        $scope.showSuccess("<strong>Success!</strong> Your setting successfully saved !");
    };

    /**
     * Save notifications options
     */
    $scope.storeNotifications = function() {
        BG.getConfig().getProfile().notifications.show = document.querySelector(".notification_show:checked").value;
        BG.getConfig().store(BG.getConfig().getProfile());
        $scope.options = BG.getConfig();
        $scope.showSuccess("<strong>Success!</strong> Your setting successfully saved !");
    };

    /**
     * Store Misc tab settings
     */
    $scope.storeMisc = function() {
        BG.getConfig().store(BG.getConfig().getProfile());
        $scope.showSuccess("<strong>Success!</strong> Your setting successfully saved !");
    };
    
    /**
     * Check if http auth available
     * 
     * @param {Event} event
     */
    $scope.checkHttpAuth = function(event) {
        $scope.useHttpAuth = $(event.source).is(":checked");
    };
}

/**
 * Main screen controller
 * 
 * @param {Scope} $scope
 * @returns {undefined}
 */
function Home($scope) {
    $scope.options = BG.getConfig();
    $scope.availStatuses = BG.getIssues().getStatuses();
    $scope.issues = [];
    $scope.order = "updated_on";
    $scope.reverse = true;
    
    $scope.pageSize = 25;
    $scope.page = 0;
    
    //Vars for detailed info
    $scope.issue = {};
    $scope.project = {};

    /**
     * Time tracking 
     */

    /**
     * Starts time tracking 
     */
    $scope.startTrackingTime = function() {
        $scope.issue.tracking = true;
    };

    /**
     * Stop time tracking 
     */
    $scope.stopTrackingTime = function() {
        $scope.issue.tracking = false;
    };

    /**
     * On new file selected for upload
     */
    $scope.fileSubmitted = function(file) {
        console.log(file);
    };
    
    /**
     * Store table options
     */
    $scope.storeTableOptions = function() {
        BG.getConfig().store(BG.getConfig().getProfile());
        $('#tableOptions').modal('toggle');
    };
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
        $scope.showLoading();
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

    $scope.replyComment = function() {
        $('#detailsTabs a[href="#addComment"]').tab('show');
    };
    /**
     * Show issue details
     * 
     * @param {Object} issue
     */
    $scope.showDetails = function(issue) {
        BG.getIssues().get(issue, !issue.read);
        $scope.markRead(issue); //mark this issue as read
        $scope.issue = issue;
        $scope.project = BG.com.rdHelper.Projects.get($scope.issue.project.id);
        console.log(issue);
        console.log($scope.project);
        $('#issueDetails').modal('toggle');
    };

    /**
     * Hide comment and store current state
     */
    $scope.toggleMinify = function(history) {
        history.minified = !history.minified;
        BG.getIssues().store();
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
     * Chage estimate hours
     * 
     * @param {int} value
     */
    $scope.estimatedOk = function(value) {
        console.log(value);
        $scope.issue.detailsLoaded = false;
        BG.getIssues().update($scope.issue.id, {'estimated_hours': parseInt(value)});
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
        if ($scope.issue.id == request.id) {
            //update issue
            $scope.$apply(function(sc) {
                sc.issue = request.issue;
                sc.updateIssues();
            });
            sendResponse({});
        }
    };
    
    //Handle update issues list
    var onIssuesUpdated = function(request, sender, sendResponse) {
        $scope.$apply(function(sc) {
            sc.issues = [];
            sc.hideLoading();
            sc.updateIssues();
        });
    };
    
    //handle project updated datas
    var onProjectUpdated = function(request, sender, sendResponse) {
        if (!$scope.issue.project) {
            return;
        }
        $scope.$apply(function(sc) {
            var projId = sc.issue.project.id;
            if (projId && projId > 0 && projId == request.project.id) {
                sc.project = request.project;
            }
        });
    };

    // Handle file upload to redmine
    var onFileUploaded = function(request, sender, sendResponse) {
        var data = {
            'uploads': [ 
                {
                    'token': request.token,
                    'filename': request.file.name,
                    'content_type': request.file.type
                }
            ]
        };
        BG.getIssues().update($scope.issue.id, data);
    };

    //Handle error on update issue
    var onCustomError = function(request, sender, sendResponse) {
        if (!request || !request.type || request.type != "issueUpdate") {
            return;
        }
        //stop loading
        $scope.$apply(function(sc) {
            sc.hideLoading();
        });
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
            case "fileUploaded": 
                return onFileUploaded(request, sender, sendResponse);
                break;
            case "customError":
                return onCustomError(request, sender, sendResponse);
                break;
        }
    };
    
    //Add one global handler for messages from background
    chrome.extension.onMessage.addListener(onMessage);
}

/**
 * New issue controller
 * 
 * @param {Scope} $scope
 * @param {RouteParams} $routeParams
 * @returns {undefined}
 */
function NewIssue($scope) {
    //Store selected in context menu text
    var subject = BG.getSelectedText();
    //clear selected text
    BG.clearSelectedText();
    //list of projects
    $scope.projects = BG.com.rdHelper.Projects.all();
    $scope.project = {};
    
    //User options
    $scope.options = BG.getConfig();
    $scope.success = false;
    //List of errors
    $scope.errors = [];
    
    $scope.membersLoading = false;
    
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
        console.log($scope.project);
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
        BG.getIssues().create($scope.issue);
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
     * @returns {undefined}
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
            console.log("Updated", sc.project);
        });
    };

    //Handle error on create new issue
    var onCustomError = function(request, sender, sendResponse) {
        if (!request || !request.type || request.type != "issueCreate") {
            return;
        }
        //stop loading
        $scope.$apply(function(sc) {
            sc.hideLoading();
        });
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

/**
 * List of your projects
 * 
 * @param {Object} $scope
 * @returns {?}
 */
function Projects($scope) {
    $scope.projects = BG.com.rdHelper.Projects.all();
    
    /**
     * Reload projects list
     */
    $scope.reload = function() {
        $scope.showLoading();
        BG.com.rdHelper.Projects.clear();
        BG.com.rdHelper.Projects.all(true);
    };
    
    /**
     * On projects list updated
     * 
     * @param {Object} request
     * @param {Object} sender
     * @param {Object} sendResponse
     * @returns {undefined}
     */
    var projectsLoaded = function(request, sender, sendResponse) {
        $scope.$apply(function(sc) {
            sc.hideLoading();
            sc.projects = BG.com.rdHelper.Projects.all();
        });
    };
    
    //Handle new issue creation
    var onMessage = function(request, sender, sendResponse) {
        if (!request.action && request.action != "issueCreated") {
            return;
        }
        switch(request.action) {
            case "projectsLoaded":
                return projectsLoaded(request, sender, sendResponse);
                break;
        };
    };

    //Add one global handler for messages from background
    chrome.extension.onMessage.addListener(onMessage);
}

/**
 * Timelines controller 
 * 
 * @param {Object} $scope
 * @returns {?}
 */
function Timelines($scope) {
    $scope.timelines = BG.com.rdHelper.Timeline.all(timelinesLoaded);
    
    /**
     * Handle Timelines loaded
     * 
     * @param {Array} timelines
     */
    function timelinesLoaded(timelines) {
        $scope.$apply(function(sc) {
            sc.timelines = timelines;
        });
    }
}


//Options.$inject = ['$scope', '$timeout'];
//Home.$inject = ['$scope'];
//NewIssue.$inject = ['$scope'];
//Project.$inject = ['$scope', '$routeParams'];