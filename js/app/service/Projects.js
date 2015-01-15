(function() {
    'use strict';

    angular.module('Chrome.Redmine.Service')
        .factory('Projects', ['BG', '$q', function (BG, $q) {
            return {

                /**
                 * List of all projects
                 */
                projects: [],

                /**
                 * Get all projects list
                 *
                 * @param {boolean} reload - Should we reload list of projects or not.
                 * @returns {Promise}
                 */
                all: function all(reload) {
                    var self = this;
                    if (!_.isBoolean(reload)) {
                        reload = false;
                    }
                    return $q(function(resolve, reject) {
                        BG.com.rdHelper.Projects.all(reload, function (err, projects) {
                            if (err) {
                                return reject([]);
                            }
                            resolve(projects);
                        });
                    }).then(function(res) {
                        self.projects = res;
                        return res;
                    });
                },

                /**
                 * Will reload list of projects in extension
                 *
                 * @param {boolean} clear - Should we clear existing projects before load new
                 * @returns {Promise}
                 */
                reload: function(clear) {
                    if (clear) {
                        BG.com.rdHelper.Projects.clear();
                    }
                    return this.all(true);
                }
            };
        }]);
})();