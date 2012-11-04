/**
 * Projects actions 
 * 
 * @class
 * @returns {Projects}
 */
function Projects() {
    this.loaded = false;
    this.projects = [];
}

/**
 * Get list of projects
 * 
 * @param {boolean} reload if set to true list will be updated from server
 * @returns {Array}
 */
Projects.prototype.all = function(reload) {
    if (this.loaded && !reload) {
        return this.projects;
    }
    //update process
    this.projects = [];
    (function(obj) {
        getLoader().get(getConfig().getHost() + "projects.json", function(data) {
            if (data.total_count && data.total_count > 0) {
                obj.projects = data.projects;
                obj.loaded = true;
                chrome.extension.sendMessage({action: "projectsLoaded", projects: obj.projects});
            }
        });
    })(this);
    return this.projects;
};