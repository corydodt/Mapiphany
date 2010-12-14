$.require('base.js');

$.require('jquery.tmpl.js');
$.require('jquery.json-2.2.js');
// $.require('jquery-svg/jquery.svg.js');

VIEW_MAP_EDIT = 'map-edit';
VIEW_USER_EDIT = 'user-edit';
VIEW_MY_MAPS = 'my-maps';
APP_NAME = 'Mapiphany';


var PageArea = Base.extend({
    constructor: function (appState, $template) {
        this.appState = appState;
        this.$template = $template;
    },

    render: function (data) {
        return this.$template.tmpl(data);
    }
});


function stripHash(uri) {
    // remove the hash (if any) from uri
    var rx = /#[^#]*$/;
    return uri.replace(rx, '');
}


var Top = PageArea.extend({
    render: function (data) {
        var ret = this.$template.tmpl(this.appState);
        var me = this;
        ret.find('a[href$=#clear]').click(function () { 
            var page = stripHash(window.location.href);
            reloadTo(page + '#clear');
            return false;
        });

        ret.find('a[href$=#userEdit]').click(function () {
            me.appState.view(VIEW_USER_EDIT);
            return false;
        });

        ret.find('a[href$=#logout]').click(function () {
            alert('not implemented');
            return false;
        });

        ret.find('.map-tab').click(function () {
            var tab = $(this);
            var newVis = VIEW_MAP_EDIT + '#' + tab.data('id');
            me.appState.view(newVis);
            return false;
        });

        ret.find('a[href$=#myMaps]').parents('.tab').click(function () {
            me.appState.view(VIEW_MY_MAPS);
            return false;
        });

        return ret;
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
        $('title').html(this.appState.getTitle());
    }
});


var MapTab = PageArea.extend({
    constructor: function (appState, name) {
        // FIXME - use regex split, and unescape ## into # 
        _split = name.split('#');
        this.name = _split[0];
        this.id = _split[1];
        this.$template = $('#map-tab');
        this.modified = false;
        this.appState = appState;
    },

    save: function (forTemplate) {
        // save: serialize this map instance to dict data
        if (forTemplate) {
            console.log("save");
        }
        return {name:this.name, id:this.id, modified:this.modified};
    }
}, {
    restore: function (data, appState) {
        // restore: return a new instance of MapTab from the given dict data
        var ret = new MapTab(appState, '#');
        ret.name = data.name;
        ret.id = data.id;
        ret.modified = data.modified;
        return ret;
    }
});


function reloadTo(uri) {
    window.location.href = uri;
    // The following may only be required in some browsers; other
    // browsers will already be reloading by this point.
    window.location.reload();
}


var AppState = Base.extend({
    constructor: function () {
        if (!localStorage.maps) {
            localStorage.maps = $.toJSON([
                (new MapTab(this, 'your map#1')).save(),
                (new MapTab(this, 'your map 2#2')).save()
            ]);
            localStorage.visibleScreen = VIEW_MAP_EDIT + '#1';
            localStorage.openMaps = $.toJSON(['1', '2']);
            localStorage.username = 'corydodt';
            localStorage.email = 'mapiphany@s.goonmill.org';
        };

        // TODO - make _upgrade1to2, _upgrade2to3 etc. so we can cleanly
        // upgrade storage
        //
        var _maps = $.evalJSON(localStorage.maps);
        var me = this;
        me.maps= {};
        $.map(_maps, function (m) { 
            var mt = MapTab.restore(m, me); 
            me.maps[mt.id] = mt;
        });
        this.openMaps = $.evalJSON(localStorage.openMaps);

        this.visibleScreen = localStorage.visibleScreen;

        this.username = localStorage.username;
        this.email = localStorage.email;
    },

    getVisibleScreen: function () {
        return this.visibleScreen.split('#');
    },

    view: function (destination) {
        // navigate to the new destination
        localStorage.visibleScreen = destination;
        window.location.href = stripHash(window.location.href);
        window.location.reload();
    },

    getTitle: function () {
        // get the <title> content
        var vs = this.getVisibleScreen();
        if (vs[0] == VIEW_MAP_EDIT) {
            return this.maps[vs[1]].name + ' (editing) - ' + APP_NAME;
        } else if (vs[0] == VIEW_USER_EDIT) {
            return "editing " + this.username + " - " + APP_NAME;
        } else if (vs[0] == VIEW_MY_MAPS) {
            return this.username + "'s maps - " + APP_NAME;
        } else {
            return '!?? - ' + APP_NAME;
        }
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

