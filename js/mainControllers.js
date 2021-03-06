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
    $scope.projects = {};
    $scope.$location = $location;

    //loading projects
    BG.com.rdHelper.Projects.all(function(projects) {
        for(var i in projects) {
            $scope.projects[i] = projects[i];
        }
        if (!$scope.$$phase) {
            $scope.$digest();
        }
    });
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
        return BG.com.rdHelper.Issues.getUnreadCount();
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
            $scope.projects = request.projects;
            if(!$scope.$$phase) {
                $scope.$digest();
            }
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
        BG.com.rdHelper.Projects.clear();
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
        BG.com.rdHelper.Issues.clearIssues();
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
        BG.com.rdHelper.News.load($scope.newsLoaded, $scope.newsError);
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
     * Clear all stored objects in storage
     */
    $scope.clearStorage = function() {
        if (!confirm("Are you sure ?")) {
            return;
        }
        chrome.storage.local.clear();
    };
    
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
    $scope.availStatuses = BG.com.rdHelper.Issues.getStatuses();
    $scope.issues = [];
    $scope.order = "updated_on";
    $scope.reverse = true;
    
    $scope.pageSize = 25;
    $scope.page = 0;
    
    //Vars for detailed info
    $scope.issue = {};
    $scope.project = {};

    $scope.scroll = function(top) {
        if (top) {
            var id = "#scrollToBottom";
        } else {
            var id = "#scrollToTop";
        }
        jQuery("#issueDetails .modal-body").animate({
            scrollTop: $(id).offset().top
        }, 500);
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
        for(var key in BG.com.rdHelper.Issues.issues) {
            $scope.issues.push(BG.com.rdHelper.Issues.issues[key]);
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
        BG.com.rdHelper.Issues.markAsRead(issue.id);
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
        BG.com.rdHelper.Issues.markAsUnRead(issue.id);
        issue.read = false;
    };
    
    /**
     * Mark all visible issues as read
     * 
     * @returns {undefined}
     */
    $scope.markAllRead = function() {
        BG.com.rdHelper.Issues.markAllAsRead();
        $scope.updateIssues();
    };

    /**
     * Reload issues
     * 
     * @returns {undefined}
     */
    $scope.reload = function() {
        $scope.showLoading();
        BG.com.rdHelper.Issues.load();
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
        BG.com.rdHelper.Issues.get(issue, !issue.read);
        $scope.markRead(issue); //mark this issue as read
        $scope.issue = issue;
        $scope.project = BG.com.rdHelper.Projects.get($scope.issue.project.id);
        $scope.updateIssueTimeline();
        $('#issueDetails').modal('toggle');
    };
    
    /**
     * Update timeline for issue now selected
     */
    $scope.updateIssueTimeline = function() {
        if (!$scope.issue) {
            return;
        }
        BG.com.rdHelper.Timeline.getByIssueId($scope.issue.id, function(list) {
            $scope.issue.tracking = false;
            $scope.issue.timelines = [];
            var total = 0;
            for(var i in list) {
                if (list[i].end && list[i].spent) {
                    $scope.issue.timelines.push(list[i]);
                    total += list[i].spent;
                } else {
                    $scope.issue.tracking = true;
                }
            }
            $scope.issue.timelineTotal = total;
            if (!$scope.$$phase) {
                $scope.$digest();
            }
        });
    };
    
    /**
     * Clear timeline for selected issue
     */
    $scope.clearTimeline = function(issue) {
        BG.com.rdHelper.Timeline.clearByIssueId(issue.id, function() {
            BG.com.rdHelper.Timeline.store();
            $scope.issue.tracking = false;
            $scope.issue.timelines = [];
            if (!$scope.$$phase) {
                $scope.$digest();
            }
        });
    };

    /**
     * Removes timeline from issue
     *
     * @param {Object} timeline
     */
    $scope.removeTimeline = function(timeline) {
        if (!timeline || typeof timeline != "object") {
            return;
        }
        if (!confirm("Are you sure ?")) {
            return;
        }
        BG.com.rdHelper.Timeline.remove(timeline, timeline.issueId, function() {
            $scope.updateIssueTimeline();
            if (!$scope.$$phase) {
                $scope.$digest();
            }
        });
    };
    
    /**
     * Time tracking 
     */

    /**
     * Starts time tracking 
     */
    $scope.startTrackingTime = function() {
        var timeline = {
            issueId: $scope.issue.id
        };
        BG.com.rdHelper.Timeline.add(timeline, function() {
            $scope.issue.tracking = true;
            if (!$scope.$$phase) {
                $scope.$digest();
            }
        });
    };

    /**
     * Stop time tracking 
     */
    $scope.stopTrackingTime = function() {
        if (!$scope.issue.id) {
            return;
        }
        BG.com.rdHelper.Timeline.stopPoccess($scope.issue.id, function() {
            $scope.issue.tracking = false;
            $scope.updateIssueTimeline();
            if (!$scope.$$phase) {
                $scope.$digest();
            }
        });
    };

    /**
     * Hide comment and store current state
     */
    $scope.toggleMinify = function(history) {
        history.minified = !history.minified;
        BG.com.rdHelper.Issues.store();
    };

    /**
     * Change the issue status and update it in Redmine
     * 
     * @param {String} value new issue status
     * @returns {void}
     */
    $scope.stausOk = function(value) {
        $scope.issue.detailsLoaded = false;
        BG.com.rdHelper.Issues.update($scope.issue.id, {'status_id': parseInt(value)});
    };

    /**
     * Update tracker data into issue
     * 
     * @param {int} value
     */
    $scope.trackOk = function(value) {
        $scope.issue.detailsLoaded = false;
        BG.com.rdHelper.Issues.update($scope.issue.id, {'tracker_id': parseInt(value)});
    };

    /**
     * Update issue done ratio
     * 
     * @param {int} value
     */
    $scope.doneOk = function(value) {
        $scope.issue.detailsLoaded = false;
        BG.com.rdHelper.Issues.update($scope.issue.id, {'done_ratio': parseInt(value)});
    };

    /**
     * Chage estimate hours
     * 
     * @param {int} value
     */
    $scope.estimatedOk = function(value) {
        $scope.issue.detailsLoaded = false;
        BG.com.rdHelper.Issues.update($scope.issue.id, {'estimated_hours': parseInt(value)});
    };

    /**
     * Add new comment to issue
     * 
     * @param {String} comment
     */
    $scope.addComment = function(comment) {
        $scope.issue.detailsLoaded = false;
        BG.com.rdHelper.Issues.comment($scope.issue.id, comment);
    };
    
    //Handle update issue details
    var onIssueDetails = function(request, sender, sendResponse) {
        if ($scope.issue.id == request.id) {
            //update issue
            $scope.$apply(function(sc) {
                sc.issue = request.issue;
                sc.updateIssues();
                sc.updateIssueTimeline();
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
        BG.com.rdHelper.Issues.update($scope.issue.id, data);
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
 * @returns {undefined}
 */
function NewIssue($scope) {
    //Store selected in context menu text
    var subject = BG.getSelectedText();
    //clear selected text
    BG.clearSelectedText();
    //list of projects
    $scope.projects = {};
    $scope.project = {};
    BG.com.rdHelper.Projects.all();
    
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
            console.log("Updated", sc.project);
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

/**
 * List of your projects
 * 
 * @param {Object} $scope
 * @returns {?}
 */
function Projects($scope) {
    //list of projects
    $scope.projects = {};
    BG.com.rdHelper.Projects.all(function(projects) {
        for(var i in projects) {
            $scope.projects[i] = projects[i];
        }
        if (!$scope.$$phase) {
            $scope.$digest();
        }
    });
    
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
//        if (!$scope.$$phase) {
            $scope.$apply(function(sc) {
                sc.hideLoading();
                sc.projects = BG.com.rdHelper.Projects.projects;
            });
//        }
    };
    
    //Handle new issue creation
    var onMessage = function(request, sender, sendResponse) {
        if (request.action && request.action == "projectsLoaded") {
            return projectsLoaded(request, sender, sendResponse);
        }
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
    $scope.timelines = [];
    $scope.timelinesActive = [];
    $scope.limit = 10;

    /**
     * Clear all timelines
     */
    $scope.clear = function() {
        if (!confirm("Are you sure ?")) {
            return;
        }
        BG.com.rdHelper.Timeline.clear();
        BG.com.rdHelper.Timeline.store();
        $scope.timelines = [];
        $scope.timelinesActive = [];
    };

    /**
     * Update timelines
     */
    $scope.update = function() {
        BG.com.rdHelper.Timeline.all(timelinesLoaded);
    };

    /**
     * Stop tracking time for issue
     *
     * @param timeline
     */
    $scope.stopTrackingTime = function(timeline) {
        if (!timeline || !timeline.issueId) {
            return;
        }
        BG.com.rdHelper.Timeline.stopPoccess(timeline.issueId, function() {
            $scope.showSuccess("You stoped working on: "+timeline.issue.subject);
            $scope.update();
            if (!$scope.$$phase) {
                $scope.$digest();
            }
        });
    };

    /**
     * Clear timlines for issue
     *
     * @param issue
     */
    $scope.removeIssueTimeline = function(issue) {
        if (!confirm("Are you sure ?")) {
            return;
        }
        if (!issue || !issue.id) {
            return;
        }
        BG.com.rdHelper.Timeline.clearByIssueId(issue.id, function() {
            $scope.showSuccess("You cleared working logs for: "+issue.subject);
            $scope.update();
            if (!$scope.$$phase) {
                $scope.$digest();
            }
        });
    };
    
    BG.com.rdHelper.Timeline.all(timelinesLoaded);
    
    /**
     * Handle Timelines loaded
     * 
     * @param {Array} timelines
     */
    function timelinesLoaded(timelines) {
        $scope.timelines = [];
        $scope.timelinesActive = [];
        for(var i in timelines) {
            //issues
            var total = 0;
            if (timelines[i].length > 0) {
                var issue = BG.com.rdHelper.Issues.getById(i);
                for(var j = 0; j < timelines[i].length; j++) {
                    if (!timelines[i][j].end || !timelines[i][j].spent) {
                        timelines[i][j].issue = issue;
                        $scope.timelinesActive.push(timelines[i][j]);
                    } else {
                        total += timelines[i][j].spent;
                    }
                }
                //we shouldn't add timeline if total spent time = 0
                if (total == 0) {
                    continue;
                }
                if (issue) {
                    $scope.timelines.push({'issue': issue, 'total': total, 'times': timelines[i]});
                } else {
                    $scope.timelines.push({'issue': {}, 'total': total, 'times': timelines[i]});
                }
            }
        }
        if(!$scope.$$phase) {
            $scope.$digest();
        }
    }
}


//Options.$inject = ['$scope', '$timeout'];
//Home.$inject = ['$scope'];
//NewIssue.$inject = ['$scope'];
//Project.$inject = ['$scope', '$routeParams'];