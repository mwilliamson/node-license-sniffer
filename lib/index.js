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
            sniffPackageJson(packageJsonContents, callback);
        }
    });
}

function sniffPackageJson(packageJson, callback) {
    if (typeof packageJson === "string") {
        try {
            packageJson = JSON.parse(packageJson);
        } catch (err) {
            return callback(err);
        }
    }
    if (packageJson.license) {
        callback(null, {names: [packageJson.license]});
    } else if (packageJson.licenses) {
        var licenseNames = packageJson.licenses.map(function(license) {
            return license.type;
        });
        
        callback(null, {names: licenseNames});
    } else {
        callback(null, {names: []});
    }
}
