// Catalog that tracks all the global tilesets
//

$.require('static/support/base.js');

$.require('util.js');


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
    'UNKNOWN': {
        categories: "Tools",
        iconfilename: "unknown.png",
        set: ".",
        scalefactor: 1.0
    }
};


var TilesetCatalog = Base.extend({
    constructor: function () {
        this._catalog = {};
        this._categoryCache = {};
    },

    register: function (name, description, tileset) { // put a tileset into the catalog
        this._catalog[name] = tileset;
        $.extend(tileset, {__default__: {description: description}});
        $.extend(tileset, TOOLS);
        var categories = this.getCategories(name);
        $.extend(categories, TOOLS_CATEGORY);
        return this;
    },

    get: function (name) { // the tileset that goes by this name
        return this._catalog[name];
    },

    getCategories: function (name) { // generate the grouped categories by parsing the tiles in this tileset
        if (this._categoryCache[name] !== undefined) {
            return this._categoryCache[name];
        }
        var cats = {}, ts, _thisCats;
        ts = this.get(name);
        for (tileName in ts) {
            if (tileName == '__default__') {
                continue;
            }
            if (ts.hasOwnProperty(tileName)) {
                _thisCats = ts[tileName].categories.split(':');
                $.each(_thisCats, function () {
                    var cat = this;
                    if (cats[cat] === undefined) {
                        cats[cat] = [];
                    }
                    cats[cat].push(tileName);
                });
            }
        }
        $.each(cats, function () {
            this.sort();
        });
        this._categoryCache[name] = cats;
        return cats;
    },

    getNames: function () { // names of the tilesets in this catalog
        return sortedKeys(this._catalog);
    }
});


gTilesetCatalog = new TilesetCatalog();

