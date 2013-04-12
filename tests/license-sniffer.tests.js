var assert = require("assert");
var path = require("path");
var fs = require("fs");

var temp = require("temp");

var licenseSniffer = require("../");


describe("license-sniffer.sniff", function() {
    it("detects itself as BSD", function(done) {
        licenseSniffer.sniff(path.join(__dirname, ".."), function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD"]);
            done();
        });
    });
    
    it("errors if package.json doesn't exist", function(done) {
        licenseSniffer.sniff(__dirname, function(err, license) {
            assert.ok(err);
            done();
        });
    });
    
    it("detects BSD license using LICENSE file if present", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            var bsdLicenseText = licenseText("bsd-2-clause");
            fs.writeFile(path.join(moduleDirPath, "LICENSE"), bsdLicenseText);
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, ["BSD 2-Clause"]);
                done();
            }); 
        });
    });
    
    it("detects MIT license using LICENSE file if present", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            var mitLicenseText = licenseText("mit");
            fs.writeFile(path.join(moduleDirPath, "LICENSE"), mitLicenseText);
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, ["MIT"]);
                done();
            }); 
        });
    });
    
    it("detects no license if LICENSE is not similar to any known license", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            fs.writeFile(path.join(moduleDirPath, "LICENSE"), "Been Listening");
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, []);
                done();
            });
        });
    });
});

function licenseText(name) {
    return fs.readFileSync(path.join(__dirname, "../licenses/" + name), "utf8");
}

function withTemporaryModule(moduleName, callback) {
    var moduleDirPath = temp.mkdirSync();
    fs.writeFileSync(
        path.join(moduleDirPath, "package.json"),
        JSON.stringify({"name": moduleName})
    );
    callback(moduleDirPath);
}


describe("license-sniffer.sniffPackageJson", function() {
    it("reads license names as empty list if package.json is empty", function(done) {
        licenseSniffer.sniffPackageJson({}, function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, []);
            done();
        });
    });
    
    it("reads license field", function(done) {
        licenseSniffer.sniffPackageJson({license: "BSD"}, function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD"]);
            done();
        });
    });
    
    it("packageJson is parsed to JSON object if its a string", function(done) {
        licenseSniffer.sniffPackageJson('{"license": "BSD"}', function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD"]);
            done();
        });
    });
    
    it("passes error to callback if JSON is badly formed", function(done) {
        licenseSniffer.sniffPackageJson('{license: "BSD"}', function(err, license) {
            assert.ok(err);
            done();
        });
    });
    
    it("reads licenses field if license field is not present", function(done) {
        var packageJson = {
            licenses: [
                {
                    type: "BSD",
                    url: "http://opensource.org/licenses/BSD-2-Clause"
                }
            ]
        };
        licenseSniffer.sniffPackageJson(packageJson, function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD"]);
            done();
        });
    });
    
    it("reads multiple licenses if licenses has many elements", function(done) {
        var packageJson = {
            licenses: [{type: "BSD"}, {type: "MIT"}]
        };
        licenseSniffer.sniffPackageJson(packageJson, function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD", "MIT"]);
            done();
        });
    });
});
