'use strict';

/**
 * Main screen controller
 *
 * @param {Scope} $scope
 * @param {Object} BG
 * @returns {undefined}
 */
function Home($scope, BG) {

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
        console.log($scope.issues);
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
        $('#issue-details-tabs').unbind().click(function (e) {
            e.preventDefault()
        });
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
        BG.com.rdHelper.Timeline.stopPoccess($scope.issue.id, $scope.issue.trackingComment, function() {
            $scope.issue.tracking = false;
            $scope.issue.trackingComment = "";
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

    //Handle creation of new issue
    var onIssueCreated = function(request, sender, sendResponse) {
        $scope.$apply(function(sc) {
            sc.reload();
        });
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
            case "issueCreated":
                return onIssueCreated(request, sender, sendResponse);
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
Home.$inject = ['$scope', 'BG'];