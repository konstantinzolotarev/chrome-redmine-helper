(function() {
    'use strict';

    angular.module('Chrome.Redmine').controller('Projects', Projects);

    Projects.$inject = ['$scope', 'BG', 'Projects'];
    /**
     * List of your projects
     *
     * @param {Object} $scope
     * @param {Object} BG
     * @param {*} Projects
     * @returns {?}
     */
    function Projects($scope, BG, Projects) {

        $scope.projectsService = Projects;

        //Run loading of projects
        Projects.all(false);

        /**
         * Will reload list of projects
         */
        $scope.reload = function() {
            $scope.showLoading();
            Projects.reload(true).then(function() {
                $scope.hideLoading();
            });
        };
    }
})();