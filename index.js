var mc = require('mongodb').MongoClient;
var colname = process.argv[2] || 'wrf';

function display(err, stats, noclear) {
    if (!noclear) {
        process.stdout.moveCursor(0, -6);
    }
    
    stats = ['count:n', 'size:Mb', 'avgObjSize:b', 'storageSize:Mb', 'totalIndexSize:Mb'].map(function format(key, index, arr) {
        key = key.split(':');
        var val = stats[key[0]] || 0;
        switch(key[1]) {
            case 'n':
                val = val.toString().replace(/(\d)(?=(\d{3})+\b)/g,'$1 ');
                break;
            case 'kb':
                val = (val / 1024).toFixed(2);
                break;
            case 'Mb':
                val = (val / 1024 / 1024).toFixed(2);
                break;
            case 'Gb':
                val = (val / 1024 / 1024 / 1024).toFixed(2);
        }

        return align(key[0], 16) + align(val, 16, 'right') + (/b/.test(key[1]) ? ' ' + key[1] : '');
    });

    stats.unshift('');
    stats.push('');

    process.stdout.write('\r' + stats.join('\n'));
}

function align(value, length, type) {
    value = typeof value !== 'string' ? value.toString() : value;
    length = length || 2;

    if (value.length > length) {
        return value;
    }

    for (value; value.length < length; value = type === 'right' ? (' ' + value) : (value + ' '));

    return value;
}

mc.connect('mongodb://localhost:27017/test', function (err, db) {
    console.log('\nConnected to DB[' + colname + ']');

    var wrf = db.collection(colname);

    wrf.stats(function(err, stats){
        display(err, stats, true);
    });

    setInterval(function(){
        wrf.stats(display);
    }, 5000);
})
