
//get the version number from package.version
var version = require('./package').version;

//get parameters from command line
var buildNumber = process.argv[2];
//this one is optional
var branchName = process.argv[3];

//determine if to use a branch name as part of the build
var versionBranchName;
if (branchName === "master" || typeof branchName === "undefined")
    versionBranchName = "";
else
    versionBranchName = branchName + ".";

//calc a new version number of the form: MAJOR.MINOR.[BRANCH].BUILDNUM
version = version.replace(/([0-9]+)[.]([0-9]+)[.]([0-9]+)/, "$1.$2." + versionBranchName + buildNumber);

//output the new version number
console.log(version);