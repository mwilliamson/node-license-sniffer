var fs = require("fs");

var promises = require("./promises");

exports.readdirIfExists = readdirIfExists;

var readdir = promises.promisify(fs.readdir);

function readdirIfExists(dirPath) {
    return readdir(dirPath)
        .fail(function(err) {
            if (err.code === "ENOENT") {
                return [];
            } else {
                return q.reject(err);
            }
        });
}
