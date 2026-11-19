import { setupCommandCopy } from "./command-copy.js";
import { setupDemoEmbed } from "./demo-embed.js";
import { setupInstallTabs } from "./install-tabs.js";

const installSection = document.querySelector("[data-install]");

setupDemoEmbed(document.querySelector("[data-demo]"));
setupCommandCopy(installSection);
setupInstallTabs(installSection);
