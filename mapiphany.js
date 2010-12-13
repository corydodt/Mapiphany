$.require('base.js');

$.require('jquery.tmpl.js');
$.require('jquery.json-2.2.js');
// $.require('jquery-svg/jquery.svg.js');


var PageArea = Base.extend({
    constructor: function (appState, $template) {
        this.appState = appState;
        this.$template = $template;
    },

    render: function (data) {
        return this.$template.tmpl(data);
    }
});


var Top = PageArea.extend({
    render: function (data) {
        return this.$template.tmpl(this.appState);
    }
});


var Workspace = PageArea.extend({
    render: function (data) {
        return this.$template.tmpl(this.appState);
    }
});


var Framework = Base.extend({
    constructor: function(appState) {
        this.appState = appState;
    },

    render: function () {
        (new Top(this.appState, $('#top-control-tmpl'))
             ).render({}
             ).insertBefore('#cursor');
        (new Workspace(this.appState, $('#workspace-tmpl'))
             ).render({}
             ).insertBefore('#cursor');
    }
});


var MapTab = PageArea.extend({
    constructor: function (name) {
        // FIXME - use regex split, and unescape ## into # 
        _split = name.split('#');
        this.name = _split[0];
        this.id = _split[1];
        this.$template = $('#map-tab');
        this.modified = false;
    },

    save: function (forTemplate) {
        // save: serialize this map instance to dict data
        if (forTemplate) {
            console.log("save");
        }
        return {name:this.name, id:this.id, modified:this.modified};
    }
}, {
    restore: function (data) {
        // restore: return a new instance of MapTab from the given dict data
        var ret = new MapTab('#');
        ret.name = data.name;
        ret.id = data.id;
        ret.modified = data.modified;
        return ret;
    }
});


var AppState = Base.extend({
    constructor: function () {
        if (!localStorage.maps) {
            localStorage.maps = $.toJSON([(new MapTab('your map#1')).save()]);
            localStorage.visibleScreen = 'map-edit#1';
            localStorage.openMaps = $.toJSON(['1']);
            localStorage.username = 'corydodt';
            localStorage.email = 'mapiphany@s.goonmill.org';
        };

        // TODO - make _upgrade1to2, _upgrade2to3 etc. so we can cleanly
        // upgrade storage
        //
        var _maps = $.evalJSON(localStorage.maps);
        var mapMap = {};
        $.map(_maps, function (m) { 
            var mt = MapTab.restore(m); 
            mapMap[mt.id] = mt;
        });
        this.maps = mapMap;
        this.openMaps = $.evalJSON(localStorage.openMaps);

        this.visibleScreen = localStorage.visibleScreen;

        this.username = localStorage.username;
        this.email = localStorage.email;
    },

    getVisibleScreen: function () {
        return this.visibleScreen.split('#');
    }

});


$(function () {
    // for debugging, make it possible to reset the stored data
    if (window.location.href.search(/#clear$/) >= 0) {
        localStorage.clear();
        // redirect
        window.location = window.location.href.replace(/#clear$/, '#clearedLocalStorage');
    }
    var appState = new AppState();

    var fw = new Framework(appState);
    fw.render();
});

