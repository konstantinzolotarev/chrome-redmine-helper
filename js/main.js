var BG = chrome.extension.getBackgroundPage();

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
        var item, project;
        
        /**
         * 
         * @param {int} id
         * @returns {String}
         */
        var getTracker = function(id) {
            if (!project || !project.fullyLoaded || !project.trackers) {
                return id;
            }
            for (var key in project.trackers) {
                if (project.trackers[key].id == id) {
                    return project.trackers[key].name;
                }
            }
            return id;
        };
    
        var updateText = function() {
            if (!item.name) {
                return;
            }
            switch (item.name) {
                case "status_id":
                    element.html("<strong>Status</strong> changed from "
                            + "<i>" + BG.getIssues().getStatusNameById(item.old_value) + "</i> to "
                            + "<i>" + BG.getIssues().getStatusNameById(item.new_value) + "</i>");
                    break;
                case "assigned_to_id":
                    element.html("<strong>Assignee</strong> set to: "+BG.getUsers().getNameById(item.new_value));
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
                case "tracker_id":
                    element.html("<strong>Tracker</strong> changed from "
                                    + "<i>"+getTracker(item.old_value)+"</i> to "
                                    + "<i>"+getTracker(item.new_value)+"</i>");
                    break;
                default:
                    element.html("<strong>Sorry</strong> this is under developent.");
                    console.log(item);
                    break;
            }
        };
        // watch the expression, and update the UI on change.
        scope.$watch(attrs.issueHistory, function(value) {
            item = value;
            updateText();
        });
        
        // watch the expression, and update the UI on change.
        scope.$watch(attrs.project, function(value) {
            project = value;
            updateText();
        });

        // listen on DOM destroy (removal) event, and cancel the next UI update
        // to prevent updating time ofter the DOM element was removed.
        element.bind('$destroy', function() {
//        $timeout.cancel(timeoutId);
        });
    };
}).directive('editableList', function factory() {
    var directiveDefinitionObject = {
        replace: true,
        transclude: true,
        template: '<span data-ng-mouseenter="mouseEnter()" data-ng-mouseleave="mouseLeave()">'
                        +'<span data-ng-hide="editing">'
                            +'<span data-ng-transclude class="pointer"></span>'
                            +'&nbsp;<i class="icon-pencil pointer" data-ng-show="visible" data-ng-click="edit()"></i>'
                        +'</span>'
                        +'<span data-ng-show="editing">'
                                +'<select class="input-small" data-ng-model="value">'
                                    +'<option data-ng-repeat="item in list" value="{{item.id}}">{{item.name}}</option>'
                                +'</select>'
                                +'&nbsp;&nbsp;<i class="icon-ok pointer" data-ng-click="editing=false; onOk(value)"></i>'
                                +'<i class="icon-remove pointer" data-ng-click="cancel()"></i>'
                        +'</span>'
                    +'</span>',
        scope: {
            value: "=editableValue",
            list: "=editableSelect",
            onOk: "=onOk"
        },
        // The linking function will add behavior to the template
        link: function(scope, element, attrs) {
            scope.visible = false;
            scope.editing = false;
            
            scope.mouseEnter = function() {
                if (!scope.editing) {
                    scope.visible = true;
                }
            };
        
            scope.mouseLeave = function() {
                if (!scope.editing) {
                    scope.visible = false;
                }
            };
        
            scope.edit = function() {
                scope.editing = true;
                scope.visible = false;
            };
        
            scope.cancel = function() {
                scope.editing = false;
            };
        }
    };
    
    return directiveDefinitionObject;
}).directive('progress', function factory() {
    return {
        replace: true,
        transclude: true,
        template: '<span data-ng-mouseenter="mouseEnter()" data-ng-mouseleave="mouseLeave()">'
                        +'<span data-ng-hide="editing">'
                            +'<span data-ng-transclude class="pointer"></span>'
                            +'&nbsp;<i class="icon-pencil pointer" data-ng-show="visible" data-ng-click="edit()"></i>'
                        +'</span>'
                        +'<span data-ng-show="editing">'
                            +'<input type="range" min="0" max="100" class="input-small" data-ng-model="value">'
                            +'&nbsp;{{value}}%&nbsp;'
                            +'&nbsp;&nbsp;<i class="icon-ok pointer" data-ng-click="editing=false; onOk(value)"></i>'
                            +'<i class="icon-remove pointer" data-ng-click="cancel()"></i>'
                        +'</span>'
                    +'</span>',
        scope: {
            value: "=editableValue",
            onOk: "=onOk"
        },
        // The linking function will add behavior to the template
        link: function(scope, element, attrs) {
            var defaultValue;
            scope.visible = false;
            scope.editing = false;
            
            scope.mouseEnter = function() {
                if (!scope.editing) {
                    scope.visible = true;
                }
            };
        
            scope.mouseLeave = function() {
                if (!scope.editing) {
                    scope.visible = false;
                }
            };
        
            scope.edit = function() {
                scope.editing = true;
                scope.visible = false;
                defaultValue = scope.value;
            };
        
            scope.cancel = function() {
                scope.value = defaultValue;
                attrs.$set('editableValue', defaultValue);
                scope.editing = false;
            };
        }
    };
});
