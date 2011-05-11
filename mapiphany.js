//
// Mapiphany main application - load and render the framework and web objects
//

$.require('base.js');

$.require('jquery-ui/js/jquery-ui-1.8.7.custom.min.js');

$.require('jquery.tmpl.js');

$.require('jquery.json-2.2.js');

$.require('jquery-svg/jquery.svg.js');
$.require('jquery-svg/jquery.svgdom.js');
$.require('jquery-svg/jquery.svganim.js');

$.require('tilesets.js');
$.require('generated-tilesets.js');
$.require('logging.js');
$.require('patchsvg.js');
$.require('undo.js');
$.require('sample.js');
$.require('util.js');


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
EVENT_MAP_PRINT = 'map-print';
EVENT_MAP_EXPORT = 'map-export';

PEN_SMALL = 'small';
PEN_LARGE = 'large';
MULT = 25; // baseline multiplier to get a decent-sized hex
SIN60 = Math.sin(60 * Math.PI / 180);
Y_UNIT = MULT * SIN60;
X_UNIT = MULT * 0.5;
DEFAULT_FILL = 'Grassland';
DEFAULT_TILESET = 'rkterrain-finalopt';
KEEP_LAYER = '~';

// It's a shame there is no $.support for svg features.  who knows
// what the current support grid is like for all these features?
//
// This is based on: http://www.codedread.com/svg-support-table.html
//
MAP_IMAGE_NODENAME = ($.browser.mozilla || $.browser.opera) ? 'use' : 'image';


function stripHash(uri) { // remove the hash (if any) from uri
    var rx = /#[^#]*$/;
    return uri.replace(rx, '');
}

// any defined region of the page space that requires rendering with a template
var PageArea = Base.extend({
    constructor: function (appState) {
        this.appState = appState;
    },

    render: function ($template, data) {
        log("render PageArea to " + $template + " with " + data);
        return $template.tmpl(data || this.appState);
    }
});


// the navigation and controls at the top of the page
var Top = PageArea.extend({
    render: function ($template) {
        log("render Top to " + $template.selector);
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

        $ret.find('a[href$=#my-maps]').parents('.tab').click(function () {
            me.appState.redirect(VIEW_MY_MAPS);
            return false;
        });

        return $ret;
    }
});


// the controls at the top of the map-edit area
var Toolbar = PageArea.extend({
    render: function ($template) {
        log("render Toolbar to " + $template.selector);
        var ret = $template.tmpl(this.appState.currentMapView);
        var me = this;

        ret.find('select[name=zoom]').change(function () {
            var $me = $(this);
            $(document).trigger(EVENT_MAP_ZOOM, [$me.val()]);
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

        ret.find('input[name=print]').click(function () {
            $(document).trigger(EVENT_MAP_PRINT, []);
        });

        ret.find('input[name=export]').click(function () {
            $(document).trigger(EVENT_MAP_EXPORT, []);
        });

        return ret;
    }
});


// the main workspace below the Top, which may contain different sub-apps
var Workspace = PageArea.extend({
    render: function () {
        log("render Workspace");
        var $n;
        if (this.appState.visibleScreen[0] == VIEW_MAP_EDIT) {
            $n = this.appState.currentMapView.render($('#map-edit'));
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
        log("render Framework");
        (new Top(this.appState)
             ).render($('#top-control-tmpl')
             ).insertBefore('#cursor');
        $('#workspace').empty().append(
            (new Workspace(this.appState)
                 ).render()
            );
        $('title').html(this.appState.getTitle());
    }
});


// the current drawing settings
var Pen = Base.extend({
    constructor: function ($node, mapView) {
        this.$node = $node;
        this.fg = null;
        this.bg = null;
        this.fg2 = null;
        // this.fillSize = PEN_SMALL;
        // this.pathWidth = null;
        // this.pathColor = null;
        // this.pathStyle = null;
        this.mapView = mapView;
    },

    // set the current pen and display the new setting
    setCurrent: function (newTile) {
        var tile = this.mapView.tileset[newTile];
        var $disp = $('#current .brushes-tile-x1');
        var $cloned = $('#brushes-tile').tmpl({tile: tile});
        $disp.replaceWith($cloned);

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
        log("render MapList to " + $template.selector);
        var $ret = $template.tmpl(this.appState);
        var me = this;

        $ret.find('.snapshot .thumbnail, .snapshot .details').click(function () {
            me.appState.redirect(VIEW_MAP_EDIT + '&' + $(this).parents('.snapshot').attr('data-id'));
        });

        $ret.find('input[name=new-button]').click(function (ev) {
            $('.ui-dialog').remove();
            var $t = $('#new-dialog-tmpl').tmpl({
                tilesets: gTilesetCatalog.getNames(),
                tiles: ['Grassland', 'Sandy_Desert']
            });
            $('body').append($t);
            $('#new-dialog-content').dialog({
                width: 'auto',
                height: 'auto',
                modal: true,
                buttons: {'new': function () { me.onNewClicked(this); } },
            });
        });

        $ret.find('input[name=import-button]').click(function (ev) {
            $('.ui-dialog').remove();
            var $t = $('#import-dialog-tmpl').tmpl({});
            $('body').append($t);
            $('#import-dialog-content').dialog({
                width: 'auto',
                height: 'auto',
                modal: true,
                buttons: {'import': function () { me.onImportClicked(this); } }
            });
        });

        return $ret;
    },

    onNewClicked: function (dlg) {
        var data = {}, $dlg = $(dlg), newMap;
        data.name = $dlg.find('[name="name"]').val();
        data.tileset = $dlg.find('[name="tileset-select"]').val();
        data.defaultTile = $dlg.find('[name="default-tile-select"]').val();

        newMap = this.appState.createMap(data);
        this.appState.redirect(VIEW_MAP_EDIT + '&' + newMap.id);
        $dlg.dialog("close");
    },

    onImportClicked: function (dlg) {
        var rawData, data, newMap;
        rawData = $(dlg).find('#import-dialog-content [name="pasted-map"]').val();
        data = $.evalJSON(rawData);

        newMap = this.appState.createMap(data);
        this.appState.redirect(VIEW_MAP_EDIT + '&' + newMap.id);
        $dlg.dialog("close");
    }
});


// the drawable map grid inside the workspace
var MapView = PageArea.extend({
    constructor: function (appState, map) {
        // FIXME - use regex split, and unescape ## into # 
        this.appState = appState;
        this.map = map;
        this.grid = null;
        this.$node = null;
        this.pen = null;
        this.svg = null;
        this.history = new UndoHistory(this);
        this.tileset = null;
    },

    _restoreGridArea: function () { // rebuild the map drawing from whatever we restored
        var t1 = new Date();
        var hexes = this.map.hexes;
        for (x in hexes) {
            // when the saved map is larger than the displayed map, skip
            // over it. we'll be growing the grid if the screen is ever
            // resized or moved.
            if (this.grid[x] === undefined) {
                break;
            }
            for (y in hexes[x]) {
                // when the saved map is larger than the displayed map, skip
                // over it. we'll be growing the grid if the screen is ever
                // resized or moved.
                if (this.grid[x][y] === undefined) {
                    break;
                }
                hex = hexes[x][y];
                // there can be "gaps" in the model's hex grid.  skip gaps.
                if (! hex) {
                    continue;
                }

                // FIXME - do_setHex makes a call to set data in the model,
                // which is a waste of time during a restore operation.  Maybe
                // a flag to prevent that call?
                this.do_setHex(this.grid[x][y].n, hex[0], hex[1], hex[2]);
            }
        }
        var t2 = new Date() - t1;
        log("_restoreGridArea: " + t2.toString() + "ms");
    },

    render: function ($mapTemplate) { // turn on svg mode for the div
        log("render MapView to " + $mapTemplate.selector);

        $('head').append($('#tileset-css').tmpl(this.map));

        this.tileset = gTilesetCatalog.get(this.map.tileset);
        var cats = sortObject(gTilesetCatalog.getCategories(this.map.tileset),
                CATEGORY_ORDER);
        var _d = {categories: cats, tileset: this.tileset};

        var $mapEditNodes = $mapTemplate.tmpl(_d);

        this.$node = $mapEditNodes.filter('#map-whole-workspace');
        var me = this;
        this.$node.find('.brushes-tile').click(function () { 
            return me.pen.setCurrent($(this).data('tile'));
        });

        var $toolbar = (new Toolbar(this.appState)).render($('#toolbar-tmpl'));
        this.$node.find('#toolbar').replaceWith($toolbar);

        // this must happen after templates have finished rendering so the
        // node really exists. svg events can't trigger unless the node is
        // visible in the DOM.
        $(document).bind(EVENT_TEMPLATE_DONE, function (ev) {
            var $mapNode = me.$node.find('#map');
            $mapNode.svg({
                onLoad: function (svg) { 
                    svg.configure({width: $mapNode.width(), height: $mapNode.height()});
                    me._renderSVG(svg);
                    if (me.map.hexes) {
                        me._restoreGridArea();
                    }
                }
            });
            me.pen = new Pen($('#current'), me);
            me.pen.setCurrent(me.map.defaultFill);
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
            me.map.name = name;
        });
        $(document).bind(EVENT_MAP_PRINT, function (ev) {
            alert('not implemented');
        });
        $(document).bind(EVENT_MAP_EXPORT, function (ev) {
            $('#export-dialog-content').remove();
            var $t = $('#export-dialog-tmpl').tmpl({mapData: $.toJSON(me.map.save())});
            $('body').append($t);
            $('#export-dialog-content').dialog({
                width: 'auto',
                height: 'auto',
                modal: true
            });
        });
        return $mapEditNodes;
    },

    _iconAt: function (label, x, y, prefix) { // place an icon image for this Fill at the coordinates x,y
        if (label === undefined) { 
            throw "Assertion failed: attempting to set an undefined icon";
        }

        var settings, $def, tile, sf, xFactor, yFactor, xOff, yOff, id, href, itm, _g;

        tile = this.tileset[label];
        if (! tile.iconfilename) { // tile is blank on one of the icon layers
            return;
        }

        $def = $('#' + label + '-icon');

        sf = tile.scalefactor;
        xFactor = 4*X_UNIT*sf;
        yFactor = 2*Y_UNIT*sf;
        xOff = (4*X_UNIT - xFactor)/2;
        yOff = (2*Y_UNIT - yFactor)/2;
        id = label + '-icon';
        href = 'tiles/' + tile.set + '/' + tile.iconfilename;

        // create the <defs><image> when missing.
        if ($def.length == 0) {
            // adjust the tile by the scalefactor in width/height, then adjust
            // x/y offset to center it
            this.svg.image(this.defs, xOff, yOff, xFactor, yFactor, href, { id: id });
        }

        _g = this.grid[x][y];
        settings = {'pointer-events': 'none', id: prefix + '-' + x + '-' + y};
        if (MAP_IMAGE_NODENAME == 'use') {
            // <use> has the best performance by far, when it is available
            itm = this.svg.use(this.svgHexes, _g.x, _g.y, 4*X_UNIT, 2*Y_UNIT, '#' + id, settings);
        } else {
            itm = this.svg.image(this.svgHexes, _g.x + xOff, _g.y + yOff, xFactor, yFactor, href, settings);
        }
        return itm;
    },

    fgAt: function (label, x, y) { // place an icon image in the fg layer at x,y
        this._iconAt(label, x, y, 'fg');
    },

    fg2At: function (label, x, y) { // place an icon image in the fg2 layer at x,y
        this._iconAt(label, x, y, 'fg2');
    },

    zoom: function (scale, xAbs, yAbs) {    // rescale the map to the specified zoom
        // to get bigger hexes (larger zoom), use a smaller w/h in the
        // viewbox.  to get smaller hexes (smaller zoom), use larger viewBox
        // w/h.
        var factor = 100.0 / scale;

        var $root = $(this.svg.root());
        var rw = $root[0].width.baseVal.value;
        var rh = $root[0].height.baseVal.value;

        var vb = $root[0].viewBox;
        if (xAbs === undefined) {
            xAbs = vb.baseVal.x;
        }
        if (yAbs === undefined) {
            yAbs = vb.baseVal.y;
        }

        this.$node.find('#svg-hexes > ' + MAP_IMAGE_NODENAME).attr('display', 'none');
        var me = this;
        $root.animate({svgViewBox: xAbs + ' ' + yAbs + ' ' + rw * factor + ' ' + rh * factor}, 500, 'swing',
                function () {
                    me.$node.find('#svg-hexes > ' + MAP_IMAGE_NODENAME).attr('display', '');
                });

        return [xAbs, yAbs, rw * factor, rh * factor];
    },

    _renderSVG: function (svg) { // create a new hex canvas using defaults
        this.svg = svg;
        var svgHexes = this.svgHexes = svg.group(null, 'svg-hexes');

        var grid = this.grid = {};
        this.defs = svg.defs();

        var t1 = new Date();

        // position the viewbox so that no whitespace is visible at the edges
        var geom = this.zoom(100, X_UNIT, Y_UNIT);

        // for convenience define a lot of constants
        var rw = geom[2];
        var rh = geom[3];

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

        var defaultClass = 'hex ' + this.map.defaultFill;

        var xAbs, xx, x05, x15, x2, x3, x35;
        var yAbs, yy, yS, yM, yT;
        for (var xAbs = 0, xx = 0; xAbs < rw + _05; xAbs = xAbs + _3, xx = xx + 2) {
            x05 = xAbs + _05; x15 = xAbs + _15; x2 = xAbs + _2; x3 = xAbs + _3; x35 = xAbs + _35;

            for (yAbs = 0, yy = 0; yAbs < rh + _SHORT; yAbs = yAbs + _MED, yy = yy + 1) {
                yS = yAbs + _SHORT; yM = yAbs + _MED; yT = yAbs + _TALL;

                // up hex
                _p1ID = xx + '-' + yy;
                var $p1 = $(svg.polygon(svgHexes, [
                        [x05, yAbs], [x15, yAbs], [x2, yS],
                        [x15, yM], [x05, yM], [xAbs, yS], [x05, yAbs]
                    ], {'class': defaultClass, id: _p1ID, title: _p1ID}));
                // store the coordinates
                if (! grid[xx]) {
                    grid[xx] = {};
                }
                grid[xx][yy] = {x: xAbs, y: yAbs, n: $p1};
                $p1.data({x: xx, y: yy, fg: this.map.defaultFill, bg: this.map.defaultFill});

                this.fgAt(this.map.defaultFill, xx, yy);

                // down hex
                _p2ID = (xx + 1) + '-' + yy;
                var $p2 = $(svg.polygon(svgHexes, [
                        [x2, yS], [x3, yS], [x35, yM],
                        [x3, yT], [x2, yT], [x15, yM], [x2, yS]
                    ], {'class': defaultClass, id: _p2ID, title: _p2ID}));
                // store the coordinates
                if (! grid[xx + 1]) {
                    grid[xx + 1] = {};
                }
                grid[xx + 1][yy] = {x: x15, y: yS, n: $p2};
                $p2.data({x: xx + 1, y: yy, fg: this.map.defaultFill, bg: this.map.defaultFill});

                this.fgAt(this.map.defaultFill, xx + 1, yy);
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
                svgHexes.appendChild($clone[0]);

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

        var _dat = $h.data();

        this.map.set(_dat.x, _dat.y, fgFill, bgFill, fg2Fill);

        // set bg
        $h.attr('class', 'hex ' + bgFill || '');

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
});


// the map model
var Map = Base.extend({
    constructor: function (appState, name) {
        var _split = name.split('#');
        this.name = _split[0];
        this.id = _split[1];
        this.lookup = {};
        this.lookdown = {};
        this.modified = false;
        this.defaultFill = DEFAULT_FILL;
        this.hexes = null;
        this.tileset = DEFAULT_TILESET;
    },

    set: function (x, y, fgFill, bgFill, fg2Fill) {
        if (! this.hexes[x]) {
            this.hexes[x] = [];
        }
        this.hexes[x][y] = [fgFill, bgFill, fg2Fill];
        this._setLookup(fgFill);
        this._setLookup(bgFill);
        this._setLookup(fg2Fill);
    },

    save: function () { // serialize this map instance to dict data
        var fg, bg, fg2, ld, hexes, _r, cell, grid = [];
        hexes = this.hexes;
        ld = this.lookdown;
        for (x in hexes) {
            for (y in hexes[x]) {
                cell = hexes[x][y];
                if (! grid[x]) {
                    grid[x] = [];
                }
                if (! cell) {
                    grid[x][y] = null;
                } else {
                    fg = this._setLookup(cell[0]);
                    bg = this._setLookup(cell[1]);
                    fg2 = this._setLookup(cell[2]);
                    grid[x][y] = fg + bg + fg2;
                }
            }
        }
        var _r = {name: this.name,
             id: this.id,
             modified: this.modified,
             defaultFill: this.defaultFill,
             hexes: grid,
             lookup: this.lookup,
             tileset: this.tileset
        };
        return _r;
    },

    _setLookup: function (symbol) { // add entries to my fill lookup tables
        if (symbol === undefined || symbol === null) {
            symbol = '~null~';
        }
        if (this.lookdown[symbol]) {
            return this.lookdown[symbol];
        }
        if (symbol == '~null~') {
            abbrev = '~~';
        } else {
            var n = 0, suffixes = '123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            var c0 = symbol[0];
            var abbrev = c0 + '0';
            // find a free suffix to use with this symbol
            while (this.lookup[abbrev] !== undefined) {
                n++;
                if (n > 51) {
                    throw "More than 52 symbols with the same first letter: " + c0 + "???";
                }
                abbrev = c0 + suffixes[n]; 
            }
        }

        this.lookup[abbrev] = symbol;
        this.lookdown[symbol] = abbrev;
        return abbrev;
    }
},
{
    restore: function (data, appState) {
        // restore: return a new instance of Map from the given dict data
        var cell, fg, bg, fg2;
        var ret = new Map(appState, '#');
        ret.name = data.name;
        ret.id = data.id;
        ret.modified = data.modified;
        ret.tileset = data.tileset;
        ret.hexes = [];

        for (x in data.hexes) {
            if (data.hexes[x] === null) {
                ret.hexes[x] = null;
            } else {
                for (y in data.hexes[x]) {
                    if (! ret.hexes[x]) {
                        ret.hexes[x] = [];
                    }
                    if (data.hexes[x][y] === null) {
                        ret.hexes[x][y] = null;
                    } else {
                        cell = data.hexes[x][y];
                        fg = data.lookup[cell.substr(0, 2)];
                        bg = data.lookup[cell.substr(2, 2)];
                        fg2 = data.lookup[cell.substr(4, 2)];
                        if (bg == "~null~") {
                            bg = null;
                        }
                        if (fg == "~null~") {
                            fg = null;
                        }
                        if (fg2 == "~null~") {
                            fg2 = null;
                        }
                        ret.hexes[x][y] = [fg, bg, fg2];
                    }
                }
            }
        }

        return ret;
    }
});


// I remember what you were looking at in the app and I am responsible for all
// localStorage interaction
var AppState = Base.extend({
    constructor: function () {
        var me = this;
        me.maps = {};

        if (!localStorage.username) {
            this._generateSampleData();
        };

        this.visibleScreen = this._getVisibleScreen();

        // TODO - make _upgrade1to2, _upgrade2to3 etc. so we can cleanly
        // upgrade storage
        //
        for (var n=0; n < localStorage.length; n++) {
            var attr = localStorage.key(n);
            if (attr.substr(0, 4) === 'map-') {
                var m = $.evalJSON(localStorage[attr]);
                // FIXME - no need to completely restore map data on the "My
                // Maps" page..
                var mt = Map.restore(m, me); 
                me.addMap(mt.id, mt);
            }
        };

        this.username = localStorage.username;
        this.email = localStorage.email;

        var vs = this.visibleScreen;
        if (vs[0] == VIEW_MAP_EDIT) {
            this.currentMap = this.maps[vs[1]];
            this.currentMapView = new MapView(this, this.currentMap);
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

    _getFreeMapID: function () { // hand out an unused id for a new map
        var max;
        var arr = sortObject(this.maps);
        if (arr.length == 0) {
            return 1;
        }
        max = parseInt(arr[arr.length - 1][1].id, 10);
        return max + 1;
    },

    createMap: function (mapData) { // create a new Map instance from a plain object, or new
        var id, _m;
        id = this._getFreeMapID();

        if (! mapData) {
            _m = new Map(this, 'new map#' + id);
            _m.save();
        } else{
            mapData.id = id;
            _m = Map.restore(mapData);
        }
        this.addMap(id, _m);
        this._mapStoreRaw(id, $.toJSON(mapData));
        return _m;
    },

    _generateSampleData: function () {
        localStorage.username = 'corydodt';
        localStorage.email = 'mapiphany@s.goonmill.org';
        this.createMap(SAMPLE_1);
        this.createMap(SAMPLE_2);
    },

    addMap: function (id, map) { // put a map in my array of maps
        this.maps[id] = map;
    },

    _mapSave: function () { // write all map states to localStorage
        log('AppState map save id ' + this.currentMap.id);
        this._mapStoreRaw(this.currentMap.id, $.toJSON(this.currentMap.save()));
    },

    _mapStoreRaw: function (id, mapData) { // put a map into storage, by its key
        localStorage['map-' + id] = mapData;
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
    window.appState = new AppState(); // make it a global for easier debugging

    var fw = new Framework(appState);
    fw.render();

    $(document).trigger(EVENT_TEMPLATE_DONE);
});

