"""
Manage tilesets and load the default tileset
"""
import os
import sys
from ConfigParser import ConfigParser
from inspect import cleandoc

from twisted.python.filepath import FilePath

import simplejson


def discoverTilesets(path):
    """
    Walk path and look for directories containing tileset.ini; return tilesets
    for them.
    """
    ret = []
    for fp in path.walk():
        if fp.child('tileset.ini').exists():
            ret.append(TileSet(fp.path))
    return ret


class TileSet(FilePath):
    """
    A path which loads up a bunch of tilesets
    """
    def __init__(self, path):
        FilePath.__init__(self, path)
        self.ini = ConfigParser()
        self.ini.read(self.child('tileset.ini').path)
        self.name = self.path.split('/')[-1]

        for sect in self.ini.sections():
            self.ini.set(sect, 'set', self.name)

    @classmethod
    def applyMerge(cls, tileset):
        """
        Apply section [__default__]'s order attribute, importing tiles from
        other tilesets and merging them.  This returns a new tileset 
        """
        new1 = TileSet(tileset.path)
        for ts in reversed(tileset.orderSets()):
            for sect in ts.ini.sections():
                if not new1.ini.has_section(sect):
                    new1.ini.add_section(sect)

                # prevent overwriting a non-blank icon with blank
                if tileset.ini.has_option(sect, 'iconfilename') and not ts.ini.get(sect, 'iconfilename'):
                    continue

                for k, v in ts.ini.items(sect):
                    new1.ini.set(sect, k, v)

        return new1

    def __iter__(self):
        for sect in self.ini.sections():
            if sect == '__default__':
                continue
            d = dict(self.ini.items(sect))
            yield sect, d

    def orderSets(self):
        """
        Return the childsets mentioned in [__default__].order section of my
        tileset.ini
        """
        ret = []
        ini = self.ini
        order = ini.get('__default__', 'order').strip().split(':')
        for _ts in order:
            if _ts == '.':
                ret.append(self)
            else:
                absPath = os.path.abspath(self.path + '/' + _ts)
                ret.append(TileSet(absPath))

        return ret

    def writeResources(self):
        """
        Generate required .js and .css files for this tileset
        """
        merged = TileSet.applyMerge(self)

        jsFile = merged.child('tileset.js').open('w')
        jsFile.write(cleandoc('''$.require("../tilesets.js");
            gTilesetCatalog.register('%s',
            ''' % (self.name,))

        cssFile = merged.child('tileset.css').open('w')

        tileset = {}
        categories = {}
        for name, tile in merged:
            if name == '__default__':
                continue

            tileset[name] = tile
            cats = tile['categories'].split(':')
            for n, cat in enumerate(cats):
                categories.setdefault(cat, []).append(name)
            color = tile['backgroundrgb'].lower()
            cssFile.write('.%s { fill: %s; background-color: %s; }\n' % (
                name, color, color))
        simplejson.dump(tileset, jsFile, sort_keys=True, indent=4 * ' ')
        fixme.... jsFile.write(';\nvar gTileCategories = ')
        categories = dict(map(lambda x: (x[0], sorted(x[1])), categories.items()))
        simplejson.dump(categories, jsFile, sort_keys=True, indent=4 * ' ')
        jsFile.write(';\n')


def run(argv=None):
    if argv is None:
        argv = sys.argv

    sets = discoverTilesets(FilePath('tiles'))
    for ts in sets:
        ts.writeResources()


if __name__ == '__main__':
    run()
