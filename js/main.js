var BG = chrome.extension.getBackgroundPage();

/**
 * Link handler for editable field
 * 
 * @param {Object} scope
 * @param {Object} element
 * @param {Object} attrs
 * @returns {undefined}
 */
var linkFunction = function(scope, element, attrs) {
    var defaultValue;
    scope.visible = false;
    scope.editing = false;
    /**
     * On mouse enter
     */
    scope.mouseEnter = function() {
        if (!scope.editing) {
            scope.visible = true;
        }
    };
    
    /**
     * On mouse leave
     */
    scope.mouseLeave = function() {
        if (!scope.editing) {
            scope.visible = false;
        }
    };
    
    /**
     * Open edit
     */
    scope.edit = function() {
        scope.editing = true;
        scope.visible = false;
        defaultValue = scope.value;
    };
    
    /**
     * Close edit without saving
     */
    scope.cancel = function() {
        scope.value = defaultValue;
        attrs.$set('editableValue', defaultValue);
        scope.editing = false;
    };
};

/**
 * Create angular application
 */
angular.module('issues', ['ngSanitize']).
    config(['$routeProvider', function($routeProvider) {
    $routeProvider.
            when('/options', {templateUrl: 'partials/options.html', controller: Options}).
            when('/home', {templateUrl: 'partials/home.html', controller: Home}).
            when('/news', {templateUrl: 'partials/news.html', controller: News}).
            when('/new_issue', {templateUrl: 'partials/newIssue.html', controller: NewIssue}).
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
    return {
        replace: true,
        transclude: false,
        scope: {
            issue: "=issue",
            project: "=project",
            item: "=issueHistory"
        },
        link: function(scope, element, attrs) {

            /**
             * 
             * @param {int} id
             * @returns {String}
             */
            var getTracker = function(id) {
                if (!scope.project || !scope.project.fullyLoaded || !scope.project.trackers) {
                    return id;
                }
                for (var key in scope.project.trackers) {
                    if (scope.project.trackers[key].id == id) {
                        return scope.project.trackers[key].name;
                    }
                }
                return id;
            };

            var getAttachmentUrl = function() {
                if (!scope.issue.attachments || !angular.isArray(scope.issue.attachments) || scope.issue.attachments.length < 1) {
                    return scope.item.new_value;
                }
                for (var i in scope.issue.attachments) {
                    if (scope.issue.attachments[i].id == scope.item.name) {
                        return '<a href="'+scope.issue.attachments[i].content_url+'" target="_blank">'+scope.item.new_value+'</a>';
                    }
                }
                return scope.item.new_value;
            };

            if (!scope.item.name) {
                return;
            }
            if (scope.item.property == "attr") {
                switch (scope.item.name) {
                    case "status_id":
                        element.html("<strong>Status</strong> changed from "
                                + "<i>" + BG.getIssues().getStatusNameById(scope.item.old_value) + "</i> to "
                                + "<i>" + BG.getIssues().getStatusNameById(scope.item.new_value) + "</i>");
                        break;
                    case "assigned_to_id":
                        element.html("<strong>Assignee</strong> set to: "+BG.getUsers().getNameById(scope.scope.item.new_value));
                        break;
                    case "category_id":
                        element.html("<strong>Category</strong> set to: "+scope.item.new_value);
                        break;
                    case "done_ratio":
                        element.html("<strong>% Done</strong> changed from "+scope.item.old_value+" to "+scope.item.new_value);
                        break;
                    case "estimated_hours":
                        element.html("<strong>Estimated time</strong> set to: "+scope.item.new_value);
                        break;
                    case "tracker_id":
                        element.html("<strong>Tracker</strong> changed from "
                                        + "<i>"+getTracker(scope.item.old_value)+"</i> to "
                                        + "<i>"+getTracker(scope.item.new_value)+"</i>");
                        break;
                    case "subject": 
                        element.html("<strong>Subject</strong> changed from "
                                        + "<i><u>"+scope.item.old_value+"</u></i> to "
                                        + "<i><u>"+scope.item.new_value+"</u></i>");
                        break;
                    default:
                        element.html("<strong>Sorry</strong> this is under developent.");
                        break;
                }
            } else if (scope.item.property == "attachment") {
                element.html("<strong>Attachment</strong> added "
                                        + "<i>"+getAttachmentUrl()+"</i>");
            }
        }
    };
}).directive('editableList', function factory() {
    return {
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
        link: linkFunction
    };
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
        link: linkFunction
    };
}).directive('editableInput', function factory() {
    return {
        replace: true,
        transclude: true,
        template: '<span data-ng-mouseenter="mouseEnter()" data-ng-mouseleave="mouseLeave()">'
                        +'<span data-ng-hide="editing">'
                            +'<span data-ng-transclude class="pointer"></span>'
                            +'&nbsp;<i class="icon-pencil pointer" data-ng-show="visible" data-ng-click="edit()"></i>'
                        +'</span>'
                        +'<span data-ng-show="editing">'
                                +'<input type="text" class="input-small" data-ng-model="value"/>'
                                +'&nbsp;&nbsp;<i class="icon-ok pointer" data-ng-click="editing=false; onOk(value)"></i>'
                                +'<i class="icon-remove pointer" data-ng-click="cancel()"></i>'
                        +'</span>'
                    +'</span>',
        scope: {
            value: "=editableValue",
            onOk: "=onOk"
        },
        // The linking function will add behavior to the template
        link: linkFunction
    };
}).directive('uploadFile', function() {
    return {
        replace: true,
        transclude: true,
        restrict: "EA",
        template: '<div class="add-attach">'
                            + '<div class="center">'
                                + '<i>'
                                    + '<a href="" data-ng-model="attachOpen" data-ng-click="attachOpen = !attachOpen">'
                                        + '<i class="icon-file"></i>&nbsp;Attach new file'
                                    + '</a>'
                                + '</i>'
                            + '</div>'
                            + '<div class="well well-small" data-ng-show="attachOpen">'
                                + '<div class="alert alert-info" data-ng-show="loading">'
                                    + '<strong>Uploading!</strong> Your file is uploading to server...'
                                + '</div>'
                                + '<div class="alert alert-error" data-ng-show="error">'
                                    + '<button type="button" class="close" data-dismiss="alert">×</button>'
                                    + '<strong>Warning!</strong> File couldn\'t be uploaded !'
                                + '</div>'
                                + '<input type="file" id="addAttach" data-ng-hide="loading"/>'
                                + '<p>'
                                    + '<small>'
                                        + 'File will be uploaded automaticaly after selection'
                                    + '</small>'
                                + '</p>'
                            + '</div>'
                        + '</div>',
        scope: {
            // uploadFile: "=onOk"
        },
        // The linking function will add behavior to the template
        link: function(scope, element, attrs) {
            scope.file = null;
            scope.files = [];
            scope.error = false;
            //Open flag for
            scope.attachOpen = false;
            scope.loading = false;
            
            //Handle new file selection
            var onFileChange = function() {
                if (this.files.length < 1) {
                    return;
                }
                var file = this.files[0];
                scope.$apply(function(sc) {
                    sc.uploadFile(file);
                });
                this.value = "";
            };
            
            /**
             * Upload file to Redmine server
             */
            scope.uploadFile = function(file) {
                scope.loading = true;
                BG.getLoader().upload("uploads.json", file, function(resp) {
                    if (!resp.response || resp.response == "") {
                        return;
                    }
                    var json = JSON.parse(resp.response);
                    scope.$apply(function(sc) {
                        sc.error = false;
                        sc.loading = false;
                        //Notify listeners that file is uploaded
                        chrome.extension.sendMessage({"action": "fileUploaded", 'token': json.upload.token, 'file': file});
                    });
                }, function(e, resp) {
                    scope.$apply(function(sc) {
                        sc.error = true;
                        sc.loading = false;
                    });
                });
            };

            //Add listener for file upload
            document.getElementById('addAttach').addEventListener('change', onFileChange);
        }
    };
});
