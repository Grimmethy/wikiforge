'use strict';

// AGENT_MANAGER_REGISTER_PATH entry point -- intentionally a no-op, same convention as
// promptforge-manual/register.js and scriptforge-manual/register.js. WikiForge is not
// an agent-manager task source (it registers no work generators); it's a standalone
// service (src/server.js, its own port) that agent-manager's dashboard embeds two real,
// native (non-iframe) tabs for via the manifest-driven dashboard-tab mechanism
// (docs/PLUGIN_API.md "Dashboard tab" in agent-manager) -- see register-am-wiki.js for
// the second one. This file backs the 📓 SecondBrain tab's plugins.json entry;
// dirname(registerPath) is how agent-manager finds this repo's ui/ directory to serve
// ui/secondbrain-tab.js from.
module.exports = {};
