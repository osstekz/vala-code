var bucketRoot = "https://test-results.dartcode.org/";
var githubApiRoot = "https://api.github.com/repos/Dart-Code/Dart-Code/";
var results = [];
var outstandingRequests = 0;
var queryString = window.location.search.substring(1);

if (queryString && queryString.indexOf("/") !== -1) {
	getXml(bucketRoot + "?prefix=" + escape(queryString), handleFileListing, showWarning);
} else {
	getJson(githubApiRoot + "branches", function (branches) {
		handleBranchList(branches);
		// Page 2, since per_page doesn't seem to work here.
		// We may want to fix this when we hit 60 branches :)
		getJson(githubApiRoot + "branches?page=2", handleBranchList);
	}, function (e) {
		hideLoading();
		showWarning("Failed to load branches. Have you blown your GH API quota? :(");
		showWarning(e);
	});
}

function get(url, success, error) {
	var request = new XMLHttpRequest();
	request.open("GET", url);
	request.onerror = error;
	request.onload = function () {
		if (this.status >= 200 && this.status < 400) {
			success(this);
		} else {
			error(this.statusText);
		}
	};
	request.send();
}

function getXml(url, success, error) {
	get(url, function (request) { success(request.responseXML); }, error);
}

function getJson(url, success, error) {
	get(url, function (request) { success(JSON.parse(request.response)); }, error);
}

function handleFileListing(xml) {
	var matchedFiles = 0;
	for (var file of xml.querySelectorAll("Contents")) {
		var size = parseInt(file.querySelector("Size").textContent, 10);
		if (size === 0)
			continue;
		var path = file.querySelector("Key").textContent;
		if (path.indexOf(".xml") === -1)
			continue;
		var pathSegments = path.replace(/refs\/heads\//g, "").split("/");
		var branch = pathSegments[0];
		var hash = pathSegments[1];
		var os = pathSegments[2];
		var testSegments = pathSegments[3].substring(0, pathSegments[3].lastIndexOf(".")).split("_");

		var suite = testSegments.slice(0, testSegments.length - 2).join(" ");
		var dartVersion = testSegments[testSegments.length - 2];
		var codeVersion = testSegments[testSegments.length - 1];

		matchedFiles++;
		loadResults(path, branch, hash, os, suite, dartVersion, codeVersion, os);
	}

	if (matchedFiles === 0) {
		// TODO: Handle no matched files (this is an error, since no filter was handled earlier).
	}
}

function loadResults(path, branch, hash, os, suite, dartVersion, codeVersion, os) {
	outstandingRequests++;
	getXml(bucketRoot + path, function (xml) {
		if (xml)
			handleTestResults(branch, hash, os, suite, dartVersion, codeVersion, xml);
		else
			showWarning("Invalid XML in " + bucketRoot + path);
		outstandingRequests--;
		if (outstandingRequests == 0) {
			updateResults();
		}
	}, showWarning);
}

function handleTestResults(branch, hash, os, suite, dartVersion, codeVersion, xml) {
	var suiteResults = results.find((r) => r.suite == suite);
	if (!suiteResults) {
		suiteResults = { suite: suite, branch: branch, hash: hash, testClasses: [] };
		results.push(suiteResults);
	}

	var testsSeenInThisFile = {};
	for (var test of xml.querySelectorAll("testcase")) {
		var className = test.getAttribute("classname");
		var classResults = suiteResults.testClasses.find((r) => r.className == className);
		if (!classResults) {
			classResults = { className: className, tests: [] };
			suiteResults.testClasses.push(classResults);
		}

		var testName = test.getAttribute("name");
		var uniqueResultName = dartVersion + "_" + codeVersion + "_" + os + "_" + className + "_" + testName;
		if (testsSeenInThisFile[uniqueResultName]) {
			showWarning("Test '" + uniqueResultName + "' has already been seen!");
		} else {
			testsSeenInThisFile[uniqueResultName] = true;
		}
		var testResults = classResults.tests.find((r) => r.testName == testName);
		if (!testResults) {
			testResults = { testName: testName };
			classResults.tests.push(testResults);
		}

		testResults[dartVersion + "_" + codeVersion + "_" + os] = {
			time: test.getAttribute("time"),
			failure: test.querySelector("failure") ? test.querySelector("failure").textContent || true : undefined,
			skipped: test.querySelector("skipped") ? test.querySelector("skipped").textContent || true : undefined
		};
	}
}

function updateResults() {
	var table = document.querySelector("#test-results");
	var tbody = table.querySelector("tbody");
	var totalCols = 18;
	results.sort((s1, s2) => s1.suite.localeCompare(s2.suite));
	for (var suite of results) {
		var row = addRow(tbody, 0, 3, suite.suite, "suite");
		for (var codeVersion of ["stable", "insiders"]) {
			for (var dartVersion of ["stable", "dev"]) {
				// Don't show dev/dev for simplicity.
				if (codeVersion == "insiders" && dartVersion == "dev")
					continue;
				row.appendChild(document.createElement("td"));
				for (var os of ["win", "osx", "linux"]) {
					// TODO: Finish... We have multiple files here (types of files, but also multiple files for multiple runs)..
					// Maybe link to a list of files using the same API we use above?
					// TODO: Why is icon rotated?
					// var a = row.appendChild(document.createElement("td")).appendChild(document.createElement("a"));
					// a.href = bucketRoot + ["logs", suite.branch, suite.hash, os, ".dart_code_logs", suite.name].join("/");
					// var img = a.appendChild(document.createElement("img"));
					// img.className = "x";
					// img.src = "/images/log.svg";
				}
				row.appendChild(document.createElement("td"));
			}
		}
		for (var testClass of suite.testClasses) {
			addRow(tbody, 1, totalCols - 1, testClass.className);
			for (var test of testClass.tests) {
				var row = addRow(tbody, 2, 1, test.testName, undefined, "test-name");
				for (var codeVersion of ["stable", "insiders"]) {
					for (var dartVersion of ["stable", "dev"]) {
						// Don't show dev/dev for simplicity.
						// if (codeVersion == "insiders" && dartVersion == "dev")
						// 	continue;
						row.appendChild(document.createElement("td"));
						for (var os of ["win", "osx", "linux"]) {
							var id = dartVersion + "_" + codeVersion + "_" + os;
							var result = test[id];
							var resultClassName = "unknown";
							var tooltip = "";
							var linkToLog = true;
							if (result && result.failure) {
								resultClassName = "fail";
								tooltip = result.failure;
							} else if (result && result.skipped) {
								resultClassName = "skipped";
							} else if (result) {
								resultClassName = "pass";
								linkToLog = false;
							} else if (test.testName.indexOf("\"after each\" hook") === 0
								|| test.testName.indexOf("\"before each\" hook") === 0
								|| test.testName.indexOf("\"before\" hook") === 0
								|| test.testName.indexOf("\"after\" hook") === 0) {
								// If we get here (unknown) but it's just for a hook, then don't
								// record it as unknown, since it wasn't expected to run - we've
								// just got it in the list because it failed somewhere else.
								resultClassName = undefined;
							}

							var cell = row.appendChild(document.createElement("td"));
							cell.className = resultClassName;
							cell.title = tooltip;

							if (linkToLog) {
								var link = cell.appendChild(document.createElement("a"));
								link.href = bucketRoot + ["logs", suite.branch, suite.hash, os, filenameSafe(suite.suite + "_" + dartVersion + "_" + codeVersion), filenameSafe(testClass.className + " " + test.testName) + ".txt"].join("/");
							}

							// Add to column header.
							if (resultClassName)
								document.getElementById(id).classList.add(resultClassName);
						}
						row.appendChild(document.createElement("td"));
					}
				}
			}
		}
	}
	hideLoading();
	table.classList.remove("hide");
}

// This same logic exists in test helper script that names the log.
function filenameSafe(testName) {
	return testName.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
}

function addRow(table, pad, cols, label, rowClassName, cellClassName) {
	var row = table.appendChild(document.createElement("tr"));
	row.className = rowClassName;
	for (var i = 0; i < pad; i++)
		row.appendChild(document.createElement("td"));

	var cell = row.appendChild(document.createElement("td"));
	cell.textContent = label;
	cell.colSpan = cols;
	cell.className = cellClassName;

	table.appendChild(row);
	return row;
}

function hideLoading() {
	document.getElementById("test-results-loading").classList.add("hide");
}

function handleBranchList(branches) {
	let list = document.getElementById("test-branches");
	let listStale = document.getElementById("test-branches-stale");
	for (let branch of branches) {
		outstandingRequests++;
		let branchName = branch.name;
		let hash = branch.commit.sha;

		let li = list.appendChild(document.createElement("li"));

		// let badges = li.appendChild(document.createElement("div"));
		// badges.classList.add("badges");
		// badges.appendChild(document.createElement("img")).src = "https://img.shields.io/travis/Dart-Code/Dart-Code/" + escape(branchName) + ".svg?label=mac+%26+linux";
		// badges.appendChild(document.createElement("img")).src = "https://img.shields.io/appveyor/ci/DanTup/Dart-Code/" + escape(branchName) + ".svg?label=windows&amp;logoWidth=-1";

		getXml(bucketRoot + "?max-keys=1&prefix=" + escape(branchName + "/" + hash), function (xml) {
			var hasResults = !!xml.querySelector("Contents");

			// The first result will show the list.
			hideLoading();
			list.classList.remove("hide");

			if (hasResults) {
				var a = li.appendChild(document.createElement("a"));
				a.textContent = branchName;
				a.href = "?" + branchName + "/" + hash;
			} else {
				li.appendChild(document.createTextNode(branchName));
			}

			function addDate(date) {
				var span = li.appendChild(document.createElement("span"));
				var daysAgo = Math.floor(((new Date()).getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
				if (daysAgo == 0) {
					daysAgo = "today";
					span.classList.add("today");
				} else if (daysAgo == 1)
					daysAgo = "yesterday";
				else
					span.classList.add("days-ago");
				span.textContent = daysAgo;

				if (daysAgo > 14) {
					document.getElementById("stale").classList.remove("hide");
					listStale.appendChild(li);
				}
			}

			// If we have rest results, use their date (to avoid burning GH API).
			if (hasResults) {
				addDate(new Date(Date.parse(xml.querySelector("Contents LastModified").textContent)));
			} else { // Otherwise, try GH.
				getJson(branch.commit.url, function (json) {
					addDate(new Date(Date.parse(json.commit.committer.date)));
				}, showWarning);
			}
		}, showWarning);
	}
}

function showWarning(message) {
	var warnings = document.querySelector("#test-results-warnings");
	warnings.appendChild(document.createElement("div")).appendChild(document.createTextNode(message));
	warnings.classList.remove("hide");
}
