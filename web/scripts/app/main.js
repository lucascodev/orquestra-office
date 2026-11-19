const VIEW_PARAM = "vista";
const HEADQUARTERS_VIEW = "sede";

if (new URLSearchParams(window.location.search).get(VIEW_PARAM) === HEADQUARTERS_VIEW) import("./headquarters-main.js");
else import("./office-main.js");
