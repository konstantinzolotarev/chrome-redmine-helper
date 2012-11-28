var pollIntervalMin = 5;  // 5 minutes
var notification;
var selectedText = "";

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
 * Get selected text from context menu event
 *
 * @returns {String} selected text
 */
function getSelectedText() {
    return selectedText;
}

/**
 * Clear selected in context menu text
 */
function clearSelectedText() {
    selectedText = "";
}

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
 * @param {Object} page
 * @returns {void}
 */
function openMainPage(page) {
    var urlToOpen = page ? getMainUrl()+"#"+page : getMainUrl() ;
    console.log(urlToOpen, page);
    chrome.tabs.getAllInWindow(undefined, function(tabs) {
        for (var i = 0, tab; tab = tabs[i]; i++) {
            if (tab.url && isMainUrl(tab.url)) {
                chrome.tabs.update(tab.id, {
                    selected: true,
                    url: urlToOpen
                });
                return;
            }
        }
        chrome.tabs.create({url: urlToOpen});
    });
}

/**
 * Shedule next request to Redmine
 */
function scheduleRequest() {
    chrome.alarms.create("issues", {'delayInMinutes': pollIntervalMin});
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
 * handler for click on context menu
 */
function handleContextMenu(info, tab) {
    console.log(info);
    //store selected text
    selectedText = info.selectionText;
    //open new tab to create issue 
    openMainPage("/new_issue");
}

/**
 * Add handler to context menu click
 */
chrome.contextMenus.onClicked.addListener(handleContextMenu);


/**
 * Bind actions on extension is installed
 */
chrome.runtime.onInstalled.addListener(function() {
    startRequest({scheduleRequest:true});
});

/**
 * sRun actions on timer
 * 
 * @param {Alarm} alarm
 */
chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name && alarm.name == "issues") {
        startRequest({scheduleRequest:true});
    }
    if (alarm.name && alarm.name == "notifications") {
        if (notification) {
            notification.cancel();
        }
    }
});


/**
 * Bind click action to icon
 */
chrome.browserAction.onClicked.addListener(function() {
    openMainPage(); 
});

/**
 * Create context menu to create new issues from selected text
 */ 
 chrome.contextMenus.create({
    'id': "newIssueContextMenu",
    'title': "Create new Redmine issue",
    'contexts': ["selection"]
 });