var assert = require("assert");
var path = require("path");

var licenseSniffer = require("../");


describe("license-sniffer.sniff", function() {
    it("detects itself as BSD", function(done) {
        licenseSniffer.sniff(path.join(__dirname, ".."), function(err, license) {
            assert.ifError(err);
            assert.equal(license, "BSD");
            done();
        });
    });
    
    it("errors if package.json doesn't exist", function(done) {
        licenseSniffer.sniff(__dirname, function(err, license) {
            assert.ok(err);
            done();
        });
    });
});


describe("license-sniffer.sniffPackageJson", function() {
    it("reads license field", function(done) {
        licenseSniffer.sniffPackageJson({license: "BSD"}, function(err, license) {
            assert.ifError(err);
            assert.equal(license, "BSD");
            done();
        });
    });
});
