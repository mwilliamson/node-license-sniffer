var fs = require("fs");

var promises = require("./promises");

exports.readdirIfExists = readdirIfExists;
exports.exists = fileExists;
exports.readFile = promises.promisify(fs.readFile);

var readdir = promises.promisify(fs.readdir);

function readdirIfExists(dirPath) {
    return readdir(dirPath)
        .fail(function(err) {
            if (err.code === "ENOENT") {
                return [];
            } else {
                return promises.reject(err);
            }
        });
}


function fileExists(filePath) {
    var deferred = promises.defer();
    fs.exists(filePath, function(exists) {
        deferred.resolve(exists);
    });
    return deferred.promise;
}
