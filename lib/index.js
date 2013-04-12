var path = require("path");
var fs = require("fs");


exports.sniff = sniff;
exports.sniffPackageJson = sniffPackageJson;



function sniff(projectPath, callback) {
    var packageJsonPath = path.join(projectPath, "package.json");
    fs.readFile(packageJsonPath, "utf8", function(err, packageJsonContents) {
        if (err) {
            callback(err);
        } else {
            var packageJson = JSON.parse(packageJsonContents);
            sniffPackageJson(packageJson, callback);
        }
    });
}

function sniffPackageJson(packageJson, callback) {
    callback(null, packageJson.license);
}
