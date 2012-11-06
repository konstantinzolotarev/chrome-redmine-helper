/**
 * Create angular application
 */
angular.module('issues', ['ngSanitize']).
    config(['$routeProvider', function($routeProvider) {
    $routeProvider.
            when('/options', {templateUrl: 'partials/options.html', controller: Options}).
            when('/home', {templateUrl: 'partials/home.html', controller: Home}).
            when('/project/:id', {templateUrl: 'partials/project.html', controller: Project}).
            otherwise({redirectTo: '/home'});
}])
.filter('nl2br', function() {
	return function(string,is_xhtml) { 
	    var is_xhtml = is_xhtml || true;
	    var breakTag = (is_xhtml) ? '<br />' : '<br>';    
	    var text = (string + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1'+ breakTag +'$2');
	    return text;
	};
}).filter('pager', function() {
    return function(input, start) {
        start = +start; //parse to int
        return input.slice(start);
    }
});;
