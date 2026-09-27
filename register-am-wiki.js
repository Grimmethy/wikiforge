'use strict';

// A second, distinct no-op registerPath for the Agent Manager Wiki tab's own
// plugins.json entry -- see register.js (the SecondBrain tab's entry) for why this
// file exists at all. Two entries need two distinct registerPath values (agent-
// manager's own plugin-add validation refuses a duplicate); both resolve to the SAME
// shared ui/ directory in this repo, since dirname(registerPath) is this repo's root
// either way.
module.exports = {};
