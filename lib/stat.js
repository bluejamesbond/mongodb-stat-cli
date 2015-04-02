'use strict';

var mc = require('mongodb').MongoClient;
var cl = require('cli-color');

var KB = 1024;
var MB = 1048576;
var GB = 1073741824;
var TB = 1099511627776;

var doClear = false;

/**
 * Flattens a nested array. If `isDeep` is `true` the array is recursively
 * flattened, otherwise it is only flattened a single level.
 *
 * @private
 * @param   {Array}   array    The array to flatten.
 * @param   {boolean} [isDeep] Specify a deep flatten.
 * @returns {Array}   Returns  the new flattened array.
 */
function flatten(array, isDeep) {
    /*jshint maxstatements:16 */
    var index = -1;
    var length = array.length;
    var resIndex = -1;
    var result = [];

    while (++index < length) {
        var value = array[index];

        if (Array.isArray(value) && value.length) {
            if (isDeep) {
                // Recursively flatten arrays (susceptible to call stack limits).
                value = flatten(value, isDeep);
            }

            var valIndex = -1;
            var valLength = value.length;

            result.length += valLength;

            while (++valIndex < valLength) {
                result[++resIndex] = value[valIndex];
            }
        } else {
            result[++resIndex] = value;
        }
    }

    return result;
}

/**
 * Formats number
 *
 * @private
 * @param  {Number} num       Number to format
 * @param  {Object} [opts]    Separator of the discharges
 * @param  {Number} [opts.sep=' '] Separator of the discharges
 * @param  {Number} [opts.dec]     Count of decimal places
 * @return {String}           Formatted number
 */
function formatNumber(num, opts) {
    opts = opts || {};
    opts.sep = opts.sep || ' ';
    num = opts.dec ? num.toFixed(opts.dec) : num.toString();
    return num.replace(/(\d)(?=(\d{3})+\b)/g, '$1' + opts.sep);
}

/**
 * Formats number by the `type`
 *
 * @private
 * @param  {Number} num  Number to format
 * @param  {String} type Format type
 * @return {Object}      Object with formatted number and value suffix
 */
function format(num, type) {
    switch (type) {
        case 'n':
            num = {
                value: formatNumber(num),
                suffix: 'doc'
            };
            break;
        case 'b':
            if (num < KB) {
                num = {
                    value: num,
                    suffix: 'b'
                };
            } else if (num < MB) {
                num = {
                    value: num / KB,
                    suffix: 'Kb'
                };
            } else if (num < GB) {
                num = {
                    value: num / MB,
                    suffix: 'Mb'
                };
            } else if (num < TB) {
                num = {
                    value: num / GB,
                    suffix: 'Gb'
                };
            } else {
                num = {
                    value: num / TB,
                    suffix: 'Tb'
                };
            }

            if (num.suffix !== 'b') {
                num.value = formatNumber(num.value, {dec:2});
            }
    }

    return num;
}

/**
 * Converts `value` to string and pad it with leading zeroes
 * until resulting string reaches `length`
 *
 * @private
 * @param  {Number} value           Value to align
 * @param  {Number} [length]        Result string length
 * @param  {Object} [opts]          Additional options
 * @param  {Object} [opts.fill=' '] Additional options
 * @param  {Object} [opts.color]    Additional options
 * @return {String}                 Aligned string
 */
function align(value, length, opts) {
    value = typeof value !== 'string' ? value.toString() : value;
    length = length || 2;
    opts = opts || {};
    opts.fill = opts.fill !== undefined ? opts.fill : ' ';

    if (value.length > length) {
        return value;
    }

    while (value.length < length) {
        value = opts.type === 'right' ? (opts.fill + value) : (value + opts.fill);
    }

    return opts.color ? cl[opts.color](value) : value;
}

/**
 * Current time in hh:mm:ss
 *
 * @private
 * @return {String}
 */
function time() {
    var dt = new Date();
    return [
        align(dt.getHours(),   2, {fill: 0, type: 'right'}),
        align(dt.getMinutes(), 2, {fill: 0, type: 'right'}),
        align(dt.getSeconds(), 2, {fill: 0, type: 'right'})
    ].join(':');
}

/**
 * Displays data in stdout
 *
 * @private
 * @param  {Error}  err     Error object
 * @param  {Object} stats   Statistics object
 */
function display(err, stats) {
    if (err) {
        if (doClear) {
            process.stdout.moveCursor(0, -1);
        }
        process.stdout.write(cl.red('>>') + ' Error: ' + err.message + ' (' + time() + ')\n');
        return;
    }

    var keys = ['count:n', 'size:b', 'avgObjSize:b', 'storageSize:b', 'totalIndexSize:b', 'indexSizes:b'];

    stats = keys.map(function buildLine(key) {
        key = key.split(':');

        var val = this[key[0]] || 0;
        var pad = this._pad    || '';

        if (key[0] === 'indexSizes') {
            var subkeys = Object.keys(val);
            val._pad = '  ';
            return subkeys
                .map(function (item) { return item + ':' + key[1]; })
                .map(buildLine.bind(val));
        }

        val = format(val, key[1]);

        return pad + align(key[0], 16 - pad.length) +
            align(val.value, 14, {type: 'right', color: 'yellow'}) + ' ' + val.suffix;
    }.bind(stats));

    stats.unshift('');
    stats.push(
        '',
        cl.green('>') + ' Last updated at ' + time(),
        ''
    );

    stats = flatten(stats);

    if (doClear) {
        process.stdout.moveCursor(0, -(stats.length - 1));
    }

    process.stdout.write('\r' + stats.join('\n'));

    doClear = true;
}

module.exports = function (argv) {
    if (argv.refresh <= 0) {
        throw new RangeError('Refresh timeout must be a positiv number');
    }

    var mongohost = 'mongodb://' + argv.host + ':' + argv.port + '/' + argv.database;

    mc.connect(mongohost, function (err, db) {
        console.log('\n' + cl.green('>') + ' Connected to ' + cl.underline(mongohost));
        console.log(cl.green('>') + ' Collection: ' + argv.collection);
        console.log(cl.green('>') + ' Refresh interval: ' + cl.cyan(argv.refresh) + 's');

        var wrf = db.collection(argv.collection);

        wrf.stats(display);

        setInterval(function () {
            wrf.stats(display);
        }, argv.refresh * 1000);
    });
};
