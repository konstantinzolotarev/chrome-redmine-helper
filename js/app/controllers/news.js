'use strict';

/**
 * News screen controller
 *
 * @param {Object} $scope
 */
function News($scope) {
    $scope.news = [];

    $scope.newsLoaded = function(json) {
        $scope.$apply(function(sc) {
            if (json.total_count > 0) {
                sc.news = json.news;
            }
            sc.hideLoading();
        });
    };

    $scope.newsError = function(e, resp) {
        $scope.$apply(function(sc) {
            sc.hideLoading();
        });
    };

    $scope.loadNews = function() {
        $scope.news = [];
        $scope.showLoading();
        BG.com.rdHelper.News.load($scope.newsLoaded, $scope.newsError);
    };

    if ($scope.news.length < 1) {
        $scope.loadNews();
    }
}
News.$inject = ['$scope'];

