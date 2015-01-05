(function() {
    'use strict';

    angular.module('Chrome.Redmine').controller('News', News);
    
    News.$inject = ['$scope', 'BG'];

    /**
     * News screen controller
     *
     * @param {Object} $scope
     * @param {BG} BG
     */
    function News($scope, BG) {
        $scope.news = [];

        $scope.newsLoaded = function (json) {
            $scope.$apply(function (sc) {
                if (json.total_count > 0) {
                    sc.news = json.news;
                }
                sc.hideLoading();
            });
        };

        $scope.newsError = function (e, resp) {
            $scope.$apply(function (sc) {
                sc.hideLoading();
            });
        };

        $scope.loadNews = function () {
            $scope.news = [];
            $scope.showLoading();
            BG.com.rdHelper.News.load($scope.newsLoaded, $scope.newsError);
        };

        if ($scope.news.length < 1) {
            $scope.loadNews();
        }
    }
})();
