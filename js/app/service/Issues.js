(function() {
    'use strict';

    angular.module('Chrome.Redmine.Service').factory('Issues', IssuesFactory);

    IssuesFactory.$inject = ['BG', '$q'];
    function IssuesFactory(BG, $q) {

        return {

            issues: []
        };
    };
})();