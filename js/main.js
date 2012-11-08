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
    };
    // Register the 'myCurrentTime' directive factory method.
    // We inject no service since the factory method is DI.
}).directive('issueHistory', function() {
    // return the directive link function. (compile function not needed)
    return function(scope, element, attrs) {

        var updateText = function(item) {
            if (!item.name) {
                return;
            }
            switch (item.name) {
                case "status_id":
                    element.html("<strong>Status</strong> changed to: "+item.new_value);
                    break;
                case "assigned_to_id":
                    element.html("<strong>Assignee</strong> set to: "+item.new_value);
                    break;
                case "category_id":
                    element.html("<strong>Category</strong> set to: "+item.new_value);
                    break;
                case "done_ratio":
                    element.html("<strong>% Done</strong> changed from "+item.old_value+" to "+item.new_value);
                    break;
                case "estimated_hours":
                    element.html("<strong>Estimated time</strong> set to: "+item.new_value);
                    break;
            }
        };
        // watch the expression, and update the UI on change.
        scope.$watch(attrs.issueHistory, function(value) {
            console.log(value);
            updateText(value);
        });

        // listen on DOM destroy (removal) event, and cancel the next UI update
        // to prevent updating time ofter the DOM element was removed.
        element.bind('$destroy', function() {
//        $timeout.cancel(timeoutId);
        });
    };
  });
