(function() {
    'use strict';

    angular.module('Chrome.Redmine').controller('News', News);
    
    News.$inject = ['$scope', 'News'];

    /**
     * News screen controller
     *
     * @param {Object} $scope
     * @param {NewsService} News
     */
    function News($scope, News) {
        $scope.news = [];

        $scope.loadNews = function () {
            $scope.news = [];
            $scope.showLoading();
            News.load().then(function(news) {
                $scope.news = news;
                $scope.hideLoading();
            });
        };

        if ($scope.news.length < 1) {
            $scope.loadNews();
        }
    }
})();
