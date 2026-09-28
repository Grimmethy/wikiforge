'use strict';

// A fourth, distinct no-op registerPath for the PropertyForager Wiki tab's own
// plugins.json entry -- see register.js (the SecondBrain tab's entry) for why this
// file exists at all. Four entries need four distinct registerPath values (agent-
// manager's own plugin-add validation refuses a duplicate); all four resolve to the
// SAME shared ui/ directory in this repo, since dirname(registerPath) is this repo's
// root either way.
module.exports = {};
