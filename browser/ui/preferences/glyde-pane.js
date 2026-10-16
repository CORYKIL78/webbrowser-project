/* Glyde pane for about:preferences.
 * The pane is a frame that shows chrome://browser/content/glyde/settings.html, so the Glyde
 * settings are part of the browser's own settings page.
 */
"use strict";

var gGlydePane = {
  init() {
    let frame = document.getElementById("glydeFrame");
    if (!frame.getAttribute("src")) {
      frame.setAttribute("src", "chrome://browser/content/glyde/settings.html");
    }
  },
};
