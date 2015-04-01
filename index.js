var mc   = require('mongodb').MongoClient;
var cl   = require('cli-color');
var argv = require('optimist')
            .usage('Simple MongoBD statistics.\nUsage: $0 --host HOST --database DBNAME --collection COLNAME')
            .demand('h').alias('h', 'host').default('h', 'localhost').describe('h', 'MongoDb server host')
            .demand('p').alias('p', 'port').default('p', '27017').describe('h', 'MongoDb server port')
            .demand('d').alias('d', 'database').describe('d', 'Database Name')
            .demand('c').alias('c', 'collection').describe('c', 'Collection Name')
            // .demand('p').alias('p', 'points').default('p', 100).describe('p', 'Number of process points per line')
            .argv;

var mongohost = 'mongodb://' + argv.host + ':' + argv.port + '/' + argv.database;

function display(err, stats, noclear) {
    if (!noclear) {
        process.stdout.moveCursor(0, -6);
    }
    
    stats = ['count:n', 'size:Mb', 'avgObjSize:b', 'storageSize:Mb', 'totalIndexSize:Mb'].map(function format(key, index, arr) {
        key = key.split(':');
        var val = stats[key[0]] || 0,
            suf;
        switch(key[1]) {
            case 'n':
                val = val.toString().replace(/(\d)(?=(\d{3})+\b)/g,'$1 ');
                suf = ' doc';
                break;
            case 'kb':
                val = (val / 1024).toFixed(2);
                suf = ' ' + key[1];
                break;
            case 'Mb':
                val = (val / 1024 / 1024).toFixed(2);
                suf = ' ' + key[1];
                break;
            case 'Gb':
                val = (val / 1024 / 1024 / 1024).toFixed(2);
            default:
                suf = ' ' + key[1];
        }

        return align(key[0], 16) + align(val, 16, 'right', 'yellow') + suf;
    });

    stats.unshift('');
    stats.push('');

    process.stdout.write('\r' + stats.join('\n'));
}

function align(value, length, type, color) {
    value = typeof value !== 'string' ? value.toString() : value;
    length = length || 2;

    if (value.length > length) {
        return value;
    }

    while (value.length < length) {
        value = type === 'right' ? (' ' + value) : (value + ' ');
    }

    return color ? cl[color](value) : value;
}

mc.connect(mongohost, function (err, db) {
    console.log('\n' + cl.green('>') + ' Connected to ' + cl.underline(mongohost));
    console.log(cl.green('>') + ' Use collection [' + argv.collection + ']');

    var wrf = db.collection(argv.collection);

    wrf.stats(function(err, stats){
        display(err, stats, true);
    });

    setInterval(function(){
        wrf.stats(display);
    }, 5000);
})
