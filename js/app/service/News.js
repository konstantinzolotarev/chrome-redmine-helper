(function() {
    'use strict';

    angular.module('Chrome.Redmine.Service').factory('News', NewsService);

    NewsService.$inject = ['BG', '$q'];
    function NewsService(BG, $q) {

        return {
            load: function loadNews() {
                return $q(function(resolve, reject) {
                    BG.com.rdHelper.News.load(function(err, json) {
                        if (err) {
                            return reject([]);
                        }
                        if (json.total_count > 0) {
                            resolve(json.news);
                        } else {
                            resolve([]);
                        }
                    });
                });
            }
        };
    };
})();