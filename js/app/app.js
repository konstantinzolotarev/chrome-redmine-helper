'use strict';

/**
 * Create angular application
 */
angular.module('issues', ['ngRoute', 'ngSanitize', 'Issues.Service','pascalprecht.translate']).
    config([
    '$routeProvider',
    '$httpProvider',
    function($routeProvider, $httpProvider) {
        $routeProvider.
            when('/options', {templateUrl: 'partials/options.html', controller: Options}).
            when('/home', {templateUrl: 'partials/home.html', controller: Home}).
            when('/news', {templateUrl: 'partials/news.html', controller: News}).
            when('/projects', {templateUrl: 'partials/projects.html', controller: Projects}).
            when('/timelines', {templateUrl: 'partials/timelines.html', controller: Timelines}).
            when('/new_issue', {templateUrl: 'partials/newIssue.html', controller: NewIssue}).
            otherwise({redirectTo: '/home'});

        /**
         * Add interceptors for all http requests.
         */
        $httpProvider.interceptors.push([
            '$q',
            '$rootScope',
            function($q, $rootScope) {
                return {
                    'request': function(config) {
                        $rootScope.showLoading();
                        return config;
                    },

                    'requestError': function(rejection) {
                        $rootScope.hideLoading();
                        return rejection;
                    },

                    'response': function(response) {
                        $rootScope.hideLoading();
                        return response;
                    },

                    'responseError': function(rejection) {
                        $rootScope.hideLoading();
                        return rejection;
                    }
                };
        }]);
    }])
     .config(['$translateProvider', function($translateProvider) {
		
        var translationExist=function(lang_key){
		var result = null;
		angular.forEach(app_langs, function(lang, k){
		  if(window.navigator.language==lang.key || lang_key==lang.key){
			result={
			    key: lang.key,
			    locales: lang.locales
			};
			
		  }
		});		
		return result;	
	};
	var current_lang=translationExist();
	var en_lang=translationExist('en');

	if(current_lang){
		$translateProvider.translations(current_lang.key, current_lang.locales);
		$translateProvider.preferredLanguage(current_lang.key);

	}else{
		$translateProvider.translations(en_lang.key, en_lang.locales);
		$translateProvider.preferredLanguage(en_lang.key);
	}
	
	
     }])
    .filter('tohours', function() {
        return function(time) {
            var hours = time / (1000*60*60);
            if (hours < 1) {
                return Math.round(time / (1000*60))+" min.";
            }
            return (hours).toFixed(1) + " h.";
        };
    }).filter('nl2br', function() {
        return function(string,is_xhtml) {
            var is_xhtml = is_xhtml || true;
            var breakTag = (is_xhtml) ? '<br />' : '<br>';
            var text = (string + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1'+ breakTag +'$2');
            return text;
        };
    }).filter('comment', function() {
        //^>.*
        return function(string) {
            return string.replace(/\>(.*)\<br \/\>/g, '<blockquote class="comment">$1</blockquote>');
//        return string;
        };
    }).filter('pager', function() {
        return function(input, start) {
            start = +start; //parse to int
            return input.slice(start);
        };
    }).run([
        '$rootScope',
        '$timeout',

        function($scope, $timeout) {

            /**
             * List of loading processes
             * @type {Array}
             */
            $scope.loading = [];

            /**
             * Custom error message
             */
            $scope.customError = "";

            /**
             * Custom success message
             *
             * @type {string}
             */
            $scope.customSuccess = "";

            /**
             * Represent global error existance. Server unavailable or same
             *
             * @type {boolean}
             */
            $scope.xhrError = false;

            /**
             * Add new loading process to queue
             */
            $scope.showLoading = function(process) {
                $scope.loading.push(process || 'new loading process');
            };

            /**
             * Remove one loading process from queue
             */
            $scope.hideLoading = function() {
                if ($scope.loading.length == 0) {
                    return;
                }
                $scope.loading.pop();
            };

            /**
             * Remove all loading processes from queue
             */
            $scope.clearLoading = function() {
                //we couldn't make $scope.loading = [] because: angular will lost this variable in other scopes
                while($scope.loading.length > 0) {
                    $scope.hideLoading();
                }
            };

            /**
             * Check if loading dialog is shown
             *
             * @returns {boolean}
             */
            $scope.isLoading = function() {
                return $scope.loading.length > 0;
            };

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

            /**
             * Hide success message
             */
            $scope.hideSuccess = function() {
                $scope.customSuccess = "";
            };

            $scope.$watch('loading', function() {
                console.log($scope.loading);
            });
        }
    ]);

/**
 * Bind tooltips
 *
 * @param {jQuery} $
 */
jQuery(document).ready(function($) {
    $('.container').tooltip({
        selector: "i[data-type='tooltip']"
    });

    //Popover
    $('.container').popover({
        selector: ".help[data-type='popover']",
        trigger: "hover",
        placement: "top"
    });
});

/**
 * Open Issue Author's Redmine page
 *
 * @param {int} userId
 * @returns {undefined}
 */
function openAuthorPage(userId) {
    chrome.tabs.create({url: BG.getConfig().getHost()+"users/"+userId});
}
