/**
 * Projects actions 
 * 
 * @class
 * @returns {com.rdHelper.Projects}
 */
com.rdHelper.Projects = {
    loaded: false,
    projects: {}
};

/**
 * Store current projects in storage
 *
 * @param {function()=} callback
 * @returns {void}
 */
com.rdHelper.Projects.store = function(callback) {
    callback = callback || function() {};
    chrome.local.set({'projects': this.projects}, callback);
};

/**
 * Load projects from extension Memory
 *
 * @param {function()=} callback
 * @returns {void}
 */
com.rdHelper.Projects.load = function(callback) {
    callback = callback || function() {};
    (function(obj) {
        chrome.local.get('projects', function(item) {
            if (!item.projects) {
                callback({});
            }
            obj.projects = item.projects;
            obj.loaded = true;
            callback();
        });
    })(this);
    return;

};

/**
 * Clear stored data & update current projects
 *
 * @returns {void}
 */
com.rdHelper.Projects.clear = function() {
    this.projects = {};
    this.loaded = false;
};

/**
 * Get list of projects
 * 
 * @param {boolean} reload if set to true project list will be updated from server
 * @param {function(Object)=} callback
 * @returns {Array}
 */
com.rdHelper.Projects.all = function(reload, callback) {
    if (this.loaded && !reload) {
        callback(this.projects);
    }
    (function(obj) {
        obj.load(function() {
            //If we have no projects there loading from API
            if (obj.projects.length < 1 || reload) {
                return obj.loadFromRedmine(callback);
            }
            callback(obj.projects);
        });
        return;
    })(this);
};

/**
 * Load projects from Redmine API
 *
 * @param {number=} offset
 * @param {function()=} callback
 */
com.rdHelper.Projects.loadFromRedmine = function(offset, callback) {
    if (arguments.length < 2 && typeof offset == "function") {
        callback = offset;
        offset = 0;
    }
    callback = callback || function() {};
    //update process
    (function(obj) {
        offset = offset || "0";
        redmineApi.projects.all("offset="+offset, function(error, data) {
            if (error) {
                callback({});
                return;
            }
            if (data.total_count && data.total_count > 0) {
                for(var i = 0; i < data.projects.length; i++) {
                    obj.projects[data.projects[i].id] = data.projects[i];
                }
                obj.loaded = true;
                obj.store();
                if (data.total_count > (data.limit + data.offset)) {
                    obj.loadFromRedmine(data.limit + data.offset, callback);
                } else {
                    callback(obj.projects);
                    chrome.extension.sendMessage({action: "projectsLoaded", projects: obj.projects});
                }
            }
        });
        return;
    })(this);
};

/**
 * Get project detailed info 
 * 
 * @param {String} id
 * @param {boolean} reload
 * @returns {Object}
 */
com.rdHelper.Projects.get = function(id, reload) {
    return false;
    var p = this.getById(id);
    if (!p.project) {
        return false;
    }
    if (p.project.fullyLoaded && !reload) {
        //load members if they wa not loaded
        this.getMembers(id);
        return p.project;
    }
    (function(obj) {
        redmineApi.projects.get(id, function(error, data) {
            if (error) {
                return;
            }
            data.project.fullyLoaded = true;
            var key = p.key || false;
            if (key !== false) {
                obj.projects[key] = merge(obj.projects[key], data.project);
                obj.store();
                obj.sendProjectUpdated(id, obj.projects[key]);
            }
        });
    })(this);
    return p.project;
};

/**
 * Get list of project members
 * 
 * @param {int} projectId
 * @param {boolean} reload
 * @returns {Array}
 */
com.rdHelper.Projects.getMembers = function(projectId, reload) {
    var proj = this.getById(projectId);
    if (!proj || !proj.project) {
        return [];
    }
    if (!reload && proj.project.membersLoaded) {
        return proj.project.members;
    }
    (function(obj) {
        redmineApi.projects.memberships(projectId, function(error, json) {
            if (error) {
                if (error.request.status && error.request.status == 403) {
                    obj.projects[proj.key].membersLoaded = true;
                    obj.projects[proj.key].members = com.rdHelper.Users.users;
                    obj.store();
                    obj.sendProjectUpdated(projectId, obj.projects[proj.key]);
                }
                return;
            }
            if (json.total_count && json.total_count > 0 && json.memberships) {
                obj.projects[proj.key].members = [];
                for (var i in json.memberships) {
                    obj.projects[proj.key].members.push(json.memberships[i].user);
                }
                obj.projects[proj.key].membersLoaded = true;
                obj.store();
                obj.sendProjectUpdated(projectId, obj.projects[proj.key]);
            }
        });
    })(this);
};

/**
 * Get project from list by identifier
 * 
 * @param {String} ident
 * @returns {Object}
 */
com.rdHelper.Projects.getByIdentifier = function(ident) {
    for(var pid in this.projects) {
        if (this.projects[pid].identifier == ident) {
            return {'key': pid, 'project': this.projects[pid]};
        }
    }
    return false;
};

/**
 * Get project from list by id
 * 
 * @param {String} id
 * @returns {Object}
 */
com.rdHelper.Projects.getById = function(id) {
    var project = {
        'key': false,
        'project': false
    };
    for(var pid in this.projects) {
        if (this.projects[pid].id == id) {
            project = {'key': pid, 'project': this.projects[pid]};
        }
    }
    return project;
};

/**
 * Get project id from list by identifier
 * 
 * @param {String} ident
 * @returns {int}
 */
com.rdHelper.Projects.getProjectKey = function(ident) {
    for(var pid in this.projects) {
        if (this.projects[pid].identifier == ident) {
            return pid;
        }
    }
    return false;
};

/**
 * Send notification that project was updated
 * 
 * @param {String} id
 * @param {Object} project
 * @returns {void}
 */
com.rdHelper.Projects.sendProjectUpdated = function(id, project) {
    chrome.extension.sendMessage({"action": "projectUpdated", "project": project});
};

/**
 * Get list of issues for project
 * 
 * @param {String} id project identifier
 * @param {int} offset
 * @param {boolean} reload
 * @returns {Array}
 */
com.rdHelper.Projects.getIssues = function(id, offset, reload) {
    var proj = this.getById(id);
    if (!proj.key || !proj.project) {
        return [];
    }
    var key = parseInt(proj.key);
    if (this.projects[key].issuesLoaded && !reload) {
        return this.projects[key].issues;
    }
    if (reload || !this.projects[key].issues) {
        //clear issues
        this.projects[key].issues = [];
    }
    offset = offset || 0;
    var limit = 50;
    (function(obj, key, limit) {
        var filters = "sort=updated_on:desc&project_id="+id+"&limit="+limit+"&offset="+offset;
        redmineApi.issues.all(filters, function(error, json) {
            if (error) {
                return;
            }
            if (!json.issues || !json.total_count || json.total_count < 1) {
                return [];
            }
            for(var i in json.issues) {
                obj.projects[key].issues.push(json.issues[i]);    
            }
            obj.projects[key].issuesLoaded = true;
            obj.sendProjectUpdated(id, obj.projects[key]);
            obj.store();
            /**
             * Load rest of issues for selected project
             */
            if (json.total_count > (offset + limit)) {
                obj.getIssues(obj.projects[key].id, (offset + limit), false);
            }
        });
    })(this, key, limit);
    return [];
};