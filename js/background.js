var pollIntervalMin = 5;  // 5 minutes
var pollIntervalMax = 60;  // 1 hour
var requestFailureCount = 0;  // used for exponential backoff

/**
 * 
 * @class Config
 * @returns {Config}
 */
function Config() {
    this.profile = {
        host: "",
        apiAccessKey: "",
        useHttpAuth: false,
        httpUser: "",
        httpPass: "",
        selectedProject: false,
        currentUserName: false,
        currentUserId: false
    };
    this.loaded = false;
}

/**
 * Check if config is empty
 * 
 * @returns {boolean}
 */
Config.prototype.isEmpty = function() {
    return (this.profile.host == "" && this.profile.apiAccessKey == "");
};

/**
 * Create new exmpty config in localstorage
 * 
 * @returns {void}
 */
Config.prototype.initNew = function() {
    console.log("Create new empty profile");
    this.store(this.profile);
};

/**
 * Check if configs are already loaded
 * 
 * @return {boolean}
 */
Config.prototype.isLoaded = function() {
    return this.loaded;
};

/**
 * Load config from locaStorage
 */
Config.prototype.load = function() {
    if (this.isLoaded()) {
        return;
    }
    var profile = localStorage.profile || false;
    if (!profile) {
        this.initNew();
        this.loaded = true;
        return;
    }
    this.profile = JSON.parse(profile);
    this.loaded = true;
    return;
};

/**
 * Store given profile into localStorage
 * 
 * @param {Object} profile
 * @returns {void}
 */
Config.prototype.store = function(profile) {
    if (profile.host.lastIndexOf("/") != (profile.host.length - 1)) {
        profile.host += "/";
    }
    localStorage['profile'] = JSON.stringify(profile);
};

/**
 * Get host for Redmine
 * 
 * @returns {String} Host
 */
Config.prototype.getHost = function() {
    return this.profile.host;
};

/**
 * Get user apiAccessKey
 * 
 * @returns {String} apiAccessKey
 */
Config.prototype.getApiAccessKey = function() {
    return this.profile.apiAccessKey;
};

/**
 * Get profile
 * 
 * @returns {Object}
 */
Config.prototype.getProfile = function() {
    this.load();
    return this.profile;
};

/**
 * 
 * @param {string} id
 * @returns {void}
 */
Config.prototype.setSelectedProject = function(id) {
    if (projects.getByIdentifier(id) !== false) {
        this.profile.selectedProject = id;
        this.store(this.profile);
    }
};

/**
 * 
 * @class
 * @returns {Loader}
 */
function Loader() {
    this.loaded = false;
    this.projects = [];
}

/**
 * Create new XMLHttpRequest Object
 * 
 * @param {String} method
 * @param {String} url
 * @param {boolean} async
 */
Loader.prototype.createXhr = function(method, url, async) {
    var xhr = new XMLHttpRequest();
    var fullUrl = getConfig().getHost() + url;
    if (config.getProfile().useHttpAuth) {
        xhr.open(method, fullUrl, (async || true), config.getProfile().httpUser, config.getProfile().httpPass);
    } else {
        xhr.open(method, fullUrl, (async || true));
    }
    xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    xhr.setRequestHeader("X-Redmine-API-Key", getConfig().getApiAccessKey());
    return xhr;
};

/**
 * Send GET request to URL
 * 
 * @param {string} url
 * @param {Function} success
 * @returns {void}
 */
Loader.prototype.get = function(url, success) {
    var xhr = this.createXhr("GET", url);
    //Check input date
    success = success || function(data) {};
//    error = error || function(e, xhr) {};
    //success handler
    xhr.onload = function(e) {
        if (this.status == 200) {
            var data = JSON.parse(this.response);
            success(data);
        } else {
            requestError(e);//, error);
        }
    };
    //error handler
    xhr.onerror = requestError;
    xhr.send();
};

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
    //Try loading from memory
    this.loadFromMemory();
    //If we have no projects there loading from API
    if (this.projects.length < 1 || reload) {
        this.loadFromRedmine();
    }
    return this.projects;
};

/**
 * Get project detailed info 
 * 
 * @param {String} id
 * @returns {Object}
 */
Projects.prototype.get = function(id) {
    var project = this.getByIdentifier(id);
    if (project.fullyLoaded) {
        return project;
    }
    (function(obj) {
        getLoader().get("projects/"+id+".json?include=trackers,issue_categories", function(data) {
            data.project.fullyLoaded = true;
            var key = obj.getProjectKey(id);
            if (key !== false) {
                obj.projects[key] = merge(obj.projects[key], data.project);
                obj.store();
                obj.sendProjectUpdated(id, obj.projects[key]);
            }
        });
    })(this);
    return project;
};

/**
 * Get project from list by identifier
 * 
 * @param {String} ident
 * @returns {Object}
 */
Projects.prototype.getByIdentifier = function(ident) {
    for(var pid in this.projects) {
        if (this.projects[pid].identifier == ident) {
            return this.projects[pid];
        }
    }
    return false;
};

/**
 * Get project id from list by identifier
 * 
 * @param {String} ident
 * @returns {int}
 */
Projects.prototype.getProjectKey = function(ident) {
    for(var pid in this.projects) {
        if (this.projects[pid].identifier == ident) {
            return pid;
        }
    }
    return false;
};

/**
 * Load projects from Redmine API
 * 
 * @returns {void}
 */
Projects.prototype.loadFromRedmine = function() {
    //update process
    this.projects = [];
    (function(obj) {
        getLoader().get("projects.json", function(data) {
            if (data.total_count && data.total_count > 0) {
                obj.projects = data.projects;
                obj.loaded = true;
                obj.store();
                chrome.extension.sendMessage({action: "projectsLoaded", projects: obj.projects});
            }
        });
    })(this);
};

/**
 * Store current projects 
 * 
 * @returns {void}
 */
Projects.prototype.store = function() {
    if (!this.loaded) {
        return;
    }
    console.log(this.projects);
    localStorage['projects'] = JSON.stringify(this.projects);
};

/**
 * Load projects from extension Memory
 * 
 * @returns {void}
 */
Projects.prototype.loadFromMemory = function() {
    if (this.loaded) {
        return;
    }
    this.projects = JSON.parse(localStorage.projects || "[]");
    this.loaded = true;
};

/**
 * Clear stored data & update current projects
 * 
 * @returns {void}
 */
Projects.prototype.clear = function() {
    localStorage.removeItem("projects");
    this.projects = [];
    this.loaded = false;
};

/**
 * Send notification that project was updated
 * 
 * @param {String} id
 * @param {Object} project
 * @returns {void}
 */
Projects.prototype.sendProjectUpdated = function(id, project) {
    chrome.extension.sendMessage({"action": "projectUpdated", "id": id, "project": project});
};

/**
 * Get list of issues for project
 * 
 * @param {String} id project identifier
 * @returns {Array}
 */
Projects.prototype.getIssues = function(id) {
    var key = this.getProjectKey(id);
    if (this.projects[key].issuesLoaded) {
        return this.projects[key].issues;
    }
    (function(obj) {
        getLoader().get("issues.json?sort=updated_on:desc", function(data) {
            console.log(data);
        });
    })(this);
    return [];
};

/**
 * 
 * @class
 * @returns {Issues}
 */
function Issues() {
    this.lastUpdated = localStorage.lastUpdated || false;
    this.issues = JSON.parse(localStorage.issues || "[]");;
    this.unread = localStorage.unread || 0;
    this.updateBrowserAction();
}

/**
 * Set unread issues count to icon
 * 
 * @returns {void}
 */
Issues.prototype.updateBrowserAction = function() {
    setUnreadIssuesCount(this.unread);
};

/**
 * Load issues list 
 * 
 * @returns {void}
 */
Issues.prototype.load = function() {
    console.log("Start loading issues");
    (function(obj) {
        getLoader().get("issues.json?sort=updated_on:desc&assigned_to_id="+getConfig().getProfile().currentUserId+"&limit=50", 
            function(data) {
                console.log(data);
                if (data.total_count && data.total_count > 0) {
                    obj.issues = data.issues;
                    if (!obj.lastUpdated) {
                        obj.unread = data.total_count;
                    } else {
                        for(var i in data.issues) {
                            var found = false;
                            for(var key in obj.issues) {
                                //We found this issue
                                if (obj.issues[key].id == data.issues[i].id) {
                                    found = true;
                                    if (new Date(obj.issues[key].updated_on) < new Date(data.issues[i].updated_on)) {
                                        data.issues[i].read = false;
                                        obj.unread += 1;
                                        obj.issues[key] = data.issues[i];
                                    }
                                }
                            }
                            if (!found) {
                                data.issues[i].read = false;
                                obj.issues.push(data.issues[i]);
                            }
                        }
                    }
                    obj.lastUpdated = (new Date()).toISOString();
                    setUnreadIssuesCount(obj.unread);
                    obj.store();
                    /**
                     * Notify
                     */
                    chrome.extension.sendMessage({"action": "issuesUpdated"});
                }
            }
        );
    })(this);
};

/**
 * Get issue by it's ID 
 * 
 * @param {int} id
 * @returns {Boolean}
 */
Issues.prototype.getById = function(id) {
    if (this.issues.length < 1) {
        return false;
    }
    for(var i in this.issues) {
        if (this.issues[i].id == id) {
            return {'intertalId': i, 'issue': this.issues[i]};
        }
    }
    return false;
};

/**
 * Store data into localStorage
 * 
 * @returns {void}
 */
Issues.prototype.store = function() {
    localStorage['issues'] = JSON.stringify(this.issues);
    localStorage['lastUpdated'] = this.lastUpdated;
    localStorage['unread'] = this.unread;
};

/**
 * Init global variables
 */
var config = new Config();
var loader = new Loader();
var projects = new Projects();
var issues = new Issues();

/**
 * Overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
 * @param obj1
 * @param obj2
 * @returns obj3 a new object based on obj1 and obj2
 */
function merge(obj1,obj2){
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

/**
 * 
 * @param {ProgressEvent} e
 * @returns {void}
 */
function requestError(e) {
    chrome.extension.sendMessage({action: "xhrError", params: {"e": e}});
}

/**
 * Trim string 
 * @param {Strin} string
 */
function trim(string) {
    return string.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

/**
 * Get Config 
 * 
 * @returns {Config}
 */
function getConfig() {
    config.load();
    return config;
}

/**
 * Get Loader
 * 
 * @returns {Loader}
 */
function getLoader() {
    return loader;
}

/**
 * 
 * @returns {Projects}
 */
function getProjects() {
    return projects;
}

/**
 * Get Issues
 * 
 * @returns {Issues}
 */
function getIssues() {
    return issues;
}

/**
 * Set amount of unread issues
 * 
 * @param {int} count
 * @returns {void}
 */
function setUnreadIssuesCount(count) {
    if (count > 99) {
        count = "99+";
    }
    chrome.browserAction.setBadgeText({text: ""+count});
}

/**
 * Remove all stored Redmine items from memory
 * 
 * @returns {void}
 */
function clearItems() {
    projects.clear();
    if (!config.isEmpty()) {
        startRequest({scheduleRequest:true});
    }
}

/**
 * Check if given URL is from Extension Main page
 * 
 * @param {String} url
 * @returns {Boolean}
 */
function isMainUrl(url) {
    var mainUrl = getMainUrl(true);
    if (url.indexOf(mainUrl) === 0) {
        return true;
    }
    return false;
}

/**
 * Get Extension Main page URL.
 * 
 * If absolute set to true function will return absolute URL :<br/> 
 * chrome-extension://extension-id/html/main.html 
 * 
 * @param {boolean} absolute
 * @returns {String}
 */
function getMainUrl(absolute) {
    if (!absolute) {
        return "html/main.html";
    } else {
        return chrome.extension.getURL("/html/main.html");
    }
}

/**
 * Will open new Extension Main page or set selected page that already open
 * 
 * @returns {void}
 */
function openMainPage() {
    chrome.tabs.getAllInWindow(undefined, function(tabs) {
        for (var i = 0, tab; tab = tabs[i]; i++) {
            if (tab.url && isMainUrl(tab.url)) {
                chrome.tabs.update(tab.id, {selected: true});
                return;
            }
        }
        chrome.tabs.create({url: getMainUrl()});
    });
}

/**
 * Shedule next request to Redmine
 */
function scheduleRequest() {
    var randomness = Math.random() * 2;
    var exponent = Math.pow(2, requestFailureCount);
    var multiplier = Math.max(randomness * exponent, 1);
    var delay = Math.min(multiplier * pollIntervalMin, pollIntervalMax);

    console.log("Scheduled: "+delay);
    chrome.alarms.create({'delayInMinutes': delay});
}

/**
 * 
 * @param {type} onSuccess
 * @returns {void}
 */
function getCurrentUser(onSuccess) {
    getLoader().get("users/current.json",
        function(json) {
            if (json.user) {
                getConfig().getProfile().currentUserName = json.user.firstname + ' ' + json.user.lastname;
                getConfig().getProfile().currentUserId = json.user.id;
                getConfig().store(getConfig().getProfile());
                onSuccess();
            }
        }
    );
}

/**
 * Start requesting of issues
 * 
 * @param {Object} params
 * @returns {void}
 */
function startRequest(params) {
    if (params.scheduleRequest) {
        scheduleRequest();
    }
    if (getConfig().getHost() != "") {
        //check user
        if (!getConfig().getProfile().currentUserId || !getConfig().getProfile().currentUserName) {
            getCurrentUser(function() {
                startRequest({scheduleRequest: false});
            });
        } else {
            getIssues().load();
        }
    } else {
        chrome.browserAction.setBadgeText({text: "Err"});
    }
}

/**
 * Bind actions on extension is installed
 */
chrome.runtime.onInstalled.addListener(function() {
    console.log("Installed");
    startRequest({scheduleRequest:true});
});

chrome.runtime.onSuspend.addListener(function() {
    console.log("Suspended");
});

/**
 * Run actions on timer
 */
chrome.alarms.onAlarm.addListener(function() {
    startRequest({scheduleRequest:true});
});

/**
 * Bind click action to icon
 */
chrome.browserAction.onClicked.addListener(openMainPage);