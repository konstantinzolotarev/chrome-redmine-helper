var pollIntervalMin = 5;  // 5 minutes

/**
 * Init global variables
 */
var config = new Config(),
loader = new Loader(),
projects = new Projects(),
issues = new Issues();
/**
 * 
 * @type Users
 */
var users;

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
    chrome.browserAction.setBadgeText({text: "Err"});
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
 * Get Users
 * 
 * @returns {Users}
 */
function getUsers() {
    if (!users) {
        users = new Users();
    }
    return users;
}

/**
 * Set amount of unread issues
 * 
 * @param {int} count
 * @returns {void}
 */
function setUnreadIssuesCount(count) {
    //clear text
    if (count <= 0) {
        chrome.browserAction.setBadgeText({text: ""});
        return;
    }
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
    chrome.alarms.create({'delayInMinutes': pollIntervalMin});
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
            /**
             * Load list of issues
             */
            getIssues().load();
            /**
             * Load list of users
             */
//            getUsers().load();
        }
    } else {
        chrome.browserAction.setBadgeText({text: "Err"});
    }
}

/**
 * 
 * @returns {undefined}
 */
function upgradeSettings() {
    //Check for updated settings
    if (!getConfig().getProfile().notifications) {
        //update profile with new settings
        getConfig().getProfile().notifications = {
            show: 'none'
        };
        //Store changes
        getConfig().store(getConfig().getProfile());
    }
}

/**
 * Bind actions on extension is installed
 */
chrome.runtime.onInstalled.addListener(function() {
    console.log("Installed");
    upgradeSettings();
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