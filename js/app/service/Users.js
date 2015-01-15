(function() {
    'use strict';

    angular.module('Chrome.Redmine.Service').factory('Users', UsersService);

    UsersService.$inject = ['BG', '$q'];
    function UsersService(BG, $q) {

        return {
            /**
             * List of users available
             */
            users: [],

            add: function addNewUser() {}
        };
    };
})();