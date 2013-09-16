'use strict';

/**
 * List of your projects
 *
 * @param {Object} $scope
 * @param {Object} BG
 * @param {*} Projects
 * @returns {?}
 */
function Projects($scope, BG, Projects) {
    //list of projects
    $scope.projects = Projects;

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
Projects.$inject = ['$scope', 'BG', 'Projects'];