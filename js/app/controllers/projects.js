'use strict';

/**
 * List of your projects
 *
 * @param {Object} $scope
 * @param {Object} BG
 * @returns {?}
 */
function Projects($scope, BG) {
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
Projects.$inject = ['$scope', 'BG'];