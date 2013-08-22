'use strict';

/**
 * Options screen controller
 *
 * @param {Object} $scope
 * @param {Object} BG
 * @returns {void}
 */
function Options($scope, BG) {

    /**
     * Disable tabs navigation
     */
    $('#options_tabs').click(function (e) {
        e.preventDefault();
    });

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
Options.$inject = ['$scope', 'BG'];