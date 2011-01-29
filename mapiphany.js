$.require('base.js');

$.require('jquery.tmpl.js');
$.require('jquery.json-2.2.js');
$.require('jquery-svg/jquery.svg.js');
$.require('jquery-svg/jquery.svgdom.js');
$.require('jquery-svg/jquery.svganim.js');

$.require('tiles/tilesets.js');


VIEW_MAP_EDIT = 'map-edit';
VIEW_USER_EDIT = 'user-edit';
VIEW_MY_MAPS = 'my-maps';
VIEW_CLEAR = 'clear';
APP_NAME = 'Mapiphany';
EVENT_TEMPLATE_DONE = 'template-done';
EVENT_MAP_ZOOM = 'map-zoom';
EVENT_MAP_UNDO = 'map-undo';
EVENT_MAP_REDO = 'map-redo';
EVENT_MAP_SAVE = 'map-save';
EVENT_MAP_RENAME = 'map-rename';
PEN_SMALL = 'small';
PEN_LARGE = 'large';
MULT = 25; // baseline multiplier to get a decent-sized hex
SIN60 = Math.sin(60 * Math.PI / 180);
Y_UNIT = MULT * SIN60;
X_UNIT = MULT * 0.5;
DEFAULT_FILL = 'Grassland';
CLASS_FG_FILL = 'fgFill1';
DEFAULT_TILESET = 'rkterrain-finalopt';
KEEP_LAYER = '~';

CATEGORY_ORDER = ['Tools', 'Flat Land', 'Forests', 'Mountains and Hills', 'Arid Land', 'Water', 'Settlement', 'Symbol', 'Hex Background'];

TOOLS_CATEGORY = {'Tools': 
    ['Blank_FG', 'Blank_BG', 'Blank_Both']
};

TOOLS = {
    'Blank_Both': {
        categories: "Tools",
        iconfilename: "blankboth.png",
        set: "."
    },
    'Blank_BG': {
        categories: "Tools",
        iconfilename: "blankbg.png",
        set: "."
    },
    'Blank_FG': {
        categories: "Tools",
        iconfilename: "blankfg.png",
        set: "."
    },
};


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
    constructor: function (appState) {
        this.appState = appState;
    },

    render: function ($template, data) {
        return $template.tmpl(data || this.appState);
    }
});


// the navigation and controls at the top of the page
var Top = PageArea.extend({
    render: function ($template) {
        var $ret = $template.tmpl(this.appState);
        var me = this;
        me.$node = $ret;

        $ret.find('a[href$=#clear]').click(function () { 
            var page = stripHash(window.location.href);
            me.appState.redirect(VIEW_CLEAR);
            return false;
        });

        $ret.find('a[href$=#userEdit]').click(function () {
            me.appState.redirect(VIEW_USER_EDIT);
            return false;
        });

        $ret.find('a[href$=#logout]').click(function () {
            alert('not implemented');
            return false;
        });

        $ret.find('.map-tab').click(function () {
            var tab = $(this);
            var newVis = VIEW_MAP_EDIT + '&' + tab.data('id');
            me.appState.redirect(newVis);
            return false;
        });

        $(document).bind(EVENT_MAP_RENAME, function (ev, id, name) {
            me.$node.find('[data-id=' + id + '] a').text(name);
        });

        $ret.find('a[href$=#myMaps]').parents('.tab').click(function () {
            me.appState.redirect(VIEW_MY_MAPS);
            return false;
        });

        return $ret;
    }
});


// the controls at the top of the map-edit area
var Toolbar = PageArea.extend({
    render: function ($template) {
        var ret = $template.tmpl(this.appState.currentMap);
        var me = this;

        ret.find('a[href$=#zoom]').click(function () {
            var $me = $(this);
            $(document).trigger(EVENT_MAP_ZOOM, [$me.data('zoom')]);
            return false;
        });

        ret.find('input[name=undo]').click(function () {
            $(document).trigger(EVENT_MAP_UNDO, []);
        });

        ret.find('input[name=redo]').click(function () {
            $(document).trigger(EVENT_MAP_REDO, []);
        });

        ret.find('input[name=mapName]').change(function () {
            $(document).trigger(EVENT_MAP_RENAME, [
                me.appState.currentMap.id, 
                $(this).val()
            ]);
        });

        ret.find('input[name=save]').click(function () {
            $(document).trigger(EVENT_MAP_SAVE, []);
        });

        return ret;
    }
});


// the main workspace below the Top, which may contain different sub-apps
var Workspace = PageArea.extend({
    render: function () {
        var $n;
        if (this.appState.visibleScreen[0] == VIEW_MAP_EDIT) {
            $n = this.appState.currentMap.render($('#map-edit'));
        } else if (this.appState.visibleScreen[0] == VIEW_MY_MAPS) {
            $n = this.appState.mapList.render($('#my-maps'));
        } else if (this.appState.visibleScreen[0] == VIEW_USER_EDIT) {
            $n = this.appState.userEditor.render($('#user-edit'));
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
        (new Top(this.appState)
             ).render($('#top-control-tmpl')
             ).insertBefore('#cursor');
        $('#workspace').empty().append(
            (new Workspace(this.appState)
                 ).render($('#workspace-tmpl'))
            );
        $('title').html(this.appState.getTitle());
    }
});


// the current drawing settings
var Pen = Base.extend({
    constructor: function ($node) {
        this.$node = $node;
        this.fg = null;
        this.bg = null;
        this.fg2 = null;
        // this.fillSize = PEN_SMALL;
        // this.pathWidth = null;
        // this.pathColor = null;
        // this.pathStyle = null;
    },

    // set the current pen and display the new setting
    setCurrent: function (newTile) {
        var tile = gTileset[newTile];
        var $disp = $('#current');
        $disp.attr('src', 'tiles/' + tile.set + '/' + tile.iconfilename);
        $disp.attr('class', newTile);
        $disp.attr('title', newTile);

        this.bg = KEEP_LAYER;
        this.fg = KEEP_LAYER;
        this.fg2 = KEEP_LAYER;

        if (newTile == 'Blank_FG') {
            this.fg = null;
            this.fg2 = null;

        } else if (newTile == 'Blank_BG') {
            this.bg = null;

        } else if (newTile == 'Blank_Both') {
            this.fg = null;
            this.bg = null;
            this.fg2 = null;

        } else {
            var fill = function (c) { return tile.fill.substr(c, 1) };
            if (fill(0) == 'f') {
                this.fg = newTile;
            }
            if (fill(1) == 'b') {
                this.bg = newTile;
            }
            if (fill(2) == 'F') {
                this.fg2 = newTile;
            }

        }
    }
});


var UserEditor = PageArea.extend({
});


var MapList = PageArea.extend({
    render: function ($template) {
        var $ret = $template.tmpl(this.appState);
        var me = this;
        $ret.find('.snapshot .thumbnail, .snapshot .details').click(function () {
            me.appState.redirect(VIEW_MAP_EDIT + '&' + $(this).parents('.snapshot').attr('data-id'));
        });
        return $ret;
    }
});


// the drawable map grid inside the workspace
var Map = PageArea.extend({
    constructor: function (appState, name) {
        // FIXME - use regex split, and unescape ## into # 
        var _split = name.split('#');
        this.name = _split[0];
        this.id = _split[1];
        this.modified = false;
        this.appState = appState;
        this.grid = null;
        this.$node = null;
        this.pen = null;
        this.svg = null;
        this.tileset = DEFAULT_TILESET;
        this.history = new UndoHistory(this);
        this.defaultFill = DEFAULT_FILL;
        this._restoredExtents = null;
        this._restoredHexes = null;
        this._toSymbol = null;
    },

    save: function () { // serialize this map instance to dict data
        var _r = {name: this.name,
             id: this.id,
             modified: this.modified,
             defaultFill: this.defaultFill,
             hexes: null,
             extents: null,
             tileset: this.tileset
        };
        if (this.grid) {
            var _fixmeExtents = [0, 0, 19, 12];
            var hexes = this._saveGridArea.apply(this, _fixmeExtents);
            _r.lookup = this._toSymbol;
            _r.hexes = hexes;
            _r.extents = _fixmeExtents;
        }
        return _r;
    },

    _saveGridArea: function (minX, minY, maxX, maxY) { // serialize a grid of squares from minx/Y to maxX/Y
        var ret = [], n;
        var toAbbrev = {};

        this._toSymbol = {};

        for (x=minX; x<maxX + 1; x++) {
            var col = [], dat;
            ret.push(col);
            for (y=minY; y<maxY + 1; y++) {
                dat = this.grid[x][y].n.data();
                a0 = this.setLookup(dat.fg, toAbbrev);
                a1 = this.setLookup(dat.bg, toAbbrev);
                a2 = this.setLookup(dat.fg2, toAbbrev);
                col.push(a0 + a1 + a2);
            }
        }
        return ret;
    },

    setLookup: function (symbol, abbrevMap) { // add entries to my fill lookup tables
        if (symbol === undefined || symbol === null) {
            symbol = '~null~';
        }
        if (abbrevMap[symbol] !== undefined) {
            return abbrevMap[symbol];
        }
        if (symbol == '~null~') {
            abbrev = '~~';
        } else {
            var n = 0, suffixes = '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            var c0 = symbol[0];
            var abbrev = c0 + '0';
            // find a free suffix to use with this symbol
            while (this._toSymbol[abbrev] !== undefined) {
                n++;
                if (n > 51) {
                    throw "More than 52 symbols with the same first letter: " + c0 + "???";
                }
                abbrev = c0 + suffixes[n]; 
            }
        }

        this._toSymbol[abbrev] = symbol;
        abbrevMap[symbol] = abbrev;
        return abbrev;
    },

    _restoreGridArea: function () { // rebuild the map drawing from whatever we restored
        var t1 = new Date();
        var extents = this._restoredExtents;
        var hexes = this._restoredHexes;
        var unshiftX, unshiftY, cell;
        for (x = extents[0]; x <= extents[2]; x++) {
            unshiftX = x - extents[0];
            for (y = extents[1]; y <= extents[3]; y++) {
                unshiftY = y - extents[1];
                // set the hex properties, skipping the history layer
                cell = hexes[unshiftX][unshiftY];
                var fg = this._toSymbol[cell.substr(0, 2)];
                var bg = this._toSymbol[cell.substr(2, 2)];
                var fg2 = this._toSymbol[cell.substr(4, 2)];
                if (fg == '~null~') {
                    fg = null;
                }
                if (bg == '~null~') {
                    bg = null;
                }
                if (fg2 == '~null~') {
                    fg2 = null;
                }
                this.do_setHex(this.grid[x][y].n, fg, bg, fg2);
            }
        }
        this._restoredExtents = this._restoredHexes = undefined;
        var t2 = new Date() - t1;
        log("_restoreGridArea: " + t2.toString() + "ms");

        // clean up
        this._restoredExtents = null;
        this._restoredHexes = null;
        this._toSymbol = null;
    },

    render: function ($mapTemplate) { // turn on svg mode for the div
        $.require('tiles/' + this.tileset + '/tileset.js');
        $.extend(gTileset, TOOLS);
        $.extend(gTileCategories, TOOLS_CATEGORY);

        $('head').append('<link rel="stylesheet" type="text/css" href="tiles/' + this.tileset + '/tileset.css" />');

        this.categories = sortObject(gTileCategories, CATEGORY_ORDER);
        var $mapEditNodes = $mapTemplate.tmpl(this);
        this.$node = $mapEditNodes.filter('#map-combined');
        var me = this;
        this.$node.find('.drawbar-tile').click(function () { 
            return me.pen.setCurrent($(this).data('tile'));
        });

        var $toolbar = (new Toolbar(this.appState)).render($('#toolbar'));
        this.$node.find('.toolbar').replaceWith($toolbar);

        // this must happen after templates have finished rendering so the
        // node really exists. svg events can't trigger unless the node is
        // visible in the DOM.
        $(document).bind(EVENT_TEMPLATE_DONE, function (ev) {
            var $mapNode = me.$node.find('.map');
            $mapNode.svg(function (svg) { 
                me._renderSVG(svg);
                if (me._restoredExtents) {
                    me._restoreGridArea();
                }
            });
            me.pen = new Pen($('#current'));
            me.pen.setCurrent(me.defaultFill);
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
        $(document).bind(EVENT_MAP_RENAME, function (ev, id, name) {
            me.name = name;
        });
        return $mapEditNodes;
    },

    _iconAt: function (label, x, y) { // place an icon image for this Fill at the coordinates x,y
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
        return itm;
    },

    fgAt: function (label, x, y) { // place an icon image in the fg layer at x,y
        var itm = this._iconAt(label, x, y);
        $(itm).attr('id', 'fg-' + x + '-' + y);
    },

    fg2At: function (label, x, y) { // place an icon image in the fg2 layer at x,y
        var itm = this._iconAt(label, x, y);
        $(itm).attr('id', 'fg2-' + x + '-' + y);
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

        $root.animate({svgViewBox: xAbs + ' ' + yAbs + ' ' + rw * factor + ' ' + rh * factor}, 500);
    },

    _renderSVG: function (svg) { // create a new hex canvas using defaults
        this.svg = svg;

        var grid = this.grid = {};
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

        var defaultClass = {'class': 'hex ' + this.defaultFill};

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
                grid[xx][yy] = {x: xAbs, y: yAbs, n: $p1};
                _p1ID = xx + '-' + yy;
                $p1.attr({id: _p1ID, title: _p1ID}).data({x: xx, y: yy, fg: this.defaultFill, bg: this.defaultFill});

                this.fgAt(this.defaultFill, xx, yy);

                // down hex
                var $p2 = $(svg.polygon(null, [
                        [x2, yS], [x3, yS], [x35, yM],
                        [x3, yT], [x2, yT], [x15, yM], [x2, yS]
                    ], defaultClass));
                // store the coordinates
                if (! grid[xx + 1]) {
                    grid[xx + 1] = {};
                }
                grid[xx + 1][yy] = {x: x15, y: yS, n: $p2};
                _p2ID = (xx + 1) + '-' + yy;
                $p2.attr({id: _p2ID, title: _p2ID}).data({x: xx + 1, y: yy, fg: this.defaultFill, bg: this.defaultFill});

                this.fgAt(this.defaultFill, xx + 1, yy);
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
        log("_renderSVG: " + t2.toString() + "ms [" + Math.floor(10000.0 / t2) 
                / 10 + " fps]");
    },

    onHexClick: function (hex) { // change a map hex, and remember it in the undo history
        var dat = $(hex).data();
        var fg = this.pen.fg, bg = this.pen.bg, fg2 = this.pen.fg2;
        if (this.pen.fg == KEEP_LAYER) {
            fg = dat.fg;
        }
        if (this.pen.fg2 == KEEP_LAYER) {
            fg2 = dat.fg2;
        }
        if (this.pen.bg == KEEP_LAYER) {
            bg = dat.bg;
        }
        this.history.do('setHex', [hex, fg, bg, fg2], [hex, dat.fg, dat.bg, dat.fg2]); 
    },

    do_setHex: function (hex, fgFill, bgFill, fg2Fill) { // apply a change to all layers and map DOM
        var $h = $(hex);
        var newData = {fg: fgFill, bg: bgFill, fg2: fg2Fill};
        $h.data(newData);

        // set bg
        $h.attr('class', 'hex ' + bgFill || '');

        var _dat = $h.data();
        // set fg
        var $fg = $('#fg-' + $h.attr('id'));
        $fg.remove();
        if (fgFill) {
            this.fgAt(fgFill, _dat.x, _dat.y);
        }
        // set fg2
        var $fg2 = $('#fg2-' + $h.attr('id'));
        $fg2.remove();
        if (fg2Fill) {
            this.fg2At(fg2Fill, _dat.x, _dat.y);
        }
    }
}, {
    restore: function (data, appState) {
        // restore: return a new instance of Map from the given dict data
        var ret = new Map(appState, '#');
        ret.name = data.name;
        ret.id = data.id;
        ret.modified = data.modified;
        ret.tileset = data.tileset;

        // extents and hexes are not intended to be looked at after the map is
        // painted for the first time, so these attributes are private
        ret._restoredExtents = data.extents;
        ret._restoredHexes = data.hexes;
        ret._toSymbol = data.lookup;

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



// I remember what you were looking at in the app and I am responsible for all
// localStorage interaction
var AppState = Base.extend({
    constructor: function () {
        if (!localStorage.username) {
            this._generateSampleData();
        };

        this.visibleScreen = this._getVisibleScreen();

        // TODO - make _upgrade1to2, _upgrade2to3 etc. so we can cleanly
        // upgrade storage
        //
        var me = this;
        me.maps = {};
        for (var n=0; n < localStorage.length; n++) {
            var attr = localStorage.key(n);
            if (attr.substr(0, 4) === 'map-') {
                var m = $.evalJSON(localStorage[attr]);
                var mt = Map.restore(m, me); 
                me.maps[mt.id] = mt;
            }
        };

        this.username = localStorage.username;
        this.email = localStorage.email;

        var vs = this.visibleScreen;
        if (vs[0] == VIEW_MAP_EDIT) {
            this.currentMap = this.maps[vs[1]];
        } else if (vs[0] == VIEW_MY_MAPS) {
            this.mapList = new MapList(this);
        } else if (vs[0] == VIEW_USER_EDIT) {
            this.userEditor = new UserEditor(this);
        }

        // save event - write to localStorage
        $(document).bind(EVENT_MAP_SAVE, function (ev) {
            me._mapSave();
        });
    },

    _generateSampleData: function () {
        _m1 = (new Map(this, 'your map#1')).save();
        _m2 = (new Map(this, 'your map 2#2')).save();
        _m1.lookup = {M0: 'Mountain', G0: 'Grassland'};
        _m1.extents = [1, 1, 2, 2];
        _m1.hexes = [
            [ "M0M0~~", "M0M0~~" ],
            [ "G0G0~~", "M0M0~~" ],
        ];
        localStorage['map-1'] = $.toJSON(_m1);
        localStorage['map-2'] = $.toJSON(_m2);
        localStorage.username = 'corydodt';
        localStorage.email = 'mapiphany@s.goonmill.org';
    },

    _mapSave: function () { // write all map states to localStorage
        log('AppState map save id ' + this.currentMap.id);
        localStorage['map-' + this.currentMap.id] = $.toJSON(this.currentMap.save());
    },

    _getVisibleScreen: function () {
        var frag = window.location.href.split('#')[1];
        if (frag === undefined || VIEW_MY_MAPS === frag) {
            return [VIEW_MY_MAPS, null];
        } else if (VIEW_USER_EDIT === frag) {
            return [VIEW_USER_EDIT, null];
        } else if (frag.search(new RegExp('^' + VIEW_MAP_EDIT) >= 0)) {
            var parts = frag.split('&');
            return [parts[0], parts[1]];
        } else {
            return [null, null];
        }
    },

    redirect: function (destination) {
        // navigate to the new destination
        window.location.href = stripHash(window.location.href) + '#' + destination;
        // The following may only be required in some browsers; other
        // browsers will already be reloading by this point.
        window.location.reload();
    },

    getTitle: function () {
        // get the <title> content
        var vs = this.visibleScreen;
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
        window.location = window.location.href.replace(/#clear$/, '#my-maps');
    }
    var appState = new AppState();

    var fw = new Framework(appState);
    fw.render();

    $(document).trigger(EVENT_TEMPLATE_DONE);
});

