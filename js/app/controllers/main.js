'use strict';

/**
 * Main controller
 *
 * @param {Object} $scope
 * @param {Object} $location
 * @param {Object} $timeout
 * @param {*} BG
 * @returns {void}
 */
function Main($scope, $location, $timeout, BG) {
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
Main.$inject = ['$scope', '$location', '$timeout', 'BG'];