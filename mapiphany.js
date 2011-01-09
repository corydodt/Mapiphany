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
EVENT_MAP_ZOOM = 'map-zoom';
EVENT_MAP_UNDO = 'map-undo';
EVENT_MAP_REDO = 'map-redo';
PEN_SMALL = 'small';
PEN_LARGE = 'large';
MULT = 25; // baseline multiplier to get a decent-sized hex
SIN60 = Math.sin(60 * Math.PI / 180);
Y_UNIT = MULT * SIN60;
X_UNIT = MULT * 0.5;
DEFAULT_FILL = 'Grassland';
CLASS_FG_FILL = 'fgFill1';

CATEGORY_ORDER = ['Other Land', 'Forests', 'Rough Land', 'Water', 'Settlement', 'Symbol', 'Hex Fill', 'Other'];



function dir(o) {
    try {
        return console.dir(o);
    } catch (e) {
    }
}

function log(m) {
    try {
        return console.log(m);
    } catch (e) {
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

function sortObject(obj, order) { // return an array of the key/value pairs in obj, sorted by key
    // if 'order' is given, it is an array that specifies the order by names
    // of keys, instead of using the natural sort order
    var arr = [], loop = obj;
    if (order !== undefined) {
        loop = order;
    }
    $.each(loop, function (item) {
        if (order) {
            item = loop[item];
        }
        if (obj.hasOwnProperty(item)) {
            arr.push([item, obj[item]]);
        }
    });
    if (order === undefined) {
        arr.sort();
    }
    return arr;
};


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


// the controls at the top of the map-edit area
var Toolbar = PageArea.extend({
    render: function (data) {
        var ret = this.$template.tmpl(this.appState.currentMap);

        ret.find('a[href$=#zoom]').click(function () {
            var $me = $(this);
            $(document).trigger(EVENT_MAP_ZOOM, [$me.data('zoom')]);
            return false;
        });

        ret.find('input[value=undo]').click(function () {
            $(document).trigger(EVENT_MAP_UNDO, []);
        });

        ret.find('input[value=redo]').click(function () {
            $(document).trigger(EVENT_MAP_REDO, []);
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


// the current drawing settings
var Pen = Base.extend({
    constructor: function ($node) {
        this.$node = $node;
        // this.fgFill = null;
        // this.bgFill = null;
        // this.fillSize = PEN_SMALL;
        // this.pathWidth = null;
        // this.pathColor = null;
        // this.pathStyle = null;
        this.fillName = null;
    },

    // set the current pen and display the new setting
    setCurrent: function (newTile) {
        var tile = gTileset[newTile];
        var $disp = $('#current');
        $disp.attr('src', 'tiles/' + tile.set + '/' + tile.iconfilename);
        $disp.attr('class', newTile);
        $disp.attr('title', newTile);

        this.fillName = newTile;
    },
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
        this.$node = null;
        this.pen = null;
        this.svg = null;
        this.history = new UndoHistory(this);
    },

    save: function (forTemplate) { // serialize this map instance to dict data
        if (forTemplate) {
            log("save");
        }
        return {name:this.name, id:this.id, modified:this.modified};
    },

    renderMap: function ($mapTemplate) { // turn on svg mode for the div
        this.categories = sortObject(gTilesetCategories, CATEGORY_ORDER);
        var $mapEditNodes = $mapTemplate.tmpl(this);
        this.$node = $mapEditNodes.filter('#map-combined');
        var me = this;
        this.$node.find('.drawbar-tile').click(function () { 
            return me.pen.setCurrent($(this).data('tile'));
        });

        var $toolbar = (new Toolbar(this.appState, $('#toolbar'))).render();
        this.$node.find('.toolbar').replaceWith($toolbar);

        // this must happen after templates have finished rendering so the
        // node really exists. svg events can't trigger unless the node is
        // visible in the DOM.
        $(document).bind(EVENT_TEMPLATE_DONE, function (ev) {
            var $mapNode = me.$node.find('.map');
            $mapNode.svg(function (svg) { me._renderSVG(svg) });
            me.pen = new Pen($('#current'));
            me.pen.setCurrent(DEFAULT_FILL);
        });
        $(document).bind(EVENT_MAP_UNDO, function (ev) {
            log('undo');
            me.history.undo();
        });
        $(document).bind(EVENT_MAP_REDO, function (ev) {
            log('redo');
            me.history.redo();
        });
        $(document).bind(EVENT_MAP_ZOOM, function (ev, zoom) {
            me.zoom(zoom);
        });
        return $mapEditNodes;
    },

    iconAt: function (label, x, y) { // place an icon image for this Fill at the coordinates x,y
        var $def = $('#' + label + '-icon');

        // create the <defs><image> when missing.
        if ($def.length == 0) {
            var tile = gTileset[label];

            var href = 'tiles/' + tile.set + '/' + tile.iconfilename;
            $def = $(this.svg.image(this.defs, 0, 0, 4*X_UNIT, 2*Y_UNIT, href, { id: label + '-icon' }));
        }

        // It's a shame there is no $.support for svg features.  who knows
        // what the current support grid is like for all these features?
        //
        // This is based on: http://www.codedread.com/svg-support-table.html
        //
        var itm, _g = this.grid[x][y];
        if ($.browser.mozilla || $.browser.opera) {
            // use has the best performance by far, when it is available
            itm = this.svg.use(null, _g.x, _g.y, 4*X_UNIT, 2*Y_UNIT, '#' + $def.attr('id'), {'pointer-events': 'none'});
        } else {
            itm = this.svg.image(null, _g.x, _g.y, 4*X_UNIT, 2*Y_UNIT, $def.attr('href'), {'pointer-events': 'none'});
        }
        $(itm).addClass(CLASS_FG_FILL);
        $(itm).data({x:x, y:y, xy: x + ',' + y});
        return itm;
    },

    zoom: function (scale, xAbs, yAbs) {    // rescale the map to the specified zoom
        // to get bigger hexes (larger zoom), use a smaller w/h in the
        // viewbox.  to get smaller hexes (smaller zoom), use larger viewBox
        // w/h.
        var factor = 100.0 / scale;

        var $root = $(this.svg.root());
        var rw = $root.parent().width();
        var rh = $root.parent().height();

        var vb = this.svg.root().viewBox;
        if (xAbs === undefined) {
            xAbs = vb.baseVal.x;
        }
        if (yAbs === undefined) {
            yAbs = vb.baseVal.y;
        }

        $root.attr('viewBox', xAbs + ' ' + yAbs + ' ' + rw * factor + ' ' + rh * factor);
    },

    _renderSVG: function (svg) {
        this.svg = svg;

        var grid = this.grid;
        var defs = this.defs = svg.defs();

        var t1 = new Date();

        // position the viewbox so that no whitespace is visible at the edges
        this.zoom(100, X_UNIT, Y_UNIT);

        // for convenience define a lot of constants
        var rw = $(svg.root()).parent().width();
        var rh = $(svg.root()).parent().height();

        // x-dimension constants
        var _05, _15, _2, _3, _35;
        _05 = X_UNIT;
        _15 = 3 * _05;
        _2 = 4 * _05;
        _3 = 6 * _05;
        _35 = 7 * _05;

        // y-dimension constants
        var _SHORT, _MED, _TALL;
        _SHORT = Y_UNIT;
        _MED = 2 * _SHORT;
        _TALL = 3 * _SHORT;

        var defaultClass = {'class': 'hex ' + DEFAULT_FILL};

        var xAbs, xx, x05, x15, x2, x3, x35;
        var yAbs, yy, yS, yM, yT;
        for (var xAbs = 0, xx = 0; xAbs < rw + _05; xAbs = xAbs + _3, xx = xx + 2) {
            x05 = xAbs + _05; x15 = xAbs + _15; x2 = xAbs + _2; x3 = xAbs + _3; x35 = xAbs + _35;

            for (yAbs = 0, yy = 0; yAbs < rh + _SHORT; yAbs = yAbs + _MED, yy = yy + 1) {
                yS = yAbs + _SHORT; yM = yAbs + _MED; yT = yAbs + _TALL;

                // up hex
                var $p1 = $(svg.polygon(null, [
                        [x05, yAbs], [x15, yAbs], [x2, yS],
                        [x15, yM], [x05, yM], [xAbs, yS], [x05, yAbs]
                    ], defaultClass));
                // store the coordinates
                if (! grid[xx]) {
                    grid[xx] = {};
                }
                grid[xx][yy] = {x:xAbs, y:yAbs};
                $p1.attr('title', xx + ',' + yy).data({x: xx, y: yy, fgbg: DEFAULT_FILL});

                this.iconAt(DEFAULT_FILL, xx, yy);

                // down hex
                var $p2 = $(svg.polygon(null, [
                        [x2, yS], [x3, yS], [x35, yM],
                        [x3, yT], [x2, yT], [x15, yM], [x2, yS]
                    ], defaultClass));
                // store the coordinates
                if (! grid[xx + 1]) {
                    grid[xx + 1] = {};
                }
                grid[xx + 1][yy] = {x:x15, y:yS};
                $p2.attr('title', (xx + 1) + ',' + yy).data({x: xx + 1, y: yy, fgbg: DEFAULT_FILL});

                this.iconAt(DEFAULT_FILL, xx + 1, yy);
            }
        }
        var me = this;
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
                me.$node.find('.selected.hex').remove();
            }).click(function () { 
                me.onHexClick(this);
            });
        var t2 = new Date() - t1;
        log("_renderSVG: " + t2.toString() + "ms (" + Math.floor(10000/t2)/10 + " fps)");
    },

    onHexClick: function (hex) {
        this.history.do('setFGBG', [hex, this.pen.fillName], [hex, $(hex).data('fgbg')]); 
    },

    do_setFGBG: function (hex, fillName) {
        var $h = $(hex);
        $h.attr('class', 'hex ' + fillName);
        $h.data({fgbg: fillName, dirty: true});

        var _dat = $h.data();
        var fg = this._findFGByXY(_dat.x, _dat.y);
        $(fg).remove();
        this.iconAt(fillName, _dat.x, _dat.y);
    },

    _findFGByXY: function (x, y) {    // find the fg tile (<use> or <image>) with the same x,y
        var fgs = this.$node.find("." + CLASS_FG_FILL);
        var _xy = x + ',' + y;
        return $.grep(fgs, function (x) { return $(x).data('xy') == _xy });
    }
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


// implement command-based undo, managing the actions that can be applied to
// the object
var UndoHistory = Base.extend({
    constructor: function (managedObject) {
        this.managedObject = managedObject;
        this.history = [];
        this.future = []; // for redo, remember commands that were undone
    },

    // TODO - isDirty. Not as simple as checking history.length, must take
    // into account where the current map state is wrt future and history.

    do: function (cmd, args, previous) { // apply an action to the managedObject and remember it
        this.managedObject['do_' + cmd].apply(this.managedObject, args);
        this.history.push([cmd, args, previous]);
        this.future = [];
    },

    undo: function () { // un-apply whatever the last action was
        if (this.history.length == 0) {
            return;
        }
        var last = this.history.pop();
        this.managedObject['do_' + last[0]].apply(this.managedObject, last[2]);
        this.future.push(last);
    },

    redo: function () { // distinguished from "do" because it doesn't clear the "future" list
        if (this.future.length == 0) {
            return;
        }
        var future = this.future.pop();
        this.managedObject['do_' + future[0]].apply(this.managedObject, future[1]);
        this.history.push(future);
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

