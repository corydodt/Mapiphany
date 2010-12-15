$.require('base.js');

$.require('jquery.tmpl.js');
$.require('jquery.json-2.2.js');
$.require('jquery-svg/jquery.svg.js');
$.require('jquery-svg/jquery.svgdom.js');

VIEW_MAP_EDIT = 'map-edit';
VIEW_USER_EDIT = 'user-edit';
VIEW_MY_MAPS = 'my-maps';
APP_NAME = 'Mapiphany';
EVENT_TEMPLATE_DONE = 'template-done';


function stripHash(uri) { // remove the hash (if any) from uri
    var rx = /#[^#]*$/;
    return uri.replace(rx, '');
}

function reloadTo(uri) { // send us to the uri for sure
    window.location.href = uri;
    // The following may only be required in some browsers; other
    // browsers will already be reloading by this point.
    window.location.reload();
}


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
        var $n;
        if (this.appState.getVisibleScreen()[0] == VIEW_MAP_EDIT) {
            $n = this.appState.currentMap.renderMap($('#map-edit'));
        } else if (this.appState.getVisibleScreen()[0] == VIEW_MY_MAPS) {
            $n = $('#my-maps').tmpl(this.appState);
        } else if (this.appState.getVisibleScreen()[0] == VIEW_USER_EDIT) {
            $n = $('#user-edit').tmpl(this.appState);
        }
        return $n;
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
        $('#workspace').empty().append(
            (new Workspace(this.appState, $('#workspace-tmpl'))
                 ).render({})
            );
        $('title').html(this.appState.getTitle());
    }
});


var Map = PageArea.extend({
    constructor: function (appState, name) {
        // FIXME - use regex split, and unescape ## into # 
        var _split = name.split('#');
        this.name = _split[0];
        this.id = _split[1];
        this.$template = $('#map-tab');
        this.modified = false;
        this.appState = appState;
    },

    save: function (forTemplate) { // serialize this map instance to dict data
        if (forTemplate) {
            console.log("save");
        }
        return {name:this.name, id:this.id, modified:this.modified};
    },

    renderMap: function ($mapTemplate) { // turn on svg mode for the div
        var $mapEdit = $mapTemplate.tmpl(this);
        var me = this;
        // this must happen after templates have finished rendering so the
        // node really exists. svg events can't trigger unless the node is
        // visible in the DOM.
        $(document).bind(EVENT_TEMPLATE_DONE, function (ev) {
            var $map = $mapEdit.filter('#map-combined').find('.map');
            $map.svg(function (svg) { me.svg2(svg) });
        });
        return $mapEdit;
    },

    svg2: function (svg) {
        var ptn, sin60, mult, rw, rh, THIN;
        var _05, _15, _2, _3, _SMALL, _MED, _BIG; 

        // for convenience define a lot of constants
        sin60 = Math.sin(60*Math.PI/180);
        mult = 20;
        _05 = 0.5*mult;
        _15 = 1.5*mult;
        _2 = 2*mult;
        _3 = 3*mult;
        _35 = 3.5*mult;
        _SMALL = 1*mult*sin60;
        _MED = 2*mult*sin60;
        _BIG = 3*mult*sin60;
        rw = $(svg.root()).parent().width();
        rh = $(svg.root()).parent().height();

        THIN = {fill: 'transparent', stroke: '#888', strokeWidth: 0.60};

        for (var x=0; x<rw; x = x + _3) {
            var xx = Math.floor(x*2/_3+0.5);
            for (var y=0; y<rh; y = y + _MED) {
                var yy = Math.floor(y/_MED+0.5);
                var $p1 = $(svg.polygon(null, [[x+_05, y+0], [x+_15, y+0], [x+_2, y+_SMALL],
                    [x+_15, y+_MED], [x+_05, y+_MED], [x+0, y+_SMALL], [x+_05, y+0]],
                    THIN));
                $p1.attr('title', xx+','+yy).data({x:xx,y:yy});

                var $p2 = $(svg.polygon(null, [[x+_2, y+_SMALL], [x+_3, y+_SMALL], [x+_35, y+_MED],
                    [x+_3, y+_BIG], [x+_2, y+_BIG], [x+_15, y+_MED], [x+_2, y+_SMALL]],
                    THIN));
                $p2.attr('title', (xx+1)+','+yy).data({x:xx+1,y:yy});
            }
        }
        $('polygon', svg.root()
            ).mouseover(function () {
                $(this).attr('stroke', '#147dff');
                $(this).attr('stroke-width', 3);
            }).mouseout(function () {
                $(this).attr('stroke', '#888');
                $(this).attr('stroke-width', 1);
        });
    },
}, {
    restore: function (data, appState) {
        // restore: return a new instance of Map from the given dict data
        var ret = new Map(appState, '#');
        ret.name = data.name;
        ret.id = data.id;
        ret.modified = data.modified;
        return ret;
    }
});


var AppState = Base.extend({
    constructor: function () {
        if (!localStorage.maps) {
            localStorage.maps = $.toJSON([
                (new Map(this, 'your map#1')).save(),
                (new Map(this, 'your map 2#2')).save()
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
        me.maps = {};
        $.map(_maps, function (m) { 
            var mt = Map.restore(m, me); 
            me.maps[mt.id] = mt;
        });
        this.openMaps = $.evalJSON(localStorage.openMaps);

        this.visibleScreen = localStorage.visibleScreen;

        this.username = localStorage.username;
        this.email = localStorage.email;

        var vs = this.getVisibleScreen();
        if (vs[0] == VIEW_MAP_EDIT) {
            this.currentMap = this.maps[vs[1]];
        }
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
            return this.currentMap.name + ' (editing) - ' + APP_NAME;
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

    $(document).trigger(EVENT_TEMPLATE_DONE);
});

