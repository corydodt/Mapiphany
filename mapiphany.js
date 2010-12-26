$.require('base.js');

$.require('jquery.tmpl.js');
$.require('jquery.json-2.2.js');
$.require('jquery-svg/jquery.svg.js');
$.require('jquery-svg/jquery.svgdom.js');

$.require('tileset.js');


VIEW_MAP_EDIT = 'map-edit';
VIEW_USER_EDIT = 'user-edit';
VIEW_MY_MAPS = 'my-maps';
APP_NAME = 'Mapiphany';
EVENT_TEMPLATE_DONE = 'template-done';


function dir(o) {
    if (console) {
        return console.dir(o);
    }
}

function log(m) {
    if (console) {
        return console.log(m);
    }
}


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

function sortObject(obj) { // return an array of the key/value pairs in obj, sorted by key
    arr = [];
    $.each(obj, function (item) {
            if (obj.hasOwnProperty(item)) {
                arr.push([item, obj[item]]);
            }
        });
    arr.sort();
    return arr;
};


// a hex tile background
var Fill = Base.extend({
    constructor: function (svg, parent, label, xUnit, yUnit) {
        this.svg = svg;
        this.tile = Tileset[label];
        this.xUnit = xUnit;
        this.yUnit = yUnit;

        this.href = 'tiles/' + this.tile.set + '/' + this.tile.iconfilename;
        svg.image(parent, 0, 0, 4*this.xUnit, 2*this.yUnit, this.href, {id: label + '-icon', 
            'pointer-events': 'none'});

        this.id = label;
    },

    iconAt: function (parent, x, y) { // place an icon image for this Fill at the coordinates x,y
        // It's a shame there is no $.support for svg features.  who knows
        // what the current support grid is like for all these features?
        //
        // This is based on: http://www.codedread.com/svg-support-table.html
        //
        if ($.browser.mozilla || $.browser.opera) {
            // use has the best performance by far, when it is available
            var use = this.svg.use(parent, x, y, 4*this.xUnit, 2*this.yUnit, '#' + this.id + '-icon', {'pointer-events': 'none'});
            return use;
        } else {
            var img = this.svg.image(parent, x, y, 4*this.xUnit, 2*this.yUnit, this.href, {'pointer-events': 'none'});
            return img;
        }
    }
});


// any defined region of the page space that requires rendering with a template
var PageArea = Base.extend({
    constructor: function (appState, $template) {
        this.appState = appState;
        this.$template = $template;
    },

    render: function (data) {
        return this.$template.tmpl(data);
    }
});


// the navigation and controls at the top of the page
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


// the main workspace below the Top, which may contain different sub-apps
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


// the layout of the top and bottom of the page
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


// the drawable map grid inside the workspace
var Map = PageArea.extend({
    constructor: function (appState, name) {
        // FIXME - use regex split, and unescape ## into # 
        var _split = name.split('#');
        this.name = _split[0];
        this.id = _split[1];
        this.$template = $('#map-tab');
        this.modified = false;
        this.appState = appState;
        this.grid = {};
    },

    save: function (forTemplate) { // serialize this map instance to dict data
        if (forTemplate) {
            log("save");
        }
        return {name:this.name, id:this.id, modified:this.modified};
    },

    setCurrent: function (newTile) {
        var tile = this.tileset[newTile];
        console.dir(tile);
        var $cur = $('#current');
        $cur.attr('src', 'tiles/' + tile.set + '/' + tile.iconfilename);
        $cur.attr('class', newTile);
    },

    renderMap: function ($mapTemplate) { // turn on svg mode for the div
        this.categories = sortObject(TilesetCategories);
        this.tileset = Tileset;
        var $mapEdit = $mapTemplate.tmpl(this);
        var $me = this;
        $mapEdit.find('.drawbar-tile').click(function () { 
                return $me.setCurrent($(this).data('tile'));
            });
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
        var grid = this.grid;
        var defs = svg.defs();

        var t1 = new Date();

        // for convenience define a lot of constants
        var rw = $(svg.root()).parent().width();
        var rh = $(svg.root()).parent().height();

        var mult = 20; // how big to make the hex

        var sin60 = Math.sin(60 * Math.PI / 180);

        // x-dimension constants
        var _05 = 0.5 * mult;
        var _15 = 1.5 * mult;
        var _2 = 2 * mult;
        var _3 = 3 * mult;
        var _35 = 3.5 * mult;

        // y-dimension constants
        var _SMALL = 1 * mult * sin60;
        var _MED = 2 * mult * sin60;
        var _BIG = 3 * mult * sin60;

        var grassland = new Fill(svg, defs, 'Grassland', _05, _SMALL);
        var GRASSY = {'class': 'hex Grassland'};

        var x, xx, x05, x15, x2, x3, x35;
        var y, yy, yS, yM, yB;
        for (var x = 0, xx = 0; x < rw; x = x + _3, xx = xx + 1) {
            x05 = x + _05; x15 = x + _15; x2 = x + _2; x3 = x + _3; x35 = x + _35;

            for (y = 0, yy = 0; y < rh; y = y + _MED, yy = yy + 1) {
                yS = y + _SMALL; yM = y + _MED; yB = y + _BIG;

                // up hex
                var $p1 = $(svg.polygon(null, [
                        [x05, y], [x15, y], [x2, yS],
                        [x15, yM], [x05, yM], [x, yS], [x05, y]
                    ], GRASSY));
                grassland.iconAt(null, x, y);
                $p1.attr('title', xx + ',' + yy).data({x: xx, y: yy});
                if (! grid[xx]) {
                    grid[xx] = {};
                }
                grid[xx][yy] = $p1;

                // down hex
                var $p2 = $(svg.polygon(null, [
                        [x2, yS], [x3, yS], [x35, yM],
                        [x3, yB], [x2, yB], [x15, yM], [x2, yS]
                    ], GRASSY));
                grassland.iconAt(null, x15, yS);
                $p2.attr('title', (xx + 1) + ',' + yy).data({x: xx + 1, y: yy});
                if (! grid[xx + 1]) {
                    grid[xx + 1] = {};
                }
                grid[xx + 1][yy] = $p2;
            }
        }
        $('polygon.hex', svg.root()
            ).mouseover(function () {
                // instead of altering the base hex, we clone it.  the clone
                // always goes to the end, meaning it's on top, meaning we can
                // see the entire outline.  Otherwise the outline is partially
                // overlapped by hexes down and to the right.
                var $clone = $(this).clone();
                $clone.addClass('selected');
                svg.root().appendChild($clone[0]);
            }).mouseout(function () {
                $('.selected.hex').remove();
            });
        var t2 = new Date();
        log(t2-t1);
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


// I remember what you were looking at in the app
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

