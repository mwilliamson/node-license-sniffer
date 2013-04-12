var path = require("path");
var fs = require("fs");

var natural = require("natural");
var _ = require("underscore");


exports.sniff = sniff;
exports.sniffPackageJson = sniffPackageJson;



function sniff(projectPath, callback) {
    var packageJsonPath = path.join(projectPath, "package.json");
    fs.readFile(packageJsonPath, "utf8", function(err, packageJsonContents) {
        if (err) {
            callback(err);
        } else {
            sniffPackageJson(packageJsonContents, function(err, license) {
                if (err) {
                    callback(err);
                } else if (license.names.length) {
                    callback(null, license);
                } else {
                    sniffLicenseFile(projectPath, callback);
                }
            });
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

function sniffLicenseFile(modulePath, callback) {
    var licensePath = path.join(modulePath, "LICENSE");
    fs.exists(licensePath, function(exists) {
        if (exists) {
            fs.readFile(licensePath, "utf8", function(err, licenseText) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, {
                        names: [detectLicenseFromText(licenseText)]
                    });
                }
            });
        } else {
            callback(null, null);
        }
    });
}

var licenseTexts = [];
(function() {
    var licenseDir = path.join(__dirname, "../licenses");
    var licensesJson = JSON.parse(fs.readFileSync(path.join(licenseDir, "licenses.json"),"utf8"));
    
    licensesJson.forEach(function(license) {
        var licensePath = path.join(licenseDir, license.path);
        licenseTexts.push({
            name: license.name,
            text: fs.readFileSync(licensePath, "utf8")
        });
    });
})();

function detectLicenseFromText(text) {
    var distances = licenseTexts.map(function(license) {
        return {
            distance: natural.JaroWinklerDistance(license.text, text),
            license: license
        };
    });
    var closest = _.max(distances, function(distance) {
        return distance.distance;
    });
    return closest.license.name;
}
