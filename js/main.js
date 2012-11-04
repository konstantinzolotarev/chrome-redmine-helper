/**
 * Create angular application
 */
angular.module('issues', []).
    config(['$routeProvider', function($routeProvider) {
    $routeProvider.
            when('/options', {templateUrl: 'partials/options.html', controller: Options}).
            when('/home', {templateUrl: 'partials/home.html', controller: Home}).
            when('/project/:id', {templateUrl: 'partials/project.html', controller: Project}).
            when('/issues', {templateUrl: 'partials/issues.html', controller: Issues}).
            otherwise({redirectTo: '/home'});
}]);
