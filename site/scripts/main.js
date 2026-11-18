import { setupCommandCopy } from "./command-copy.js";
import { setupInstallTabs } from "./install-tabs.js";

const installSection = document.querySelector("[data-install]");

setupCommandCopy(installSection);
setupInstallTabs(installSection);
