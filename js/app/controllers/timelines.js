'use strict';

/**
 * Timelines controller
 *
 * @param {Object} $scope
 * @param {Object} BG
 * @returns {?}
 */
function Timelines($scope, BG) {
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
        //hide comment
        $scope.toggleTimeComment = false;
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
Timelines.$inject = ['$scope', 'BG'];